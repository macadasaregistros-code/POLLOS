import type { FechaISO } from '../types/entities';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const COLOMBIA_TIME_ZONE = 'America/Bogota';
const COLOMBIA_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: COLOMBIA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayISO(): FechaISO {
  const parts = COLOMBIA_DATE_FORMATTER.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDays(dateISO: FechaISO, days: number): FechaISO {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function diffDays(fromISO: FechaISO, toISO: FechaISO = todayISO()): number {
  const [fromYear, fromMonth, fromDay] = fromISO.split('-').map(Number);
  const [toYear, toMonth, toDay] = toISO.split('-').map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
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
