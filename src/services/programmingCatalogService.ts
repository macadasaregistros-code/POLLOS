import type { ActividadLote, ActividadProgramada } from '../types/entities';
import { getRoutineOrder, isRoutineActivity, isRoutineTemplate, normalizeText } from './routineService';

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

export function getProgramacionTemplateOrder(template: ActividadProgramada): number {
  if (getProgramacionTemplateCategory(template) === 'routine') return getRoutineOrder(template);
  return typeof template.OrdenProgramacion === 'number' && Number.isFinite(template.OrdenProgramacion) ? template.OrdenProgramacion : template.DiaLote;
}

export function getProgramacionActivityOrder(actividad: ActividadLote, templates: ActividadProgramada[] = []): number {
  const template = findMatchingTemplate(actividad, templates);
  if (template) return getProgramacionTemplateOrder(template);
  if (getProgramacionActivityCategory(actividad, templates) === 'routine') return getRoutineOrder({ ...actividad, OrdenProgramacion: undefined });
  return 999;
}

export function getProgramacionTemplateCategory(template: ActividadProgramada): ProgramacionCategoryKey {
  if (isRoutineTemplate(template) || isOperationalRoutineLike(template)) return 'routine';
  if (isVaccineLike(template)) return 'other';
  if (isPreparationLike(template)) return 'prep';
  return 'lote';
}

export function getProgramacionActivityCategory(actividad: ActividadLote, templates: ActividadProgramada[] = []): ProgramacionCategoryKey {
  const template = findMatchingTemplate(actividad, templates);
  if (template) return getProgramacionTemplateCategory(template);
  if (isRoutineActivity(actividad) || isOperationalRoutineLike(actividad)) return 'routine';
  if (isVaccineLike(actividad)) return 'other';
  if (isPreparationLike(actividad)) return 'prep';
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

export function isWaterRoutineLike(item: Pick<ActividadProgramada | ActividadLote, 'Categoria' | 'NombreActividad'>): boolean {
  const text = normalizeText(`${item.Categoria} ${item.NombreActividad}`);
  return ['agua', 'cloro', 'ph', 'acuades', 'purgar linea', 'tanque'].some((word) => text.includes(word));
}

export function isPestRoutineLike(item: Pick<ActividadProgramada | ActividadLote, 'Categoria' | 'NombreActividad'>): boolean {
  const text = normalizeText(`${item.Categoria} ${item.NombreActividad}`);
  return ['plaga', 'roedor', 'mosca', 'cipermetrina'].some((word) => text.includes(word));
}

function isOperationalRoutineLike(item: Pick<ActividadProgramada | ActividadLote, 'Categoria' | 'NombreActividad'>): boolean {
  return isWaterRoutineLike(item) || isPestRoutineLike(item);
}

function findMatchingTemplate(actividad: ActividadLote, templates: ActividadProgramada[]): ActividadProgramada | undefined {
  const activityKey = getActivityMatchKey(actividad);
  return templates.find((template) => getActivityMatchKey(template) === activityKey);
}

function getActivityMatchKey(item: Pick<ActividadProgramada | ActividadLote, 'Categoria' | 'NombreActividad'>): string {
  return normalizeText(`${item.Categoria} ${item.NombreActividad}`).replace(/[^a-z0-9]+/g, ' ').trim();
}
