import type { SyncEntityTable, SyncQueueItem, Usuario } from '../types/entities';
import type { ApiResponse, BootstrapResponse, SyncResponse } from './sheetsApiService';
import { getSupabaseAccessToken } from './supabaseAuthService';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SYNC_MODE = import.meta.env.VITE_SYNC_MODE as string | undefined;

type SchemaName = 'core' | 'pollos';

interface RemoteTable {
  schema: SchemaName;
  table: string;
  idField: string;
  readonly?: boolean;
  optional?: boolean;
}

const BOOTSTRAP_TABLES: Array<{ localName: string } & RemoteTable> = [
  { localName: 'Usuarios', schema: 'core', table: 'usuarios', idField: 'UsuarioID', readonly: true },
  { localName: 'Proveedores', schema: 'core', table: 'proveedores', idField: 'ProveedorID', readonly: true },
  { localName: 'Clientes', schema: 'core', table: 'clientes', idField: 'ClienteID', readonly: true },
  { localName: 'TiposAlimento', schema: 'core', table: 'alimentos', idField: 'TipoAlimentoID', readonly: true },
  { localName: 'FacturasCompra', schema: 'core', table: 'facturas_compra', idField: 'FacturaCompraID', readonly: true },
  { localName: 'FacturasVenta', schema: 'core', table: 'facturas_venta', idField: 'FacturaVentaID', readonly: true },
  { localName: 'Galpones', schema: 'pollos', table: 'galpones', idField: 'GalponID' },
  { localName: 'Lotes', schema: 'pollos', table: 'lotes', idField: 'LoteID' },
  { localName: 'LoteGalpones', schema: 'pollos', table: 'lote_galpones', idField: 'LoteGalponID' },
  { localName: 'MovimientosEntreGalpones', schema: 'pollos', table: 'movimientos_entre_galpones', idField: 'MovimientoID' },
  { localName: 'RegistroDiarioLote', schema: 'pollos', table: 'registro_diario_lote', idField: 'RegistroDiarioID' },
  { localName: 'Pesajes', schema: 'pollos', table: 'pesajes', idField: 'PesajeID' },
  { localName: 'PesajeDetalle', schema: 'pollos', table: 'pesaje_detalle', idField: 'PesajeDetalleID' },
  { localName: 'SalidasPollo', schema: 'pollos', table: 'salidas_pollo', idField: 'SalidaID' },
  { localName: 'ActividadesProgramadas', schema: 'pollos', table: 'actividades_programadas', idField: 'ActividadProgramadaID' },
  { localName: 'ActividadesLote', schema: 'pollos', table: 'actividades_lote', idField: 'ActividadLoteID' },
  { localName: 'PlanVacunalBase', schema: 'pollos', table: 'plan_vacunal_base', idField: 'VacunaBaseID' },
  { localName: 'VacunasLote', schema: 'pollos', table: 'vacunas_lote', idField: 'VacunaLoteID' },
  { localName: 'EntradasAlimento', schema: 'pollos', table: 'entradas_alimento', idField: 'EntradaAlimentoID' },
  { localName: 'ConsumoAlimentoLote', schema: 'pollos', table: 'consumo_alimento_lote', idField: 'ConsumoID' },
  { localName: 'MaterialesLote', schema: 'pollos', table: 'materiales_lote', idField: 'MaterialLoteID' },
  { localName: 'EntradasMaterial', schema: 'pollos', table: 'entradas_material', idField: 'EntradaMaterialID', optional: true },
  { localName: 'InventarioMaterial', schema: 'pollos', table: 'inventario_material', idField: 'InventarioMaterialID', optional: true },
  { localName: 'MovimientosInventarioMaterial', schema: 'pollos', table: 'movimientos_inventario_material', idField: 'MovimientoMaterialID', optional: true },
  { localName: 'ControlesAgua', schema: 'pollos', table: 'controles_agua', idField: 'ControlAguaID' },
  { localName: 'EventosSanitarios', schema: 'pollos', table: 'eventos_sanitarios', idField: 'EventoSanitarioID' },
  { localName: 'TratamientosVeterinarios', schema: 'pollos', table: 'tratamientos_veterinarios', idField: 'TratamientoID' },
  { localName: 'RegistrosPlaga', schema: 'pollos', table: 'registros_plaga', idField: 'RegistroPlagaID', optional: true },
  { localName: 'CompostajeCajones', schema: 'pollos', table: 'compostaje_cajones', idField: 'CajonID', optional: true },
  { localName: 'CompostajeRegistros', schema: 'pollos', table: 'compostaje_registros', idField: 'RegistroCompostajeID', optional: true },
  { localName: 'Medicamentos', schema: 'pollos', table: 'medicamentos', idField: 'MedicamentoID', optional: true },
  { localName: 'Perros', schema: 'pollos', table: 'perros', idField: 'PerroID', optional: true },
  { localName: 'PerrosRegistros', schema: 'pollos', table: 'perros_registros', idField: 'PerroRegistroID', optional: true },
  { localName: 'Capacitaciones', schema: 'pollos', table: 'capacitaciones', idField: 'CapacitacionID', optional: true },
  { localName: 'CapacitacionAsistentes', schema: 'pollos', table: 'capacitacion_asistentes', idField: 'AsistenteID', optional: true },
  { localName: 'CostosLote', schema: 'pollos', table: 'costos_lote', idField: 'CostoID' },
  { localName: 'InventarioAlimento', schema: 'pollos', table: 'inventario_alimento', idField: 'InventarioID' },
  { localName: 'MovimientosInventarioAlimento', schema: 'pollos', table: 'movimientos_inventario_alimento', idField: 'MovimientoInventarioID' },
  { localName: 'CurvasEstandar', schema: 'pollos', table: 'curvas_estandar', idField: 'CurvaID' },
  { localName: 'CierresSemanales', schema: 'pollos', table: 'cierres_semanales', idField: 'CierreSemanalID' },
  { localName: 'CierreLote', schema: 'pollos', table: 'cierre_lote', idField: 'CierreLoteID' },
  { localName: 'Alertas', schema: 'pollos', table: 'alertas', idField: 'AlertaID' },
  { localName: 'HistorialCambios', schema: 'pollos', table: 'historial_cambios', idField: 'CambioID' },
  { localName: 'ReportesPDF', schema: 'pollos', table: 'reportes_pdf', idField: 'ReporteID' },
];

