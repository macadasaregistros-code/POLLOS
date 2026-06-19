import { createId } from '../lib/id';
import { nowISO } from '../lib/date';
import { db, ensureCanonicalFeedTypes, getLocalTableBySheetName, getTableForSync } from './localDbService';
import * as sheetsApiService from './sheetsApiService';
import * as supabaseApiService from './supabaseApiService';
import type { EstadoSync, SyncEntityTable, SyncOperation, SyncQueueItem, Usuario } from '../types/entities';

export async function enqueueSync(
  table: SyncEntityTable,
  recordId: string,
  operation: SyncOperation,
  payload: unknown,
): Promise<void> {
  const now = nowISO();
  await db.syncQueue.add({
    SyncID: createId('sync'),
    Tabla: table,
    RegistroID: recordId,
    Operacion: operation,
    Payload: payload,
    EstadoSync: 'PENDIENTE',
    Intentos: 0,
    Error: '',
    CreadoEn: now,
    ActualizadoEn: now,
  });
}

export async function pendingSyncCount(): Promise<number> {
  return db.syncQueue.where('EstadoSync').anyOf(['PENDIENTE', 'ERROR']).count();
}

export async function markRecordSyncState(table: SyncEntityTable, recordId: string, state: EstadoSync): Promise<void> {
  const dexieTable = getTableForSync(table);
  await dexieTable.update(recordId, { EstadoSync: state });
}

export async function processSyncQueue(user: Usuario): Promise<{ synced: number; failed: number; mode: 'mock' | 'remote' }> {
  if (!navigator.onLine) return { synced: 0, failed: 0, mode: 'mock' };

  const pending = await db.syncQueue.where('EstadoSync').anyOf(['PENDIENTE', 'ERROR']).toArray();
  if (pending.length === 0) return { synced: 0, failed: 0, mode: import.meta.env.VITE_SYNC_MODE === 'mock' ? 'mock' : 'remote' };

  const useSupabase = supabaseApiService.isSupabaseConfigured();
  const isMock = !useSupabase && (!import.meta.env.VITE_SHEETS_API_URL || import.meta.env.VITE_SYNC_MODE === 'mock');
  if (isMock) {
    await Promise.all(
      pending.map(async (item) => {
        await markRecordSyncState(item.Tabla, item.RegistroID, 'SINCRONIZADO');
        await db.syncQueue.update(item.SyncID, {
          EstadoSync: 'SINCRONIZADO',
          Error: '',
          Intentos: item.Intentos + 1,
          ActualizadoEn: nowISO(),
        });
      }),
    );
    return { synced: pending.length, failed: 0, mode: 'mock' };
  }

  const response = useSupabase ? await supabaseApiService.sync(pending, user) : await sheetsApiService.sync(pending, user);
  if (response.ok) {
    const ids = new Set(response.data?.syncedIds ?? pending.map((item) => item.SyncID));
    const failedById = new Map((response.data?.failedItems ?? []).map((item) => [item.syncId, item.error]));
    await Promise.all(
      pending.map(async (item) => {
        if (ids.has(item.SyncID)) {
          await markRecordSyncState(item.Tabla, item.RegistroID, 'SINCRONIZADO');
          await db.syncQueue.update(item.SyncID, {
            EstadoSync: 'SINCRONIZADO',
            Error: '',
            Intentos: item.Intentos + 1,
            ActualizadoEn: nowISO(),
          });
        } else if (failedById.has(item.SyncID)) {
          await markRecordSyncState(item.Tabla, item.RegistroID, 'ERROR');
          await db.syncQueue.update(item.SyncID, {
            EstadoSync: 'ERROR',
            Error: failedById.get(item.SyncID) ?? 'No se pudo sincronizar este registro',
            Intentos: item.Intentos + 1,
            ActualizadoEn: nowISO(),
          });
        }
      }),
    );
    return { synced: ids.size, failed: failedById.size, mode: 'remote' };
  }

  await Promise.all(
    pending.map((item) =>
      db.syncQueue.update(item.SyncID, {
        EstadoSync: 'ERROR',
        Error: response.error ?? 'No se pudo sincronizar',
        Intentos: item.Intentos + 1,
        ActualizadoEn: nowISO(),
      }),
    ),
  );
  return { synced: 0, failed: pending.length, mode: 'remote' };
}

export async function bootstrapFromRemote(user: Usuario): Promise<{ updatedTables: number; updatedRows: number; skipped: boolean; error?: string }> {
  const useSupabase = supabaseApiService.isSupabaseConfigured();
  const isMock = !useSupabase && (!import.meta.env.VITE_SHEETS_API_URL || import.meta.env.VITE_SYNC_MODE === 'mock');
  if (isMock || !navigator.onLine) return { updatedTables: 0, updatedRows: 0, skipped: true };

  const response = useSupabase ? await supabaseApiService.bootstrap(user) : await sheetsApiService.bootstrap(user);
  if (!response.ok) {
    return { updatedTables: 0, updatedRows: 0, skipped: false, error: response.error ?? 'No se pudo cargar bootstrap' };
  }

  const tables = response.data?.tables ?? {};
  let updatedTables = 0;
  let updatedRows = 0;
  for (const [tableName, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const table = getLocalTableBySheetName(tableName);
    if (!table) continue;
    await table.bulkPut(rows);
    updatedTables += 1;
    updatedRows += rows.length;
  }
  await ensureCanonicalFeedTypes();

  return { updatedTables, updatedRows, skipped: false };
}
