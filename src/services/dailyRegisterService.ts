import { addDays } from '../lib/date';
import type { FechaISO, RegistroDiarioLote } from '../types/entities';

export function getMissingDailyRegisterDates(
  fechaInicio: FechaISO,
  fechaHasta: FechaISO,
  registros: Pick<RegistroDiarioLote, 'Fecha'>[],
): FechaISO[] {
  if (!fechaInicio || !fechaHasta || fechaHasta < fechaInicio) return [];

  const recordedDates = new Set(registros.map((registro) => registro.Fecha));
  const missingDates: FechaISO[] = [];

  for (let date = fechaInicio; date <= fechaHasta; date = addDays(date, 1)) {
    if (!recordedDates.has(date)) missingDates.push(date);
  }

  return missingDates;
}

export function getNextRequiredDailyRegisterDate(
  fechaInicio: FechaISO,
  registros: Pick<RegistroDiarioLote, 'Fecha'>[],
  today: FechaISO,
): FechaISO | undefined {
  return getMissingDailyRegisterDates(fechaInicio, today, registros)[0];
}
