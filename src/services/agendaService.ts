import { addDays, getDiaLote } from '../lib/date';
import { getNextPrepTask } from './preparationService';
import type { ActividadLote, Galpon, Lote, LoteGalpon, Perro, RegistroDiarioLote, VacunaLote } from '../types/entities';

export type AgendaRecordKind = 'vacunacion' | 'agua' | 'plagas' | 'medicamento' | 'compostaje' | 'perros' | 'capacitacion';
export type AgendaDogRecordType = 'RABIA' | 'DESPARASITACION';

export interface AgendaRecordContext {
  vacunaId?: string;
  perroId?: string;
  dogType?: AgendaDogRecordType;
  activityIds?: string[];
  galponId?: string;
  loteId?: string;
}

export type AgendaAction =
  | { type: 'daily'; loteId: string }
  | { type: 'record'; kind: AgendaRecordKind; context: AgendaRecordContext }
  | { type: 'completeActivities'; activityIds: string[] }
  | { type: 'prep'; galponId: string };

export interface AgendaTask {
  id: string;
  title: string;
  detail: string;
  meta: string;
  tone: 'daily' | 'activity' | 'vaccine' | 'dog' | 'prep';
  date: string;
  action: AgendaAction;
}

export interface AgendaModel {
  hoy: AgendaTask[];
  proximas: AgendaTask[];
  pendientes: AgendaTask[];
}

export interface BuildAgendaInput {
  today: string;
  lotes: Lote[];
  registros: RegistroDiarioLote[];
  loteGalpones: LoteGalpon[];
  galpones: Galpon[];
  actividades: ActividadLote[];
  vacunas: VacunaLote[];
  perros: Perro[];
}

export function buildAgenda(input: BuildAgendaInput): AgendaModel {
  const nextLimit = addDays(input.today, 5);
  const activeLotes = input.lotes.filter((lote) => lote.EstadoLote === 'ACTIVO');
  const activeAssignments = input.loteGalpones.filter((assignment) => assignment.Estado === 'ACTIVO');
  const galponNamesById = new Map(input.galpones.map((galpon) => [galpon.GalponID, galpon.NombreGalpon]));
  const hoy: AgendaTask[] = [];
  const proximas: AgendaTask[] = [];
  const pendientes: AgendaTask[] = [];

  for (const lote of activeLotes) {
    const hasDailyRecord = input.registros.some((registro) => registro.LoteID === lote.LoteID && registro.Fecha === input.today);
    if (!hasDailyRecord) {
      const galpones = activeAssignments
        .filter((assignment) => assignment.LoteID === lote.LoteID)
        .map((assignment) => galponNamesById.get(assignment.GalponID) ?? assignment.GalponID);
      hoy.push({
        id: `daily:${lote.LoteID}`,
        title: `Registro diario ${lote.CodigoLote}`,
        detail: galpones.length ? `Galpones ${galpones.join(', ')}` : `Dia ${getDiaLote(lote.FechaLlegada, input.today)}`,
        meta: 'Falta hoy',
        tone: 'daily',
        date: input.today,
        action: { type: 'daily', loteId: lote.LoteID },
      });
    }
  }

  const todayActivities = input.actividades.filter(
    (actividad) =>
      actividad.FechaProgramada === input.today &&
      (actividad.Estado === 'PENDIENTE' || actividad.Estado === 'VENCIDA') &&
      !isVaccineActivity(actividad),
  );
  const pestActivities = todayActivities.filter(isPestActivity);
  const waterActivities = todayActivities.filter(isWaterActivity);
  const regularActivities = todayActivities.filter((actividad) => !isPestActivity(actividad) && !isWaterActivity(actividad));

  if (pestActivities.length) {
    hoy.push(buildRecordTask('plagas', 'Control de plagas', pestActivities, 'activity'));
  }
  if (waterActivities.length) {
    hoy.push(buildRecordTask('agua', 'Tratamiento de agua', waterActivities, 'activity'));
  }

  for (const [category, activities] of groupBy(regularActivities, (actividad) => actividad.Categoria || 'Actividad')) {
    hoy.push({
      id: `activities:${category}:${activities.map((actividad) => actividad.ActividadLoteID).join('|')}`,
      title: category,
      detail: activities.length === 1 ? activities[0].NombreActividad : `${activities.length} actividades programadas`,
      meta: 'Marcar al completar',
      tone: 'activity',
      date: input.today,
      action: { type: 'completeActivities', activityIds: activities.map((actividad) => actividad.ActividadLoteID) },
    });
  }

  for (const vacuna of input.vacunas.filter(isPendingVaccine)) {
    const task = {
      id: `vaccine:${vacuna.VacunaLoteID}`,
      title: `Vacuna ${vacuna.NombreVacuna}`,
      detail: `Lote ${vacuna.LoteID} · dia ${vacuna.DiaProgramado}`,
      meta: vacuna.FechaProgramada,
      tone: 'vaccine' as const,
      date: vacuna.FechaProgramada,
      action: { type: 'record' as const, kind: 'vacunacion' as const, context: { vacunaId: vacuna.VacunaLoteID, loteId: vacuna.LoteID, galponId: vacuna.GalponID } },
    };
    if (vacuna.FechaProgramada < input.today) pendientes.push({ ...task, meta: `Vencida ${vacuna.FechaProgramada}` });
    else if (vacuna.FechaProgramada === input.today) hoy.push({ ...task, meta: 'Toca hoy' });
    else if (vacuna.FechaProgramada <= nextLimit) proximas.push(task);
  }

  for (const perro of input.perros.filter((item) => item.Activo)) {
    for (const dogTask of buildDogTasks(perro, input.today, nextLimit)) {
      if (dogTask.date < input.today) pendientes.push(dogTask);
      else if (dogTask.date === input.today) hoy.push(dogTask);
      else proximas.push(dogTask);
    }
  }

  for (const galpon of input.galpones.filter((item) => item.Activo)) {
    const occupied = activeAssignments.some((assignment) => assignment.GalponID === galpon.GalponID);
    const task = occupied ? undefined : getNextPrepTask(galpon);
    if (!task) continue;
    hoy.push({
      id: `prep:${galpon.GalponID}:${task.id}`,
      title: `Alistamiento galpon ${galpon.NombreGalpon}`,
      detail: task.title,
      meta: 'Actividad actual',
      tone: 'prep',
      date: input.today,
      action: { type: 'prep', galponId: galpon.GalponID },
    });
  }

  return {
    hoy: sortTasks(hoy),
    proximas: sortTasks(proximas),
    pendientes: sortTasks(pendientes),
  };
}

