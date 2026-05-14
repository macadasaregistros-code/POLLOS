import { db } from './localDbService';
import type { SupabaseSession } from './supabaseAuthService';
import type { Role, Usuario } from '../types/entities';

const USER_KEY = 'pollos.currentUserId';

export async function getCurrentUser(): Promise<Usuario> {
  const savedId = localStorage.getItem(USER_KEY) ?? 'user_galponero';
  const user = await db.usuarios.get(savedId);
  if (user?.Activo) return user;
  const fallback = await db.usuarios.where('Rol').equals('GALPONERO').first();
  if (!fallback) throw new Error('No hay usuarios locales configurados.');
  localStorage.setItem(USER_KEY, fallback.UsuarioID);
  return fallback;
}

export async function switchRole(role: Role): Promise<Usuario> {
  const user = await db.usuarios.where('Rol').equals(role).and((item) => item.Activo).first();
  if (!user) throw new Error(`No existe usuario activo con rol ${role}.`);
  localStorage.setItem(USER_KEY, user.UsuarioID);
  return user;
}

function readSessionRole(session: SupabaseSession): Role {
  const metadataRole = session.user.user_metadata?.pollos_role ?? session.user.app_metadata?.pollos_role;
  return metadataRole === 'GALPONERO' ? 'GALPONERO' : 'ADMIN';
}

export async function getOrCreateSupabaseUser(session: SupabaseSession): Promise<Usuario> {
  const email = session.user.email ?? '';
  const users = email ? await db.usuarios.toArray() : [];
  const existing = users.find((item) => item.Email.toLowerCase() === email.toLowerCase());
  const user: Usuario = {
    UsuarioID: existing?.UsuarioID ?? `supabase_${session.user.id}`,
    Nombre: existing?.Nombre ?? email.split('@')[0] ?? 'Usuario POLLOS',
    Email: existing?.Email ?? email,
    Rol: existing?.Rol ?? readSessionRole(session),
    Activo: true,
    PuedeEditarHastaMinutos: existing?.PuedeEditarHastaMinutos ?? 999999,
  };
  await db.usuarios.put(user);
  localStorage.setItem(USER_KEY, user.UsuarioID);
  return user;
}

export function canSeeAdminData(user: Usuario | undefined): boolean {
  return user?.Rol === 'ADMIN';
}

export function canEditRecord(user: Usuario, createdAtISO: string): boolean {
  if (user.Rol === 'ADMIN') return true;
  const created = new Date(createdAtISO).getTime();
  return Date.now() - created <= user.PuedeEditarHastaMinutos * 60_000;
}
