import type { ActividadLote, ActividadProgramada } from '../types/entities';
import { isRoutineActivity, isRoutineTemplate, normalizeText } from './routineService';

export type ProgramacionCategoryKey = 'daily' | 'lote' | 'routine' | 'prep' | 'other';
export type AgendaTone = 'daily' | 'lote' | 'routine' | 'prep' | 'dog' | 'vaccine';

export interface ProgramacionCategory {
  key: ProgramacionCategoryKey;
  label: string;
  order: number;
}

export const programacionCategories: ProgramacionCategory[] = [
  { key: 'daily', label: 'Registro diario', order: 0 },
  { key: 'lote', label: 'Actividades del lote', order: 1 },
  { key: 'routine', label: 'Rutinas', order: 2 },
  { key: 'prep', label: 'Alistamiento', order: 3 },
  { key: 'other', label: 'Perros / otros', order: 4 },
];

const categoryOrder = new Map(programacionCategories.map((category) => [category.key, category.order]));

const agendaToneCategory: Record<AgendaTone, ProgramacionCategoryKey> = {
  daily: 'daily',
  lote: 'lote',
  routine: 'routine',
  prep: 'prep',
  dog: 'other',
  vaccine: 'other',
};

export function getProgramacionCategoryOrder(category: ProgramacionCategoryKey): number {
  return categoryOrder.get(category) ?? programacionCategories.length;
}

export function getAgendaToneOrder(tone: AgendaTone): number {
  return getProgramacionCategoryOrder(agendaToneCategory[tone]);
}

export function getProgramacionTemplateCategory(template: ActividadProgramada): ProgramacionCategoryKey {
  if (isRoutineTemplate(template)) return 'routine';
  if (isVaccineLike(template)) return 'other';
  if (isPreparationLike(template)) return 'prep';
  return 'lote';
}

export function getProgramacionActivityCategory(actividad: ActividadLote): ProgramacionCategoryKey {
  if (isRoutineActivity(actividad)) return 'routine';
  if (isVaccineLike(actividad)) return 'other';
  if (isPreparationLike(actividad)) return 'prep';
  if (actividad.LoteID) return 'lote';
  return 'other';
}

export function isPreparationLike(item: Pick<ActividadProgramada | ActividadLote, 'Categoria' | 'NombreActividad' | 'DiaLote'>): boolean {
  const text = normalizeText(`${item.Categoria} ${item.NombreActividad}`);
  return ['retiro', 'desinfeccion', 'instalacion', 'recibimiento', 'alistamiento'].some((word) => text.includes(word)) || item.DiaLote <= 0;
}

export function isVaccineLike(item: Pick<ActividadProgramada | ActividadLote, 'Categoria' | 'NombreActividad'>): boolean {
  const text = normalizeText(`${item.Categoria} ${item.NombreActividad}`);
  return text.includes('vacuna') || text.includes('vacunacion');
}
