import type { ActividadLote, ActividadProgramada } from '../types/entities';

export type RoutineFrequency = 'DIARIA' | 'SEMANAL' | 'MENSUAL';
export type RoutineState = 'empty' | 'pending' | 'partial' | 'done';

export interface RoutineDefinition {
  key: string;
  label: string;
  frequency: RoutineFrequency;
  suggestedHour: string;
  aliases: string[];
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
  { key: 'clorar_tanque', label: 'Clorar tanque principal cada 3 días', frequency: 'DIARIA', suggestedHour: '', aliases: ['clorar tanque principal'] },
  { key: 'sulfatar_tanque', label: 'Sulfatar tanque 24 horas antes de clorar', frequency: 'DIARIA', suggestedHour: '', aliases: ['sulfatar tanque'] },
  { key: 'medir_cloro_ph', label: 'Medir cloro y pH en líneas y tanques', frequency: 'DIARIA', suggestedHour: '08:00', aliases: ['medir cloro y ph'] },
  { key: 'purgar_linea', label: 'Purgar línea', frequency: 'DIARIA', suggestedHour: '08:00', aliases: ['purgar linea'] },
  { key: 'alimentacion_manana', label: 'Alimentación mañana 70%', frequency: 'DIARIA', suggestedHour: '05:00', aliases: ['alimentacion manana 70'] },
  { key: 'alimentacion_tarde', label: 'Alimentación tarde 30%', frequency: 'DIARIA', suggestedHour: '15:00', aliases: ['alimentacion tarde 30'] },
  { key: 'fumigacion_9am', label: 'Fumigación con desinfectante 9am', frequency: 'DIARIA', suggestedHour: '09:00', aliases: ['fumigacion con desinfectante dentro del galpon 9am'] },
  { key: 'fumigacion_4pm', label: 'Fumigación con desinfectante 4pm', frequency: 'DIARIA', suggestedHour: '16:00', aliases: ['fumigacion con desinfectante dentro del galpon 4pm', 'fumigacion diaria 4pm'] },
  { key: 'revolcar_cama', label: 'Revolcar cama', frequency: 'DIARIA', suggestedHour: '10:00', aliases: ['revolcar cama'] },
  { key: 'control_pediluvios', label: 'Control de pediluvios con creolina', frequency: 'DIARIA', suggestedHour: '08:30', aliases: ['pediluvio'] },
  { key: 'control_plagas', label: 'Control de plagas con Cicario / Cipermetrina', frequency: 'DIARIA', suggestedHour: '17:00', aliases: ['control de plagas con cicario', 'control de plagas con cipermetrina', 'control de mosca con cipermetrina'] },
  { key: 'limpiar_mallas_telaranas', label: 'Limpiar mallas y telarañas', frequency: 'SEMANAL', suggestedHour: '', aliases: ['limpiar malla', 'limpiar mallas', 'telarana'] },
  { key: 'lavar_filtros', label: 'Lavar filtros', frequency: 'SEMANAL', suggestedHour: '', aliases: ['lavar filtro'] },
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
  return routineDefinitions.find((definition) =>
    [definition.label, ...definition.aliases].some((alias) => text.includes(normalizeText(alias))),
  );
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
