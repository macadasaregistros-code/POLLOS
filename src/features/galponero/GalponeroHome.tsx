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
  ClipboardCheck,
  Map as MapIcon,
  Truck,
} from 'lucide-react';
import { GalponMap } from '../../components/GalponMap';
import { MobileCard } from '../../components/MobileCard';
import { buildLoteResumen } from '../../services/calculationsService';
import { actualizarEstadoGalpon } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import { fmtNumber, fmtPercent } from '../../lib/format';
import type { ActividadLote, Galpon, Lote, LoteResumen, Usuario, VacunaLote } from '../../types/entities';
import type { MainView } from '../../types/navigation';
import { RegistrarDiaForm } from './RegistrarDiaForm';
import { GalponeroActivityRecords, GalponeroEntradaView, type ActivityRecordKind, type EntryKind } from './GalponeroRecords';

interface GalponeroHomeProps {
  user: Usuario;
  activeView: MainView;
  onViewChange: (view: MainView) => void;
  onToast: (message: string) => void;
}

type PrepCategoryKey = 'RETIRO' | 'DESINFECCION' | 'INSTALACION' | 'RECIBIMIENTO';

interface PrepTask {
  id: string;
  title: string;
  category: PrepCategoryKey;
}

const PREP_PROGRESS_MARKER = '[[POLLOS_PREP_PROGRESS:';
const PREP_PROGRESS_END = ']]';
const galponeroViews: MainView[] = ['actividades', 'galpones', 'entrada'];

const preparationCategories: Array<{ key: PrepCategoryKey; label: string; state: Galpon['EstadoActual']; tasks: PrepTask[] }> = [
  {
    key: 'RETIRO',
    label: 'Retiro',
    state: 'LIMPIEZA',
    tasks: [
      { id: 'recoger_equipo', title: 'Recoger Equipo', category: 'RETIRO' },
      { id: 'barrer_pluma', title: 'Barrer Pluma', category: 'RETIRO' },
      { id: 'sacar_caracha', title: 'Sacar Caracha', category: 'RETIRO' },
      { id: 'amontonar_pollinaza', title: 'Amontonar pollinaza 8 dias y registrar temperatura interna', category: 'RETIRO' },
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
      { id: 'lavar_equipo', title: 'Lavar Equipo (Bebederos / Comederos)', category: 'DESINFECCION' },
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
      { id: 'encortinar', title: 'Encortinar', category: 'INSTALACION' },
      { id: 'instalar_calentadoras', title: 'Instalar Calentadoras', category: 'INSTALACION' },
      { id: 'bebederos_comederos_babies', title: 'Meter Bebederos de Volteo y Comederos Babies', category: 'INSTALACION' },
    ],
  },
  {
    key: 'RECIBIMIENTO',
    label: 'Recibimiento',
    state: 'RECIBIMIENTO',
    tasks: [
      { id: 'precalentar', title: 'Precalentar 8h antes de la llegada', category: 'RECIBIMIENTO' },
      { id: 'purgar_lineas', title: 'Purgar Lineas', category: 'RECIBIMIENTO' },
      { id: 'neutrar_agua', title: 'Neutrar el Agua de Bebida', category: 'RECIBIMIENTO' },
      { id: 'verificar_temperatura', title: 'Verificar Temperatura', category: 'RECIBIMIENTO' },
      { id: 'llegada_pollito', title: 'Llegada del Pollito', category: 'RECIBIMIENTO' },
    ],
  },
];