const GALPONERO_BOOTSTRAP_TABLE_NAMES = new Set([
  'Usuarios',
  'TiposAlimento',
  'Galpones',
  'Lotes',
  'LoteGalpones',
  'RegistroDiarioLote',
  'Pesajes',
  'SalidasPollo',
  'ActividadesLote',
  'VacunasLote',
  'ConsumoAlimentoLote',
  'InventarioAlimento',
  'InventarioMaterial',
  'CompostajeCajones',
  'CompostajeRegistros',
  'Perros',
]);

const SYNC_TABLES: Partial<Record<SyncEntityTable, RemoteTable>> = Object.fromEntries(
  BOOTSTRAP_TABLES.map((table) => [table.localName, table]),
);

const NULLABLE_DATE_FIELDS = new Set([
  'FechaFin',
  'FechaRealizada',
  'FechaAplicacion',
  'FechaResuelta',
  'FechaHoraUltimaEdicion',
  'FechaVencimientoProducto',
  'FechaVencimiento',
  'FechaUltimaRabia',
  'FechaUltimaDesparasitacion',
]);

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SYNC_MODE !== 'mock');
}

function getBaseUrl(): string {
  if (!SUPABASE_URL) throw new Error('Falta VITE_SUPABASE_URL.');
  return SUPABASE_URL.replace(/\/+$/, '');
}

