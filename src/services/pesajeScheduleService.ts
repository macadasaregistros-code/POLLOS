import type { ActividadLote, ActividadProgramada } from '../types/entities';

export const pesajeLoteDays = [8, 15, 22, 29, 36, 43] as const;

export function getPesajeTemplateId(day: number): string {
  return `act_lote_pesaje_dia_${day}`;
}

export function buildPesajeActivityTemplates(): ActividadProgramada[] {
  return pesajeLoteDays.map((day) => ({
    ActividadProgramadaID: getPesajeTemplateId(day),
    NombreActividad: `Pesaje dia ${day}.`,
    Categoria: 'Pesaje',
    TipoFrecuencia: 'SEGUN_DIA_LOTE',
    DiaLote: day,
    HoraSugerida: '',
    AplicaDesdeDia: day,
    AplicaHastaDia: day,
    DiasSemana: [],
    OrdenProgramacion: day,
    RequiereDato: false,
    RequiereFoto: false,
    Activa: true,
  }));
}

export function isPesajeActivity(item: Pick<ActividadLote | ActividadProgramada, 'Categoria' | 'NombreActividad'> & { ActividadProgramadaID?: string }): boolean {
  if (item.ActividadProgramadaID?.startsWith('act_lote_pesaje_dia_')) return true;
  const text = normalizeText(`${item.Categoria} ${item.NombreActividad}`);
  return text.includes('pesaje');
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
