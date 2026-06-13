import type { Galpon } from '../types/entities';

export type PrepCategoryKey = 'RETIRO' | 'DESINFECCION' | 'INSTALACION' | 'RECIBIMIENTO';

export interface PrepTask {
  id: string;
  title: string;
  category: PrepCategoryKey;
}

export interface PrepTaskCompletion {
  id: string;
  fecha: string;
}

const PREP_PROGRESS_MARKER = '[[POLLOS_PREP_PROGRESS:';
const PREP_PROGRESS_END = ']]';

export const preparationCategories: Array<{ key: PrepCategoryKey; label: string; state: Galpon['EstadoActual']; tasks: PrepTask[] }> = [
  {
    key: 'RETIRO',
    label: 'Retiro',
    state: 'LIMPIEZA',
    tasks: [
      { id: 'recoger_equipo', title: 'Recoger Equipo (Bebederos y Comederos)', category: 'RETIRO' },
      { id: 'lavar_equipo', title: 'Lavar Equipo (Bebederos / Comederos)', category: 'RETIRO' },
      { id: 'barrer_pluma', title: 'Barrer Pluma', category: 'RETIRO' },
      { id: 'sacar_caracha', title: 'Sacar Caracha', category: 'RETIRO' },
      { id: 'amontonar_pollinaza', title: 'Amontonar pollinaza 8 días y registrar temperatura interna', category: 'RETIRO' },
      { id: 'retiro_pollinaza', title: 'Retiro de Pollinaza Reusada en Exceso', category: 'RETIRO' },
    ],
  },
  {
    key: 'DESINFECCION',
    label: 'Desinfeccion',
    state: 'DESCANSO_SANITARIO',
    tasks: [
      { id: 'fumiga_coquito_1', title: 'Fumiga Coquito 1', category: 'DESINFECCION' },
      { id: 'fumiga_coquito_2', title: 'Fumiga Coquito 2', category: 'DESINFECCION' },
      { id: 'barrer_lavado_galpon', title: 'Barrer / Lavado Galpon', category: 'DESINFECCION' },
      { id: 'barrer_malla_techo', title: 'Barrer malla y limpiar techo', category: 'DESINFECCION' },
      { id: 'reparaciones_locativas', title: 'Reparaciones locativas', category: 'DESINFECCION' },
      { id: 'lavar_tanques_purgar', title: 'Lavar tanques de agua y purgar lineas', category: 'DESINFECCION' },
      { id: 'calear', title: 'Calear', category: 'DESINFECCION' },
      { id: 'fumiga_desinfectante', title: 'Fumiga Desinfectante', category: 'DESINFECCION' },
    ],
  },
  {
    key: 'INSTALACION',
    label: 'Instalacion',
    state: 'PREPARACION',
    tasks: [
      { id: 'cisco_nuevo', title: 'Cisco Nuevo (en la mitad sin cama usada)', category: 'INSTALACION' },
      { id: 'divisiones', title: 'Divisiones', category: 'INSTALACION' },
      { id: 'instalar_calentadoras', title: 'Instalar Calentadoras', category: 'INSTALACION' },
      { id: 'bebederos_comederos_babies', title: 'Meter Bebederos de Volteo y Comederos Babies', category: 'INSTALACION' },
      { id: 'encortinar', title: 'Encortinar', category: 'INSTALACION' },
    ],
  },
  {
    key: 'RECIBIMIENTO',
    label: 'Recibimiento',
    state: 'RECIBIMIENTO',
    tasks: [
      { id: 'precalentar', title: 'Precalentar 8h antes de la llegada (32 grados)', category: 'RECIBIMIENTO' },
      { id: 'purgar_lineas', title: 'Purgar Lineas', category: 'RECIBIMIENTO' },
      { id: 'neutrar_agua', title: 'Neutrar el Agua de Bebida', category: 'RECIBIMIENTO' },
      { id: 'verificar_temperatura', title: 'Verificar Temperatura', category: 'RECIBIMIENTO' },
      { id: 'llegada_pollito', title: 'Llegada del Pollito', category: 'RECIBIMIENTO' },
    ],
  },
];

export const preparationTasks = preparationCategories.flatMap((category) => category.tasks);

