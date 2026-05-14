const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SYNC_MODE = import.meta.env.VITE_SYNC_MODE as string | undefined;
const SESSION_KEY = 'pollos.supabaseSession';

interface AuthUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
}

export function isSupabaseAuthRequired(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SYNC_MODE !== 'mock');
}

function getBaseUrl(): string {
  if (!SUPABASE_URL) throw new Error('Falta VITE_SUPABASE_URL.');
  return SUPABASE_URL.replace(/\/+$/, '');
}

function getStoredSession(): SupabaseSession | undefined {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as SupabaseSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return undefined;
  }
}

function saveAuthResponse(payload: AuthResponse): SupabaseSession {
  const session: SupabaseSession = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + payload.expires_in * 1000,
    user: payload.user,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function authRequest(path: string, body: unknown): Promise<AuthResponse> {
  if (!SUPABASE_ANON_KEY) throw new Error('Falta VITE_SUPABASE_ANON_KEY.');

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.msg ?? payload?.message ?? 'No se pudo iniciar sesion en Supabase.');
  }
  return payload as AuthResponse;
}

export function getSupabaseSession(): SupabaseSession | undefined {
  return getStoredSession();
}

export async function signInSupabase(email: string, password: string): Promise<SupabaseSession> {
  const payload = await authRequest('/auth/v1/token?grant_type=password', { email, password });
  return saveAuthResponse(payload);
}

export async function getSupabaseAccessToken(): Promise<string | undefined> {
  const session = getStoredSession();
  if (!session) return undefined;
  if (session.expires_at > Date.now() + 60_000) return session.access_token;

  try {
    const payload = await authRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    return saveAuthResponse(payload).access_token;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return undefined;
  }
}

export function signOutSupabase(): void {
  localStorage.removeItem(SESSION_KEY);
}
