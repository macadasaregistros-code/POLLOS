import type { FechaISO } from '../types/entities';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function todayISO(): FechaISO {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(dateISO: FechaISO, days: number): FechaISO {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffDays(fromISO: FechaISO, toISO: FechaISO = todayISO()): number {
  const from = new Date(`${fromISO}T00:00:00`).getTime();
  const to = new Date(`${toISO}T00:00:00`).getTime();
  return Math.floor((to - from) / MS_PER_DAY);
}

export function getDiaLote(fechaLlegada: FechaISO, fecha: FechaISO = todayISO()): number {
  return Math.max(1, diffDays(fechaLlegada, fecha) + 1);
}

export function getSemanaLote(diaLote: number): number {
  return Math.max(1, Math.ceil(diaLote / 7));
}

export function minutesSince(dateTimeISO: string): number {
  return (Date.now() - new Date(dateTimeISO).getTime()) / 60000;
}
