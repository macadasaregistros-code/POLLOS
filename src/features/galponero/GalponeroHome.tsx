import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Map as MapIcon,
  Truck,
} from 'lucide-react';
import { buildGalponDashboardModel, GalponMap, GalponPremiumDashboardCard, getMaxGalponCapacity } from '../../components/GalponMap';
import { MobileCard } from '../../components/MobileCard';
import { RoutineMatrix } from '../../components/RoutineMatrix';
import { buildAgenda } from '../../services/agendaService';
import type { AgendaModel, AgendaRecordContext, AgendaTask } from '../../services/agendaService';
import { buildLoteResumen } from '../../services/calculationsService';
import { actualizarActividad, actualizarEstadoGalpon } from '../../services/domainService';
import { db } from '../../services/localDbService';
import {
  getCompletedPrepTaskRecords,
  getGalponStateForPrepProgress,
  normalizePrepTaskRecords,
  preparationCategories,
  preparationTasks,
  writePrepProgressRecords,
} from '../../services/preparationService';
import { todayISO } from '../../lib/date';
import { fmtNumber, fmtPercent } from '../../lib/format';
import type { Galpon, Lote, LoteResumen, Usuario } from '../../types/entities';
import type { MainView } from '../../types/navigation';
import { RegistrarDiaForm } from './RegistrarDiaForm';
import { GalponeroActivityRecords, GalponeroEntradaView, type ActivityRecordKind, type EntryKind } from './GalponeroRecords';

interface GalponeroHomeProps {
  user: Usuario;
  activeView: MainView;
  onViewChange: (view: MainView) => void;
  onToast: (message: string) => void;
}

const galponeroViews: MainView[] = ['actividades', 'galpones', 'entrada'];

