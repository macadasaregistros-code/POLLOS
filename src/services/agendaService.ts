import { addDays, getDiaLote } from '../lib/date';
import { getNextRequiredDailyRegisterDate } from './dailyRegisterService';
import { getNextPrepTask } from './preparationService';
import { getAgendaToneOrder, getProgramacionActivityCategory, getProgramacionActivityOrder, isPestRoutineLike, isWaterRoutineLike, type AgendaTone } from './programmingCatalogService';
import { cleanActivityName, getRoutineDefinition } from './routineService';
import type { ActividadLote, ActividadProgramada, Galpon, Lote, LoteGalpon, Perro, RegistroDiarioLote, VacunaLote } from '../types/entities';

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
  tone: AgendaTone;
  date: string;
  order?: number;
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
  actividadesProgramadas: ActividadProgramada[];
  vacunas: VacunaLote[];
  perros: Perro[];
}

export function buildAgenda(input: BuildAgendaInput): AgendaModel {
  const nextLimit = addDays(input.today, 5);
  const activeLotes = input.lotes.filter((lote) => lote.EstadoLote === 'ACTIVO');
  const activeAssignments = input.loteGalpones.filter((assignment) => assignment.Estado === 'ACTIVO');
  const galponNamesById = new Map(input.galpones.map((galpon) => [galpon.GalponID, galpon.NombreGalpon]));
  const lotesById = new Map(input.lotes.map((lote) => [lote.LoteID, lote]));
  const hoy: AgendaTask[] = [];
  const proximas: AgendaTask[] = [];
  const pendientes: AgendaTask[] = [];

  for (const lote of activeLotes) {
    const loteRecords = input.registros.filter((registro) => registro.LoteID === lote.LoteID);
    const nextDailyDate = getNextRequiredDailyRegisterDate(lote.FechaLlegada, loteRecords, input.today);
    if (nextDailyDate) {
      const galpones = activeAssignments
        .filter((assignment) => assignment.LoteID === lote.LoteID)
        .map((assignment) => galponNamesById.get(assignment.GalponID) ?? assignment.GalponID);
      const dailyTask: AgendaTask = {
        id: `daily:${lote.LoteID}`,
        title: `Registro diario ${lote.CodigoLote}`,
        detail: galpones.length ? `Fecha ${nextDailyDate} - Galpones ${galpones.join(', ')}` : `Dia ${getDiaLote(lote.FechaLlegada, nextDailyDate)}`,
        meta: nextDailyDate < input.today ? 'Atrasado' : 'Falta hoy',
        tone: 'daily',
        date: nextDailyDate,
        action: { type: 'daily', loteId: lote.LoteID },
      };
      if (nextDailyDate < input.today) pendientes.push(dailyTask);
      else hoy.push(dailyTask);
    }
  }

  const activeLoteIds = new Set(activeLotes.map((lote) => lote.LoteID));
  const dueActivities = input.actividades.filter(
    (actividad) =>
      actividad.FechaProgramada <= input.today &&
      (actividad.Estado === 'PENDIENTE' || actividad.Estado === 'VENCIDA'),
  );
  const routineActivities = dueActivities.filter((actividad) => getProgramacionActivityCategory(actividad, input.actividadesProgramadas) === 'routine');
  const waterRoutineActivities = routineActivities.filter(isWaterRoutineLike);
  const pestRoutineActivities = routineActivities.filter((actividad) => !isWaterRoutineLike(actividad) && isPestRoutineLike(actividad));
  const routineRecordActivityIds = new Set([...waterRoutineActivities, ...pestRoutineActivities].map((actividad) => actividad.ActividadLoteID));
  const routineCheckActivities = routineActivities.filter((actividad) => !routineRecordActivityIds.has(actividad.ActividadLoteID));
  const loteActivities = selectNextLoteActivityByLote(
    dueActivities.filter((actividad) => getProgramacionActivityCategory(actividad, input.actividadesProgramadas) === 'lote' && activeLoteIds.has(actividad.LoteID)),
  );

  for (const activities of groupBy(waterRoutineActivities, getRoutineRecordGroupKey).values()) {
    addDueActivityTask(
      buildRoutineRecordTask('agua', 'Tratamiento de agua', activities, input.actividadesProgramadas),
      input.today,
      hoy,
      pendientes,
    );
  }

  for (const activities of groupBy(pestRoutineActivities, getRoutineRecordGroupKey).values()) {
    addDueActivityTask(
      buildRoutineRecordTask('plagas', 'Control de plagas', activities, input.actividadesProgramadas),
      input.today,
      hoy,
      pendientes,
    );
  }

  for (const activities of groupBy(routineCheckActivities, getRoutineGroupKey).values()) {
    addDueActivityTask(
      buildRoutineTask(activities, input.actividadesProgramadas),
      input.today,
      hoy,
      pendientes,
    );
  }

  for (const actividad of loteActivities) {
    const task = buildCompletionTask(actividad, actividad.NombreActividad, 'lote', lotesById, galponNamesById);
    hoy.push(actividad.FechaProgramada < input.today ? { ...task, meta: `Pendiente desde ${actividad.FechaProgramada}` } : task);
  }

  function getRoutineGroupKey(actividad: ActividadLote): string {
    return `${actividad.FechaProgramada}|${normalizeKey(getRoutineAgendaName(actividad))}`;
  }

  function getRoutineRecordGroupKey(actividad: ActividadLote): string {
    return actividad.FechaProgramada;
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

function addDueActivityTask(task: AgendaTask, today: string, hoy: AgendaTask[], pendientes: AgendaTask[]): void {
  if (task.date < today) {
    pendientes.push({ ...task, meta: `Vencida ${task.date}` });
    return;
  }
  hoy.push(task);
}

function buildRoutineTask(activities: ActividadLote[], templates: ActividadProgramada[]): AgendaTask {
  const first = activities[0];
  const name = getRoutineAgendaName(first);
  return {
    id: `routine:${first.FechaProgramada}:${normalizeKey(name)}`,
    title: name,
    detail: 'Rutina general de granja',
    meta: 'Toca hoy',
    tone: 'routine',
    date: first.FechaProgramada,
    order: getActivityGroupOrder(activities, templates),
    action: { type: 'completeActivities', activityIds: activities.map((actividad) => actividad.ActividadLoteID) },
  };
}

function buildRoutineRecordTask(kind: Extract<AgendaRecordKind, 'agua' | 'plagas'>, title: string, activities: ActividadLote[], templates: ActividadProgramada[]): AgendaTask {
  const first = activities[0];
  const loteIds = getUniqueNonEmptyValues(activities.map((actividad) => actividad.LoteID));
  const galponIds = getUniqueNonEmptyValues(activities.map((actividad) => actividad.GalponID));
  const context: AgendaRecordContext = {
    activityIds: activities.map((actividad) => actividad.ActividadLoteID),
  };

  if (loteIds.length === 1) context.loteId = loteIds[0];
  if (galponIds.length === 1) context.galponId = galponIds[0];

  return {
    id: `${kind}:${first.FechaProgramada}`,
    title,
    detail: 'Rutina general de granja',
    meta: 'Registrar evidencia',
    tone: 'routine',
    date: first.FechaProgramada,
    order: getActivityGroupOrder(activities, templates),
    action: { type: 'record', kind, context },
  };
}

function buildCompletionTask(
  actividad: ActividadLote,
  title: string,
  tone: AgendaTask['tone'],
  lotesById: Map<string, Lote>,
  galponNamesById: Map<string, string>,
): AgendaTask {
  return {
    id: `activity:${actividad.ActividadLoteID}`,
    title: `${getLoteLabel(actividad.LoteID, lotesById)}: ${title}`,
    detail: getActivityDetail(actividad, lotesById, galponNamesById),
    meta: 'Marcar al completar',
    tone,
    date: actividad.FechaProgramada,
    action: { type: 'completeActivities', activityIds: [actividad.ActividadLoteID] },
  };
}

function getLoteLabel(loteId: string, lotesById: Map<string, Lote>): string {
  const lote = lotesById.get(loteId);
  return lote ? `Lote ${lote.CodigoLote}` : `Lote ${loteId}`;
}

function getActivityDetail(actividad: ActividadLote, lotesById: Map<string, Lote>, galponNamesById: Map<string, string>): string {
  const galpon = galponNamesById.get(actividad.GalponID) ?? actividad.GalponID;
  const category = actividad.Categoria || 'Actividad';
  const lote = lotesById.get(actividad.LoteID);
  const diaLote = lote ? getDiaLote(lote.FechaLlegada, actividad.FechaProgramada) : actividad.DiaLote;
  return `Galpon ${galpon} - Dia ${diaLote} - ${category} - ${actividad.NombreActividad}`;
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

function getRoutineAgendaName(actividad: ActividadLote): string {
  return getRoutineDefinition(actividad)?.label ?? cleanActivityName(actividad.NombreActividad);
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizeKey(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
    return groups;
  }, new Map<string, T[]>());
}

function selectNextLoteActivityByLote(activities: ActividadLote[]): ActividadLote[] {
  return [...groupBy(activities, (actividad) => actividad.LoteID).values()]
    .map((loteActivities) =>
      loteActivities
        .slice()
        .sort(
          (left, right) =>
            left.FechaProgramada.localeCompare(right.FechaProgramada) ||
            left.DiaLote - right.DiaLote ||
            left.NombreActividad.localeCompare(right.NombreActividad),
        )[0],
    )
    .filter((actividad): actividad is ActividadLote => Boolean(actividad));
}

function getUniqueNonEmptyValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function getActivityGroupOrder(activities: ActividadLote[], templates: ActividadProgramada[]): number {
  return Math.min(...activities.map((actividad) => getProgramacionActivityOrder(actividad, templates)));
}

function sortTasks(tasks: AgendaTask[]): AgendaTask[] {
  return tasks.slice().sort((left, right) =>
    getAgendaToneOrder(left.tone) - getAgendaToneOrder(right.tone) ||
    left.date.localeCompare(right.date) ||
    (left.order ?? 999) - (right.order ?? 999) ||
    left.title.localeCompare(right.title),
  );
}
