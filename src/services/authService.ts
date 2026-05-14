import { db } from './localDbService';
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

export function canSeeAdminData(user: Usuario | undefined): boolean {
  return user?.Rol === 'ADMIN';
}

export function canEditRecord(user: Usuario, createdAtISO: string): boolean {
  if (user.Rol === 'ADMIN') return true;
  const created = new Date(createdAtISO).getTime();
  return Date.now() - created <= user.PuedeEditarHastaMinutos * 60_000;
}