export function GalponeroHome({ user, activeView, onViewChange, onToast }: GalponeroHomeProps) {
  const today = todayISO();
  const lotes = useLiveQuery(() => db.lotes.where('EstadoLote').equals('ACTIVO').toArray(), []);
  const registros = useLiveQuery(() => db.registroDiarioLote.toArray(), []);
  const consumos = useLiveQuery(() => db.consumosAlimentoLote.toArray(), []);
  const pesajes = useLiveQuery(() => db.pesajes.toArray(), []);
  const loteGalpones = useLiveQuery(() => db.loteGalpones.toArray(), []);
  const galpones = useLiveQuery(() => db.galpones.toArray(), []);
  const actividades = useLiveQuery(() => db.actividadesLote.toArray(), []);
  const vacunas = useLiveQuery(() => db.vacunasLote.toArray(), []);
  const perros = useLiveQuery(() => db.perros.toArray(), []);
  const syncQueue = useLiveQuery(() => db.syncQueue.toArray(), []);
  const [selectedGalponId, setSelectedGalponId] = useState('');
  const [activeDailyLoteId, setActiveDailyLoteId] = useState('');
  const [activeActivityRecord, setActiveActivityRecord] = useState<ActivityRecordKind | ''>('');
  const [activeRecordContext, setActiveRecordContext] = useState<AgendaRecordContext | undefined>();
  const [activeEntryRecord, setActiveEntryRecord] = useState<EntryKind | ''>('');
  const [activeRoutineMatrix, setActiveRoutineMatrix] = useState(false);

  useEffect(() => {
    if (!galponeroViews.includes(activeView)) onViewChange('actividades');
  }, [activeView, onViewChange]);

  const summaries = useMemo(() => {
    if (!lotes || !registros || !consumos || !pesajes || !loteGalpones || !galpones || !actividades || !vacunas || !syncQueue) return [];
    const galponNamesById = new Map(galpones.map((galpon) => [galpon.GalponID, galpon.NombreGalpon]));
    return lotes.map((lote) =>
      buildLoteResumen({
        lote,
        registros: registros.filter((registro) => registro.LoteID === lote.LoteID),
        consumos: consumos.filter((consumo) => consumo.LoteID === lote.LoteID),
        pesajes: pesajes.filter((pesaje) => pesaje.LoteID === lote.LoteID),
        loteGalpones: loteGalpones.filter((item) => item.LoteID === lote.LoteID),
        galponNamesById,
        actividades,
        vacunas,
        syncQueue,
        today,
      }),
    );
  }, [actividades, consumos, galpones, loteGalpones, lotes, pesajes, registros, syncQueue, today, vacunas]);

  const selectedGalpon = useMemo(() => (galpones ?? []).find((galpon) => galpon.GalponID === selectedGalponId), [galpones, selectedGalponId]);
  const selectedDashboard = useMemo(() => {
    if (!selectedGalpon) return undefined;
    return buildGalponDashboardModel({
      galpon: selectedGalpon,
      loteGalpones: loteGalpones ?? [],
      lotesById: new Map((lotes ?? []).map((lote) => [lote.LoteID, lote])),
      summariesByLoteId: new Map(summaries.map((summary) => [summary.LoteID, summary])),
      maxCapacity: getMaxGalponCapacity(galpones ?? []),
    });
  }, [galpones, loteGalpones, lotes, selectedGalpon, summaries]);
  const selectedLote = selectedDashboard?.lote;
  const selectedSummary = selectedDashboard?.summary;
  const activeDailyLote = useMemo(() => (lotes ?? []).find((lote) => lote.LoteID === activeDailyLoteId), [activeDailyLoteId, lotes]);
  const agenda = useMemo<AgendaModel>(() => {
    if (!lotes || !registros || !loteGalpones || !galpones || !actividades || !vacunas || !perros) return { hoy: [], proximas: [], pendientes: [] };
    return buildAgenda({
      today,
      lotes,
      registros,
      loteGalpones,
      galpones,
      actividades,
      vacunas,
      perros,
    });
  }, [actividades, galpones, loteGalpones, lotes, perros, registros, today, vacunas]);

  useEffect(() => {
    if (activeView !== 'galpones' && selectedGalponId) setSelectedGalponId('');
  }, [activeView, selectedGalponId]);

  useEffect(() => {
    if (activeView !== 'actividades' && activeActivityRecord) setActiveActivityRecord('');
    if (activeView !== 'actividades' && activeRecordContext) setActiveRecordContext(undefined);
    if (activeView !== 'actividades' && activeDailyLoteId) setActiveDailyLoteId('');
    if (activeView !== 'actividades' && activeRoutineMatrix) setActiveRoutineMatrix(false);
    if (activeView !== 'entrada' && activeEntryRecord) setActiveEntryRecord('');
  }, [activeActivityRecord, activeDailyLoteId, activeEntryRecord, activeRecordContext, activeRoutineMatrix, activeView]);

  function handleSelectGalpon(galponId: string) {
    setSelectedGalponId(galponId);
    onViewChange('galpones');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function handleActivityRecordChange(kind: ActivityRecordKind | '') {
    setActiveActivityRecord(kind);
    if (!kind) setActiveRecordContext(undefined);
  }

  function handleAgendaRecordSaved(message: string) {
    onToast(message);
    if (activeRecordContext) {
      setActiveActivityRecord('');
      setActiveRecordContext(undefined);
    }
  }

  function handleDailySaved(message: string) {
    onToast(message);
    setActiveDailyLoteId('');
  }

  async function handleAgendaTask(task: AgendaTask) {
    if (task.action.type === 'daily') {
      setActiveDailyLoteId(task.action.loteId);
      return;
    }
    if (task.action.type === 'record') {
      setActiveRecordContext(task.action.context);
      setActiveActivityRecord(task.action.kind);
      return;
    }
    if (task.action.type === 'completeActivities') {
      await markActivitiesDone(task.action.activityIds);
      onToast('Actividades marcadas como realizadas.');
      return;
    }
    if (task.action.type === 'routines') {
      setActiveRoutineMatrix(true);
      return;
    }
    handleSelectGalpon(task.action.galponId);
  }

  async function markActivitiesDone(activityIds: string[]) {
    const selectedActivities = (actividades ?? []).filter((actividad) => activityIds.includes(actividad.ActividadLoteID));
    for (const actividad of selectedActivities) {
      const needsGas = actividad.NombreActividad.toLowerCase().includes('retirada calentadoras');
      const gas = needsGas ? Number(window.prompt('Cilindros de gas consumidos') ?? 0) : undefined;
      await actualizarActividad(actividad.ActividadLoteID, 'REALIZADA', user, '', gas);
    }
  }

  if (activeView === 'galpones' && selectedGalpon) {
    return (
      <main className="page-shell page-shell--mobile page-shell--detail page-shell--record-view">
        <GalponDetailHeader
          galpon={selectedGalpon}
          lote={selectedLote}
          mode={selectedLote ? 'Registro diario' : 'Alistamiento'}
          onBack={() => setSelectedGalponId('')}
        />

        {selectedDashboard && (
          <section className="galpon-premium-detail">
            <GalponPremiumDashboardCard
              data={selectedDashboard.data}
              empty={selectedDashboard.empty}
              vacating={selectedDashboard.vacating}
              emptyState={selectedDashboard.emptyState}
              capacityRatio={selectedDashboard.capacityRatio}
            />
          </section>
        )}

        {selectedLote && selectedSummary ? (
          <OccupiedGalponPanel lote={selectedLote} summary={selectedSummary} user={user} onSaved={onToast} />
        ) : (
          <MobileCard className="native-view-card">
            <GalponPreparationPanel galpon={selectedGalpon} onSaved={onToast} />
          </MobileCard>
        )}
      </main>
    );
  }

  if (activeView === 'actividades' && activeDailyLote) {
    return (
      <main className="page-shell page-shell--mobile page-shell--detail page-shell--record-view">
        <header className="native-detail-header">
          <button className="native-back-button" type="button" aria-label="Volver a hoy" onClick={() => setActiveDailyLoteId('')}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <span>HOY</span>
            <h1>Registro diario</h1>
            <small>{activeDailyLote.CodigoLote}</small>
          </div>
        </header>
        <MobileCard className="native-view-card" title="Registro diario" subtitle="Alimento, mortalidad y sacrificio">
          <RegistrarDiaForm lote={activeDailyLote} user={user} onSaved={handleDailySaved} />
        </MobileCard>
      </main>
    );
  }

  if (activeView === 'actividades' && activeRoutineMatrix) {
    return (
      <main className="page-shell page-shell--mobile page-shell--detail page-shell--record-view">
        <header className="native-detail-header">
          <button className="native-back-button" type="button" aria-label="Volver a hoy" onClick={() => setActiveRoutineMatrix(false)}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <span>HOY</span>
            <h1>Rutinas</h1>
            <small>Checks del mes</small>
          </div>
        </header>
        <MobileCard className="native-view-card">
          <RoutineMatrix actividades={actividades ?? []} today={today} user={user} editable onSaved={onToast} />
        </MobileCard>
      </main>
    );
  }

  return (
    <main className={`page-shell page-shell--mobile ${activeView === 'galpones' ? 'page-shell--galpones' : ''} ${activeActivityRecord || activeEntryRecord ? 'page-shell--record-view' : ''}`}>
      {activeView === 'actividades' && (
        activeActivityRecord ? (
          <GalponeroActivityRecords
            user={user}
            activeKind={activeActivityRecord}
            recordContext={activeRecordContext}
            onActiveKindChange={handleActivityRecordChange}
            onSaved={handleAgendaRecordSaved}
          />
        ) : (
          <>
            <GalponeroTitle eyebrow="OPERACION" title="Hoy" icon={<Activity size={34} />} />
            <NaturalAgenda agenda={agenda} onTask={handleAgendaTask} />
            <details className="manual-record-panel">
              <summary>Registrar no programado</summary>
              <GalponeroActivityRecords user={user} activeKind={activeActivityRecord} onActiveKindChange={handleActivityRecordChange} onSaved={onToast} />
            </details>
          </>
        )
      )}

      {activeView === 'galpones' && (
        <>
          <GalponeroTitle eyebrow="MAPA" title="Galpones" icon={<MapIcon size={34} />} />
          <GalponMap
            galpones={galpones ?? []}
            loteGalpones={loteGalpones ?? []}
            lotes={lotes ?? []}
            summaries={summaries}
            selectedGalponId={selectedGalpon?.GalponID}
            onSelectGalpon={handleSelectGalpon}
          />
        </>
      )}

      {activeView === 'entrada' && (
        activeEntryRecord ? (
          <GalponeroEntradaView user={user} activeEntry={activeEntryRecord} onActiveEntryChange={setActiveEntryRecord} onSaved={onToast} />
        ) : (
          <>
            <GalponeroTitle eyebrow="MATERIALES" title="Entrada" icon={<Truck size={34} />} />
            <GalponeroEntradaView user={user} activeEntry={activeEntryRecord} onActiveEntryChange={setActiveEntryRecord} onSaved={onToast} />
          </>
        )
      )}
    </main>
  );
}

function GalponeroTitle({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: ReactNode }) {
  return (
    <section className="page-title native-page-title">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {icon}
    </section>
  );
}

function NaturalAgenda({ agenda, onTask }: { agenda: AgendaModel; onTask: (task: AgendaTask) => void | Promise<void> }) {
  return (
    <section className="natural-agenda" aria-label="Agenda natural de registros">
      <AgendaSection title="HOY" tasks={agenda.hoy} empty="No hay registros programados para hoy." onTask={onTask} />
      <AgendaSection title="PROXIMAS" tasks={agenda.proximas} empty="Sin vacunas ni perros en los proximos 5 dias." onTask={onTask} />
      <AgendaSection title="PENDIENTES" tasks={agenda.pendientes} empty="Sin vacunas ni perros vencidos." onTask={onTask} />
    </section>
  );
}

function AgendaSection({ title, tasks, empty, onTask }: { title: string; tasks: AgendaTask[]; empty: string; onTask: (task: AgendaTask) => void | Promise<void> }) {
  return (
    <MobileCard className={`agenda-section agenda-section--${title.toLowerCase()}`}>
      <header className="agenda-section__header">
        <strong>{title}</strong>
        <span>{fmtNumber(tasks.length)}</span>
      </header>
      <div className="agenda-task-list">
        {tasks.map((task) => (
          <article className={`agenda-task agenda-task--${task.tone}`} key={task.id}>
            <div>
              <span>{task.meta}</span>
              <strong>{task.title}</strong>
              <small>{task.detail}</small>
            </div>
            <button type="button" onClick={() => void onTask(task)}>
              {getAgendaActionLabel(task)}
            </button>
          </article>
        ))}
        {tasks.length === 0 && <p className="empty-state">{empty}</p>}
      </div>
    </MobileCard>
  );
}

function getAgendaActionLabel(task: AgendaTask): string {
  if (task.action.type === 'completeActivities') return 'Marcar';
  if (task.action.type === 'prep') return 'Ir';
  return 'Abrir';
}

function GalponDetailHeader({ galpon, lote, mode, onBack }: { galpon: Galpon; lote?: Lote; mode: string; onBack: () => void }) {
  return (
    <header className="native-detail-header">
      <button className="native-back-button" type="button" aria-label="Volver a galpones" onClick={onBack}>
        <ArrowLeft size={22} />
      </button>
      <div>
        <span>{mode}</span>
        <h1>Galpon {galpon.NombreGalpon}</h1>
        <small>{lote ? lote.CodigoLote : 'Sin lote activo'}</small>
      </div>
    </header>
  );
}

function OccupiedGalponPanel({
  lote,
  summary,
  user,
  onSaved,
}: {
  lote: Lote;
  summary: LoteResumen;
  user: Usuario;
  onSaved: (message: string) => void;
}) {
  return (
    <div className="galpon-entry">
      <div className="galpon-entry__summary" aria-label="Resumen del galpon">
        <span>
          <strong>{fmtNumber(summary.DiaLote)}</strong>
          Dia lote
        </span>
        <span>
          <strong>{fmtNumber(summary.AvesVivasTotal)}</strong>
          Aves vivas
        </span>
        <span>
          <strong>{fmtPercent(summary.MortalidadAcumulada)}</strong>
          Mortalidad
        </span>
      </div>

      <MobileCard className="native-view-card" title="Registro diario" subtitle="Alimento, mortalidad y sacrificio">
        <RegistrarDiaForm lote={lote} user={user} onSaved={onSaved} />
      </MobileCard>
    </div>
  );
}

function GalponPreparationPanel({ galpon, onSaved }: { galpon: Galpon; onSaved: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const completedTaskRecords = getCompletedPrepTaskRecords(galpon);
  const completedTaskIds = completedTaskRecords.map((record) => record.id);
  const completedSet = new Set(completedTaskIds);
  const completedDates = new Map(completedTaskRecords.map((record) => [record.id, record.fecha]));
  const completedCount = completedTaskIds.length;
  const progress = Math.round((completedCount / preparationTasks.length) * 100);
  const currentTask = preparationTasks.find((task) => !completedSet.has(task.id));
  const ready = !currentTask;

  async function handleAdvance() {
    if (!currentTask) return;
    setSaving(true);
    try {
      const nextCompleted = normalizePrepTaskRecords([...completedTaskRecords, { id: currentTask.id, fecha: todayISO() }]);
      await actualizarEstadoGalpon(
        galpon.GalponID,
        getGalponStateForPrepProgress(nextCompleted.map((record) => record.id)),
        writePrepProgressRecords(galpon.Observaciones, nextCompleted),
      );
      onSaved('Avance de alistamiento guardado offline.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUndo() {
    if (completedTaskIds.length === 0) return;
    setSaving(true);
    try {
      const nextCompleted = completedTaskRecords.slice(0, -1);
      await actualizarEstadoGalpon(
        galpon.GalponID,
        getGalponStateForPrepProgress(nextCompleted.map((record) => record.id)),
        writePrepProgressRecords(galpon.Observaciones, nextCompleted),
      );
      onSaved('Ultima actividad de alistamiento revertida.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="prep-panel">
      <div className="prep-progress" aria-label={`Alistamiento ${progress}%`}>
        <div>
          <strong>{progress}% listo</strong>
          <span>{ready ? 'Listo para recibir pollito' : `Sigue: ${currentTask.title}`}</span>
        </div>
        <div className="prep-progress__bar">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="prep-category-track" aria-label="Etapas de alistamiento">
        {preparationCategories.map((category) => {
          const categoryTasks = category.tasks;
          const done = categoryTasks.filter((task) => completedSet.has(task.id)).length;
          const state = done === categoryTasks.length ? 'complete' : done > 0 || currentTask?.category === category.key ? 'current' : 'pending';
          return (
            <span className={`prep-category-track__step prep-category-track__step--${state}`} key={category.key}>
              {state === 'complete' && <CheckCircle2 size={18} />}
              {state === 'current' && <CircleDot size={18} />}
              {state === 'pending' && <Circle size={18} />}
              <strong>{category.label}</strong>
              <small>
                {done}/{categoryTasks.length}
              </small>
            </span>
          );
        })}
      </div>

      <div className="prep-category-list">
        {preparationCategories.map((category) => (
          <section className="prep-category-block" key={category.key}>
            <header>
              <strong>{category.label}</strong>
              <span>
                {category.tasks.filter((task) => completedSet.has(task.id)).length}/{category.tasks.length}
              </span>
            </header>
            <div className="prep-task-list">
              {category.tasks.map((task) => {
                const state = completedSet.has(task.id) ? 'complete' : currentTask?.id === task.id ? 'current' : 'pending';
                const completedDate = completedDates.get(task.id);
                return (
                  <article className={`prep-task prep-task--${state}`} key={task.id}>
                    {state === 'complete' && <CheckCircle2 size={23} />}
                    {state === 'current' && <CircleDot size={23} />}
                    {state === 'pending' && <Circle size={23} />}
                    <div>
                      <strong>{task.title}</strong>
                      <span>{state === 'complete' ? (completedDate ? `Completado ${completedDate}` : 'Completado') : state === 'current' ? 'En proceso' : 'Pendiente'}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="prep-panel__actions">
        <button className="primary-action primary-action--icon" type="button" onClick={handleAdvance} disabled={saving || ready}>
          <Check size={18} />
          <span>{ready ? 'Alistamiento completo' : 'Marcar realizada'}</span>
        </button>
        <button className="small-button" type="button" onClick={handleUndo} disabled={saving || completedTaskIds.length === 0}>
          Deshacer ultima
        </button>
      </div>
    </div>
  );
}