export function getCompletedPrepTaskRecords(galpon: Galpon): PrepTaskCompletion[] {
  const markerIndex = galpon.Observaciones.indexOf(PREP_PROGRESS_MARKER);
  if (markerIndex >= 0) {
    const start = markerIndex + PREP_PROGRESS_MARKER.length;
    const end = galpon.Observaciones.indexOf(PREP_PROGRESS_END, start);
    if (end > start) {
      try {
        const parsed = JSON.parse(galpon.Observaciones.slice(start, end)) as { completedTasks?: PrepTaskCompletion[]; completedTaskIds?: string[] };
        if (parsed.completedTasks) return normalizePrepTaskRecords(parsed.completedTasks);
        return normalizePrepTaskRecords((parsed.completedTaskIds ?? []).map((id) => ({ id, fecha: '' })));
      } catch {
        return [];
      }
    }
  }

  return normalizePrepTaskRecords(getCompletedPrepTaskIdsFromState(galpon.EstadoActual).map((id) => ({ id, fecha: '' })));
}

export function getCompletedPrepTaskIds(galpon: Galpon): string[] {
  return getCompletedPrepTaskRecords(galpon).map((record) => record.id);
}

export function getNextPrepTask(galpon: Galpon): PrepTask | undefined {
  const completed = new Set(getCompletedPrepTaskIds(galpon));
  return preparationTasks.find((task) => !completed.has(task.id));
}

export function normalizePrepTaskIds(ids: string[]): string[] {
  const unique = new Set(ids);
  return preparationTasks.filter((task) => unique.has(task.id)).map((task) => task.id);
}

export function normalizePrepTaskRecords(records: PrepTaskCompletion[]): PrepTaskCompletion[] {
  const byId = new Map(records.map((record) => [record.id, record.fecha]));
  return preparationTasks
    .filter((task) => byId.has(task.id))
    .map((task) => ({ id: task.id, fecha: byId.get(task.id) ?? '' }));
}

export function writePrepProgress(observaciones: string, completedTaskIds: string[]): string {
  return writePrepProgressRecords(
    observaciones,
    completedTaskIds.map((id) => ({ id, fecha: '' })),
  );
}

export function writePrepProgressRecords(observaciones: string, completedTasks: PrepTaskCompletion[]): string {
  const normalized = normalizePrepTaskRecords(completedTasks);
  const visibleObservaciones = stripPrepProgress(observaciones);
  const marker = `${PREP_PROGRESS_MARKER}${JSON.stringify({ completedTasks: normalized, completedTaskIds: normalized.map((task) => task.id) })}${PREP_PROGRESS_END}`;
  return visibleObservaciones ? `${visibleObservaciones}\n${marker}` : marker;
}

export function getGalponStateForPrepProgress(completedTaskIds: string[]): Galpon['EstadoActual'] {
  if (completedTaskIds.length === 0) return 'VACIO';
  const completedSet = new Set(completedTaskIds);
  const activeCategory = preparationCategories.find((category) => category.tasks.some((task) => !completedSet.has(task.id)));
  return activeCategory?.state ?? 'RECIBIMIENTO';
}

function getCompletedPrepTaskIdsFromState(state: Galpon['EstadoActual']): string[] {
  if (state === 'DESCANSO_SANITARIO') return preparationCategories[0].tasks.map((task) => task.id);
  if (state === 'PREPARACION') return preparationCategories.slice(0, 2).flatMap((category) => category.tasks.map((task) => task.id));
  if (state === 'RECIBIMIENTO') return preparationCategories.slice(0, 3).flatMap((category) => category.tasks.map((task) => task.id));
  return [];
}

function stripPrepProgress(observaciones: string): string {
  const markerIndex = observaciones.indexOf(PREP_PROGRESS_MARKER);
  if (markerIndex < 0) return observaciones;
  const end = observaciones.indexOf(PREP_PROGRESS_END, markerIndex + PREP_PROGRESS_MARKER.length);
  if (end < 0) return observaciones.slice(0, markerIndex).trim();
  return `${observaciones.slice(0, markerIndex)}${observaciones.slice(end + PREP_PROGRESS_END.length)}`.trim();
}
