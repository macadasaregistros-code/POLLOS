import type { SyncQueueItem, Usuario } from '../types/entities';

const API_URL = import.meta.env.VITE_SHEETS_API_URL as string | undefined;
const SYNC_MODE = import.meta.env.VITE_SYNC_MODE as string | undefined;
const API_TOKEN = import.meta.env.VITE_SHEETS_API_TOKEN as string | undefined;

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string | null;
  code?: string;
  details?: unknown;
  meta?: {
    schemaVersion?: number;
    serverTime?: string;
  };
}

export interface BootstrapResponse {
  tables: Record<string, object[]>;
  role: string;
  sheetId: string;
}

export interface SyncFailedItem {
  syncId: string;
  recordId: string;
  table: string;
  error: string;
}

export interface SyncResponse {
  syncedIds: string[];
  failedItems: SyncFailedItem[];
  results: Array<{
    syncId: string;
    recordId: string;
    table: string;
    ok: boolean;
    error?: string;
  }>;
}

async function request<T>(action: string, init?: RequestInit, params?: Record<string, string>): Promise<ApiResponse<T>> {
  if (!API_URL || SYNC_MODE === 'mock') {
    return { ok: true, data: undefined as T };
  }

  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  if (API_TOKEN) url.searchParams.set('token', API_TOKEN);
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  try {
    const response = await fetch(url.toString(), {
      ...init,
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        ...(init?.headers ?? {}),
      },
    });

    const text = await response.text();
    const payload = JSON.parse(text) as ApiResponse<T>;
    if (!response.ok || !payload.ok) {
      return { ok: false, error: payload.error ?? `Error HTTP ${response.status}`, code: payload.code, details: payload.details };
    }
    return payload;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error de red o JSON invalido desde Apps Script' };
  }
}

export function bootstrap(user: Usuario): Promise<ApiResponse<BootstrapResponse>> {
  return request('bootstrap', { method: 'GET' }, { userId: user.UsuarioID, role: user.Rol });
}

export function sync(items: SyncQueueItem[], user: Usuario): Promise<ApiResponse<SyncResponse>> {
  return request('sync', {
    method: 'POST',
    body: JSON.stringify({ user, items }),
  });
}

export function createRecord(table: string, payload: unknown, user: Usuario): Promise<ApiResponse<unknown>> {
  return request('create', {
    method: 'POST',
    body: JSON.stringify({ table, payload, user }),
  });
}

export function updateRecord(table: string, id: string, patch: unknown, user: Usuario): Promise<ApiResponse<unknown>> {
  return request('update', {
    method: 'POST',
    body: JSON.stringify({ table, id, patch, user }),
  });
}