async function request<T>(schema: SchemaName, table: string, init?: RequestInit, query = 'select=*'): Promise<T> {
  if (!SUPABASE_ANON_KEY) throw new Error('Falta VITE_SUPABASE_ANON_KEY.');
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) throw new Error('Inicia sesion en Supabase para sincronizar.');

  const url = new URL(`${getBaseUrl()}/rest/v1/${table}`);
  query.split('&').filter(Boolean).forEach((part) => {
    const [key, value = ''] = part.split('=');
    url.searchParams.set(decodeURIComponent(key), decodeURIComponent(value));
  });

  const method = (init?.method ?? 'GET').toUpperCase();
  const profileHeader = method === 'GET' || method === 'HEAD' ? 'Accept-Profile' : 'Content-Profile';
  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      [profileHeader]: schema,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message ?? payload?.hint ?? `Error HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function normalizeForSupabase(payload: unknown, table?: RemoteTable): Record<string, unknown> {
  const record = { ...((payload ?? {}) as Record<string, unknown>) };
  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined) delete record[key];
    if (value === '' && NULLABLE_DATE_FIELDS.has(key)) record[key] = null;
  });
  if (table?.table === 'actividades_lote' && record.LoteID === '') record.LoteID = null;
  if ('EstadoSync' in record) record.EstadoSync = 'SINCRONIZADO';
  return record;
}

function normalizeRemoteRowsForLocal(table: RemoteTable & { localName?: string }, rows: object[]): object[] {
  if (table.localName === 'ActividadesProgramadas') return rows.map(normalizeRemoteScheduledActivity);
  if (table.localName !== 'ActividadesLote') return rows;
  return rows.map((row) => {
    const record = { ...(row as Record<string, unknown>) };
    if (record.LoteID === null || record.LoteID === undefined) record.LoteID = '';
    return record;
  });
}

function normalizeRemoteScheduledActivity(row: object): object {
  const record = { ...(row as Record<string, unknown>) };
  const id = String(record.ActividadProgramadaID ?? '');
  const dailyDays = [1, 2, 3, 4, 5, 6, 7];
  const defaultOrderById: Record<string, number> = {
    act_rutina_clorar_tanque: 1,
    act_rutina_sulfatar_tanque: 2,
    act_rutina_medir_cloro_ph: 3,
    act_rutina_purgar_linea: 4,
    act_rutina_alimentacion_manana: 5,
    act_rutina_alimentacion_tarde: 6,
    act_rutina_fumigacion_9am: 7,
    act_rutina_fumigacion_4pm: 8,
    act_rutina_revolcar_cama: 9,
    act_rutina_control_pediluvios: 10,
    act_rutina_control_plagas: 11,
    act_rutina_limpiar_mallas: 12,
    act_rutina_lavar_filtros: 13,
  };

  if (id === 'act_rutina_medir_cloro_ph') {
    record.NombreActividad = 'Tratamiento de agua.';
    record.TipoFrecuencia = 'DIARIA';
    record.HoraSugerida = record.HoraSugerida || '08:00';
  }

  if (id === 'act_rutina_control_plagas') {
    record.NombreActividad = 'Control de plagas.';
    record.TipoFrecuencia = 'SEMANAL';
    record.DiasSemana = [2];
    record.HoraSugerida = record.HoraSugerida || '17:00';
  } else if (id.startsWith('act_rutina_') && (!Array.isArray(record.DiasSemana) || record.DiasSemana.length === 0)) {
    record.DiasSemana = id === 'act_rutina_limpiar_mallas' || id === 'act_rutina_lavar_filtros' ? [] : dailyDays;
  }

  if (id in defaultOrderById && typeof record.OrdenProgramacion !== 'number') record.OrdenProgramacion = defaultOrderById[id];
  return record;
}

function getMissingColumnName(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return /Could not find the '([^']+)' column/.exec(error.message)?.[1];
}

async function writeRemoteRecordWithColumnRetry(
  table: RemoteTable,
  method: 'POST' | 'PATCH',
  record: Record<string, unknown>,
  query: string,
  headers: Record<string, string>,
): Promise<void> {
  const strippedColumns: string[] = [];
  let nextRecord = { ...record };

  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await request(table.schema, table.table, {
        method,
        body: JSON.stringify(nextRecord),
        headers,
      }, query);
      return;
    } catch (error) {
      const missingColumn = getMissingColumnName(error);
      if (!missingColumn || missingColumn === table.idField || !(missingColumn in nextRecord)) throw error;

      strippedColumns.push(missingColumn);
      nextRecord = { ...nextRecord };
      delete nextRecord[missingColumn];
    }
  }

  throw new Error(`No se pudo sincronizar ${table.table}; columnas no existentes: ${strippedColumns.join(', ')}`);
}

async function listRemoteRows(table: RemoteTable): Promise<object[]> {
  return request<object[]>(table.schema, table.table);
}

async function upsertRemoteRecord(table: RemoteTable, payload: unknown): Promise<void> {
  if (table.readonly) throw new Error(`La tabla ${table.table} pertenece a core y es solo lectura para POLLOS.`);

  const record = normalizeForSupabase(payload, table);
  if (!record[table.idField]) throw new Error(`Falta ID ${table.idField}.`);

  await writeRemoteRecordWithColumnRetry(table, 'POST', record, `on_conflict=${encodeURIComponent(table.idField)}`, {
    Prefer: 'resolution=merge-duplicates,return=minimal',
  });
}

async function updateRemoteRecord(table: RemoteTable, id: string, payload: unknown): Promise<void> {
  if (table.readonly) throw new Error(`La tabla ${table.table} pertenece a core y es solo lectura para POLLOS.`);

  const record = normalizeForSupabase(payload, table);
  await writeRemoteRecordWithColumnRetry(table, 'PATCH', record, `${encodeURIComponent(table.idField)}=eq.${encodeURIComponent(id)}`, {
    Prefer: 'return=minimal',
  });
}

export async function bootstrap(user: Usuario): Promise<ApiResponse<BootstrapResponse>> {
  if (!isSupabaseConfigured()) return { ok: true, data: undefined };

  try {
    const tablesToLoad = user.Rol === 'GALPONERO'
      ? BOOTSTRAP_TABLES.filter((table) => GALPONERO_BOOTSTRAP_TABLE_NAMES.has(table.localName))
      : BOOTSTRAP_TABLES;
    const entries = await Promise.all(tablesToLoad.map(async (table): Promise<readonly [string, object[]] | undefined> => {
      try {
        return [table.localName, normalizeRemoteRowsForLocal(table, await listRemoteRows(table))] as const;
      } catch (error) {
        if (!table.optional) throw error;
        return undefined;
      }
    }));
    return {
      ok: true,
      data: {
        tables: Object.fromEntries(entries.filter((entry): entry is readonly [string, object[]] => Boolean(entry))),
        role: user.Rol,
        sheetId: 'supabase',
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error leyendo datos desde Supabase' };
  }
}

export async function sync(items: SyncQueueItem[], _user: Usuario): Promise<ApiResponse<SyncResponse>> {
  if (!isSupabaseConfigured()) return { ok: true, data: undefined };

  const syncedIds: string[] = [];
  const failedItems: SyncResponse['failedItems'] = [];
  const results: SyncResponse['results'] = [];

  for (const item of items) {
    const table = SYNC_TABLES[item.Tabla];
    try {
      if (!table) throw new Error(`Tabla no configurada en Supabase: ${item.Tabla}`);
      if (item.Operacion === 'CREATE') await upsertRemoteRecord(table, item.Payload);
      else if (item.Operacion === 'UPDATE') await updateRemoteRecord(table, item.RegistroID, item.Payload);
      else throw new Error(`Operacion no soportada: ${item.Operacion}`);

      syncedIds.push(item.SyncID);
      results.push({ syncId: item.SyncID, recordId: item.RegistroID, table: item.Tabla, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo sincronizar con Supabase';
      failedItems.push({ syncId: item.SyncID, recordId: item.RegistroID, table: item.Tabla, error: message });
      results.push({ syncId: item.SyncID, recordId: item.RegistroID, table: item.Tabla, ok: false, error: message });
    }
  }

  return { ok: true, data: { syncedIds, failedItems, results } };
}
