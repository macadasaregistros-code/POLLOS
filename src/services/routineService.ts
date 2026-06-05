import type { ActividadLote, ActividadProgramada } from '../types/entities';

export type RoutineFrequency = 'DIARIA' | 'SEMANAL' | 'MENSUAL';
export type RoutineState = 'empty' | 'pending' | 'partial' | 'done';

export interface RoutineDefinition {
  key: string;
  label: string;
  frequency: RoutineFrequency;
  suggestedHour: string;
}

export interface RoutineMatrixCell {
  date: string;
  day: number;
  activityIds: string[];
  total: number;
  completed: number;
  state: RoutineState;
  disabled: boolean;
}

export interface RoutineMatrixRow {
  key: string;
  name: string;
  frequency: RoutineFrequency;
  cells: RoutineMatrixCell[];
}

export interface RoutineMatrixModel {
  month: string;
  days: number[];
  rows: RoutineMatrixRow[];
}

export const routineDefinitions: RoutineDefinition[] = [
  { key: 'fumigacion_diaria_4pm', label: 'Fumigacion diaria 4pm', frequency: 'DIARIA', suggestedHour: '16:00' },
  { key: 'cambio_diario_pediluvios', label: 'Cambio diario de pediluvios', frequency: 'DIARIA', suggestedHour: '08:30' },
  { key: 'purgar_linea_diario', label: 'Purgar linea diario', frequency: 'DIARIA', suggestedHour: '08:00' },
  { key: 'revolcar_cama', label: 'Revolcar cama', frequency: 'DIARIA', suggestedHour: '10:00' },
  { key: 'limpiar_malla_telaranas', label: 'Limpiar malla y telaranas', frequency: 'SEMANAL', suggestedHour: '' },
  { key: 'barrer_bodegas', label: 'Barrer bodegas', frequency: 'SEMANAL', suggestedHour: '' },
  { key: 'lavar_filtros', label: 'Lavar filtros', frequency: 'SEMANAL', suggestedHour: '' },
];

export const routineFrequencyLabels: Record<RoutineFrequency, string> = {
  DIARIA: 'Diaria',
  SEMANAL: 'Semanal',
  MENSUAL: 'Mensual',
};

export function isRoutineActivity(actividad: Pick<ActividadLote, 'NombreActividad' | 'Categoria'>): boolean {
  return Boolean(getRoutineDefinition(actividad)) || normalizeText(actividad.Categoria).includes('rutina');
}

export function isRoutineTemplate(template: Pick<ActividadProgramada, 'NombreActividad' | 'Categoria'>): boolean {
  return Boolean(getRoutineDefinition(template)) || normalizeText(template.Categoria).includes('rutina');
}

export function getRoutineDefinition(item: Pick<ActividadProgramada | ActividadLote, 'NombreActividad' | 'Categoria'>): RoutineDefinition | undefined {
  const text = normalizeText(`${item.Categoria} ${item.NombreActividad}`);
  if (text.includes('fumigacion diaria') || text.includes('fumigacion diaria 4pm')) return routineDefinitions[0];
  if (text.includes('pediluvio')) return routineDefinitions[1];
  if (text.includes('purgar linea diario')) return routineDefinitions[2];
  if (text.includes('revolcar cama')) return routineDefinitions[3];
  if (text.includes('limpiar malla') || text.includes('telarana')) return routineDefinitions[4];
  if (text.includes('barrer bodega')) return routineDefinitions[5];
  if (text.includes('lavar filtro')) return routineDefinitions[6];
  return undefined;
}

export function getRoutineFrequency(item: Pick<ActividadProgramada, 'TipoFrecuencia' | 'NombreActividad' | 'Categoria'>): RoutineFrequency {
  const definition = getRoutineDefinition(item);
  if (definition) return definition.frequency;
  if (item.TipoFrecuencia === 'MENSUAL') return 'MENSUAL';
  if (item.TipoFrecuencia === 'SEMANAL') return 'SEMANAL';
  return 'DIARIA';
}

export function getRoutineFrequencyFromActivities(activities: ActividadLote[], name: string): RoutineFrequency {
  const definition = getRoutineDefinition({ NombreActividad: name, Categoria: 'Rutina' });
  if (definition) return definition.frequency;
  const uniqueDates = [...new Set(activities.map((actividad) => actividad.FechaProgramada))].sort();
  if (uniqueDates.length <= 1) return 'MENSUAL';
  if (uniqueDates.length >= 15) return 'DIARIA';
  return 'SEMANAL';
}

export function buildRoutineMatrix(activities: ActividadLote[], today: string, month = today.slice(0, 7)): RoutineMatrixModel {
  const routineActivities = activities.filter(isRoutineActivity).filter((actividad) => actividad.FechaProgramada.startsWith(month));
  const days = Array.from({ length: getDaysInMonth(month) }, (_, index) => index + 1);
  const byName = groupBy(routineActivities, (actividad) => getRoutineDefinition(actividad)?.label ?? cleanActivityName(actividad.NombreActividad));
  const rows: RoutineMatrixRow[] = [...byName.entries()]
    .map(([name, rowActivities]) => ({
      key: normalizeText(name).replace(/[^a-z0-9]+/g, '_'),
      name,
      frequency: getRoutineFrequencyFromActivities(rowActivities, name),
      cells: days.map((day): RoutineMatrixCell => {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const cellActivities = rowActivities.filter((actividad) => actividad.FechaProgramada === date && actividad.Estado !== 'NO_APLICA');
        const completed = cellActivities.filter((actividad) => actividad.Estado === 'REALIZADA').length;
        return {
          date,
          day,
          activityIds: cellActivities.map((actividad) => actividad.ActividadLoteID),
          total: cellActivities.length,
          completed,
          state: getCellState(cellActivities.length, completed),
          disabled: date > today || cellActivities.length === 0,
        };
      }),
    }))
    .sort((left, right) => frequencyOrder(left.frequency) - frequencyOrder(right.frequency) || left.name.localeCompare(right.name));

  return { month, days, rows };
}

export function cleanActivityName(value: string): string {
  return value.replace(/\.$/, '').trim();
}

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getCellState(total: number, completed: number): RoutineState {
  if (total === 0) return 'empty';
  if (completed === 0) return 'pending';
  if (completed < total) return 'partial';
  return 'done';
}

function getDaysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function frequencyOrder(frequency: RoutineFrequency): number {
  if (frequency === 'DIARIA') return 0;
  if (frequency === 'SEMANAL') return 1;
  return 2;
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, T[]>());
}