const preparationTasks = preparationCategories.flatMap((category) => category.tasks);

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
  const syncQueue = useLiveQuery(() => db.syncQueue.toArray(), []);
  const [selectedGalponId, setSelectedGalponId] = useState('');
  const [activeActivityRecord, setActiveActivityRecord] = useState<ActivityRecordKind | ''>('');
  const [activeEntryRecord, setActiveEntryRecord] = useState<EntryKind | ''>('');

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

  const activeAssignments = useMemo(() => (loteGalpones ?? []).filter((item) => item.Estado === 'ACTIVO'), [loteGalpones]);
  const selectedGalpon = useMemo(() => (galpones ?? []).find((galpon) => galpon.GalponID === selectedGalponId), [galpones, selectedGalponId]);
  const selectedAssignment = selectedGalpon
    ? activeAssignments.find((assignment) => assignment.GalponID === selectedGalpon.GalponID)
    : undefined;
  const selectedLote = lotes?.find((lote) => lote.LoteID === selectedAssignment?.LoteID);
  const selectedSummary = summaries.find((summary) => summary.LoteID === selectedLote?.LoteID);

  useEffect(() => {
    if (activeView !== 'galpones' && selectedGalponId) setSelectedGalponId('');
  }, [activeView, selectedGalponId]);

  useEffect(() => {
    if (activeView !== 'actividades' && activeActivityRecord) setActiveActivityRecord('');
    if (activeView !== 'entrada' && activeEntryRecord) setActiveEntryRecord('');
  }, [activeActivityRecord, activeEntryRecord, activeView]);

  function handleSelectGalpon(galponId: string) {
    setSelectedGalponId(galponId);
    onViewChange('galpones');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
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

  return (
    <main className={`page-shell page-shell--mobile ${activeView === 'galpones' ? 'page-shell--galpones' : ''} ${activeActivityRecord || activeEntryRecord ? 'page-shell--record-view' : ''}`}>
      {activeView === 'actividades' && (
        activeActivityRecord ? (
          <GalponeroActivityRecords user={user} activeKind={activeActivityRecord} onActiveKindChange={setActiveActivityRecord} onSaved={onToast} />
        ) : (
          <>
            <GalponeroTitle eyebrow="OPERACION" title="Actividades" icon={<Activity size={34} />} />
            <ActivityBuckets actividades={actividades ?? []} vacunas={vacunas ?? []} today={today} />
            <GalponeroActivityRecords user={user} activeKind={activeActivityRecord} onActiveKindChange={setActiveActivityRecord} onSaved={onToast} />
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

function ActivityBuckets({ actividades, vacunas, today }: { actividades: ActividadLote[]; vacunas: VacunaLote[]; today: string }) {
  const actionable = actividades.filter((actividad) => ['PENDIENTE', 'VENCIDA', 'NO_REALIZADA'].includes(actividad.Estado));
  const vencidas = actionable.filter((actividad) => actividad.FechaProgramada < today || actividad.Estado === 'VENCIDA');
  const hoy = actionable.filter((actividad) => actividad.FechaProgramada === today && actividad.Estado !== 'VENCIDA');
  const proximas = actionable.filter((actividad) => actividad.FechaProgramada > today).slice(0, 6);
  const vacunasPendientes = vacunas.filter((vacuna) => vacuna.Estado !== 'APLICADA');

  return (
    <section className="activity-bucket-grid">
      <ActivityBucket title="Vencidas" count={vencidas.length} tone="warn" items={vencidas.slice(0, 4)} />
      <ActivityBucket title="Hoy" count={hoy.length} tone="today" items={hoy.slice(0, 4)} />
      <ActivityBucket title="Proximas" count={proximas.length + vacunasPendientes.length} tone="next" items={proximas.slice(0, 3)} vacunas={vacunasPendientes.slice(0, 3)} />
    </section>
  );
}

function ActivityBucket({
  title,
  count,
  tone,
  items,
  vacunas = [],
}: {
  title: string;
  count: number;
  tone: 'warn' | 'today' | 'next';
  items: ActividadLote[];
  vacunas?: VacunaLote[];
}) {
  return (
    <MobileCard className={`activity-bucket activity-bucket--${tone}`}>
      <header>
        <span>{title}</span>
        <strong>{fmtNumber(count)}</strong>
      </header>
      <div className="activity-item-list">
        {[...items.map((item) => ({ key: item.ActividadLoteID, title: item.NombreActividad, detail: item.FechaProgramada })),
          ...vacunas.map((vacuna) => ({ key: vacuna.VacunaLoteID, title: `Vacuna ${vacuna.NombreVacuna}`, detail: vacuna.FechaProgramada })),
        ].map((item) => (
          <article key={item.key}>
            <ClipboardCheck size={18} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
          </article>
        ))}
        {count === 0 && <p className="empty-state">Sin pendientes.</p>}
      </div>
    </MobileCard>
  );
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
  const completedTaskIds = getCompletedPrepTaskIds(galpon);
  const completedSet = new Set(completedTaskIds);
  const completedCount = completedTaskIds.length;
  const progress = Math.round((completedCount / preparationTasks.length) * 100);
  const currentTask = preparationTasks.find((task) => !completedSet.has(task.id));
  const ready = !currentTask;

  async function handleAdvance() {
    if (!currentTask) return;
    setSaving(true);
    try {
      const nextCompleted = normalizePrepTaskIds([...completedTaskIds, currentTask.id]);
      await actualizarEstadoGalpon(
        galpon.GalponID,
        getGalponStateForPrepProgress(nextCompleted),
        writePrepProgress(galpon.Observaciones, nextCompleted),
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
      const nextCompleted = completedTaskIds.slice(0, -1);
      await actualizarEstadoGalpon(
        galpon.GalponID,
        getGalponStateForPrepProgress(nextCompleted),
        writePrepProgress(galpon.Observaciones, nextCompleted),
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
                return (
                  <article className={`prep-task prep-task--${state}`} key={task.id}>
                    {state === 'complete' && <CheckCircle2 size={23} />}
                    {state === 'current' && <CircleDot size={23} />}
                    {state === 'pending' && <Circle size={23} />}
                    <div>
                      <strong>{task.title}</strong>
                      <span>{state === 'complete' ? 'Completado' : state === 'current' ? 'En proceso' : 'Pendiente'}</span>
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

function getCompletedPrepTaskIds(galpon: Galpon): string[] {
  const markerIndex = galpon.Observaciones.indexOf(PREP_PROGRESS_MARKER);
  if (markerIndex >= 0) {
    const start = markerIndex + PREP_PROGRESS_MARKER.length;
    const end = galpon.Observaciones.indexOf(PREP_PROGRESS_END, start);
    if (end > start) {
      try {
        const parsed = JSON.parse(galpon.Observaciones.slice(start, end)) as { completedTaskIds?: string[] };
        return normalizePrepTaskIds(parsed.completedTaskIds ?? []);
      } catch {
        return [];
      }
    }
  }

  return normalizePrepTaskIds(getCompletedPrepTaskIdsFromState(galpon.EstadoActual));
}

function getCompletedPrepTaskIdsFromState(state: Galpon['EstadoActual']): string[] {
  if (state === 'DESCANSO_SANITARIO') return preparationCategories[0].tasks.map((task) => task.id);
  if (state === 'PREPARACION') return preparationCategories.slice(0, 2).flatMap((category) => category.tasks.map((task) => task.id));
  if (state === 'RECIBIMIENTO') return preparationCategories.slice(0, 3).flatMap((category) => category.tasks.map((task) => task.id));
  return [];
}

function normalizePrepTaskIds(ids: string[]): string[] {
  const unique = new Set(ids);
  return preparationTasks.filter((task) => unique.has(task.id)).map((task) => task.id);
}

function stripPrepProgress(observaciones: string): string {
  const markerIndex = observaciones.indexOf(PREP_PROGRESS_MARKER);
  if (markerIndex < 0) return observaciones;
  const end = observaciones.indexOf(PREP_PROGRESS_END, markerIndex + PREP_PROGRESS_MARKER.length);
  if (end < 0) return observaciones.slice(0, markerIndex).trim();
  return `${observaciones.slice(0, markerIndex)}${observaciones.slice(end + PREP_PROGRESS_END.length)}`.trim();
}

function writePrepProgress(observaciones: string, completedTaskIds: string[]): string {
  const visibleObservaciones = stripPrepProgress(observaciones);
  const marker = `${PREP_PROGRESS_MARKER}${JSON.stringify({ completedTaskIds })}${PREP_PROGRESS_END}`;
  return visibleObservaciones ? `${visibleObservaciones}\n${marker}` : marker;
}

function getGalponStateForPrepProgress(completedTaskIds: string[]): Galpon['EstadoActual'] {
  if (completedTaskIds.length === 0) return 'VACIO';
  const completedSet = new Set(completedTaskIds);
  const activeCategory = preparationCategories.find((category) => category.tasks.some((task) => !completedSet.has(task.id)));
  return activeCategory?.state ?? 'RECIBIMIENTO';
}