export function getDogNextDate(perro: Perro, type: AgendaDogRecordType): string {
  if (type === 'RABIA') return perro.FechaUltimaRabia ? addDays(perro.FechaUltimaRabia, perro.FrecuenciaRabiaDias || 365) : '';
  return perro.FechaUltimaDesparasitacion ? addDays(perro.FechaUltimaDesparasitacion, perro.FrecuenciaDesparasitacionDias || 90) : '';
}

function buildRecordTask(kind: AgendaRecordKind, title: string, activities: ActividadLote[], tone: AgendaTask['tone']): AgendaTask {
  const first = activities[0];
  return {
    id: `${kind}:${activities.map((actividad) => actividad.ActividadLoteID).join('|')}`,
    title,
    detail: activities.length === 1 ? first.NombreActividad : `${activities.length} actividades relacionadas`,
    meta: 'Registrar evidencia',
    tone,
    date: first.FechaProgramada,
    action: {
      type: 'record',
      kind,
      context: {
        activityIds: activities.map((actividad) => actividad.ActividadLoteID),
        loteId: first.LoteID,
        galponId: first.GalponID,
      },
    },
  };
}

function buildDogTasks(perro: Perro, today: string, nextLimit: string): AgendaTask[] {
  return (['RABIA', 'DESPARASITACION'] as const)
    .map((type) => {
      const date = getDogNextDate(perro, type) || today;
      return {
        id: `dog:${perro.PerroID}:${type}`,
        title: type === 'RABIA' ? `Rabia ${perro.NombrePerro}` : `Desparasitar ${perro.NombrePerro}`,
        detail: 'Perros de la finca',
        meta: date < today ? `Vencida ${date}` : date === today ? 'Toca hoy' : date,
        tone: 'dog' as const,
        date,
        action: { type: 'record' as const, kind: 'perros' as const, context: { perroId: perro.PerroID, dogType: type } },
      };
    })
    .filter((task) => task.date <= nextLimit);
}

function isPendingVaccine(vacuna: VacunaLote): boolean {
  return vacuna.Estado !== 'APLICADA' && vacuna.Estado !== 'NO_APLICADA';
}

function isVaccineActivity(actividad: ActividadLote): boolean {
  const text = normalize(`${actividad.Categoria} ${actividad.NombreActividad}`);
  return text.includes('vacuna') || text.includes('vacunacion');
}

function isPestActivity(actividad: ActividadLote): boolean {
  const text = normalize(`${actividad.Categoria} ${actividad.NombreActividad}`);
  return ['plaga', 'roedor', 'mosca', 'cipermetrina'].some((word) => text.includes(word));
}

function isWaterActivity(actividad: ActividadLote): boolean {
  const text = normalize(`${actividad.Categoria} ${actividad.NombreActividad}`);
  return ['agua', 'cloro', 'ph', 'acuades', 'purgar linea', 'tanque'].some((word) => text.includes(word));
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, T[]>());
}

function sortTasks(tasks: AgendaTask[]): AgendaTask[] {
  const toneOrder: Record<AgendaTask['tone'], number> = { daily: 0, vaccine: 1, dog: 2, prep: 3, activity: 4 };
  return tasks.slice().sort((left, right) => left.date.localeCompare(right.date) || toneOrder[left.tone] - toneOrder[right.tone] || left.title.localeCompare(right.title));
}
