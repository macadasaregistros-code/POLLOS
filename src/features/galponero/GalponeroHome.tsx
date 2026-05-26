import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Activity,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  Droplets,
  Scale,
  ShieldAlert,
  ShoppingCart,
  Syringe,
  Truck,
  X,
} from 'lucide-react';
import { GalponMap } from '../../components/GalponMap';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { buildLoteResumen } from '../../services/calculationsService';
import { actualizarEstadoGalpon } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import { fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type { Galpon, Lote, LoteResumen, Usuario } from '../../types/entities';
import { RegistrarDiaForm } from './RegistrarDiaForm';
import { PesajeForm } from './PesajeForm';
import { ActividadesHoy } from './ActividadesHoy';
import { VacunasView } from './VacunasView';
import { EntradaAlimentoForm } from './EntradaAlimentoForm';
import { SalidaForm } from './SalidaForm';
import { AguaForm } from './AguaForm';
import { EventoSanitarioForm } from './EventoSanitarioForm';

type GalponeroAction = 'dia' | 'actividades' | 'pesaje' | 'vacunas' | 'entrada' | 'salida' | 'agua' | 'evento';
type OccupiedEntryMode = 'diario' | 'sacrificio';

interface GalponeroHomeProps {
  user: Usuario;
  onToast: (message: string) => void;
}

const actionMeta: Record<GalponeroAction, { label: string; icon: ReactNode }> = {
  dia: { label: 'Registrar día', icon: <ClipboardCheck size={22} /> },
  actividades: { label: 'Actividades de hoy', icon: <Activity size={22} /> },
  pesaje: { label: 'Pesaje', icon: <Scale size={22} /> },
  vacunas: { label: 'Vacunas', icon: <Syringe size={22} /> },
  entrada: { label: 'Entrada alimento', icon: <Truck size={22} /> },
  salida: { label: 'Venta / salida', icon: <ShoppingCart size={22} /> },
  agua: { label: 'Agua', icon: <Droplets size={22} /> },
  evento: { label: 'Evento sanitario', icon: <ShieldAlert size={22} /> },
};

const secondaryActions = (Object.keys(actionMeta) as GalponeroAction[]).filter((action) => action !== 'dia' && action !== 'salida');

type PrepCategoryKey = 'RETIRO' | 'DESINFECCION' | 'INSTALACION' | 'RECIBIMIENTO';

interface PrepTask {
  id: string;
  title: string;
  category: PrepCategoryKey;
}

const PREP_PROGRESS_MARKER = '[[POLLOS_PREP_PROGRESS:';
const PREP_PROGRESS_END = ']]';

const preparationCategories: Array<{ key: PrepCategoryKey; label: string; state: Galpon['EstadoActual']; tasks: PrepTask[] }> = [
  {
    key: 'RETIRO',
    label: 'Retiro',
    state: 'LIMPIEZA',
    tasks: [
      { id: 'recoger_equipo', title: 'Recoger Equipo', category: 'RETIRO' },
      { id: 'barrer_pluma', title: 'Barrer Pluma', category: 'RETIRO' },
      { id: 'sacar_caracha', title: 'Sacar Caracha', category: 'RETIRO' },
      { id: 'amontonar_cama', title: 'Amontonar Cama durante 8 dias', category: 'RETIRO' },
      { id: 'retiro_pollinaza', title: 'Retiro de Pollinaza Reusada en Exceso', category: 'RETIRO' },
    ],
  },
  {
    key: 'DESINFECCION',
    label: 'Desinfección',
    state: 'DESCANSO_SANITARIO',
    tasks: [
      { id: 'fumiga_coquito', title: 'Fumiga Coquito', category: 'DESINFECCION' },
      { id: 'lavar_equipo', title: 'Lavar Equipo (Bebederos / Comederos)', category: 'DESINFECCION' },
      { id: 'barrer_lavado_galpon', title: 'Barrer / Lavado Galpon', category: 'DESINFECCION' },
      { id: 'calear', title: 'Calear', category: 'DESINFECCION' },
      { id: 'fumiga_desinfectante', title: 'Fumiga Desinfectante', category: 'DESINFECCION' },
    ],
  },
  {
    key: 'INSTALACION',
    label: 'Instalación',
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

export function GalponeroHome({ user, onToast }: GalponeroHomeProps) {
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
  const inventario = useLiveQuery(() => db.inventarioAlimento.toArray(), []);
  const tipos = useLiveQuery(() => db.tiposAlimento.toArray(), []);
  const [selectedGalponId, setSelectedGalponId] = useState<string>('');
  const [occupiedEntryMode, setOccupiedEntryMode] = useState<OccupiedEntryMode>('diario');
  const [activeAction, setActiveAction] = useState<GalponeroAction>('actividades');

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
  const selectedGalpon = useMemo(() => {
    const allGalpones = galpones ?? [];
    if (allGalpones.length === 0 || !selectedGalponId) return undefined;
    return allGalpones.find((galpon) => galpon.GalponID === selectedGalponId);
  }, [galpones, selectedGalponId]);
  const selectedAssignment = selectedGalpon
    ? activeAssignments.find((assignment) => assignment.GalponID === selectedGalpon.GalponID)
    : undefined;
  const selectedLote = lotes?.find((lote) => lote.LoteID === selectedAssignment?.LoteID);
  const selectedSummary = summaries.find((summary) => summary.LoteID === selectedLote?.LoteID);

  function handleSelectGalpon(galponId: string, loteId?: string) {
    setSelectedGalponId(galponId);
    setActiveAction('actividades');
    if (loteId) setOccupiedEntryMode('diario');
  }

  return (
    <main className="page-shell page-shell--mobile">
      <GalponMap
        galpones={galpones ?? []}
        loteGalpones={loteGalpones ?? []}
        lotes={lotes ?? []}
        summaries={summaries}
        selectedGalponId={selectedGalpon?.GalponID}
        onSelectGalpon={handleSelectGalpon}
      />

      {selectedGalpon && (
        <div className="galpon-sheet-backdrop" role="presentation" onClick={() => setSelectedGalponId('')}>
          <section
            className="galpon-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="galpon-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="galpon-sheet__header">
              <div>
                <span>{selectedLote ? 'Ingreso de datos' : 'Alistamiento'}</span>
                <h2 id="galpon-sheet-title">Galpón {selectedGalpon.NombreGalpon}</h2>
                <small>{selectedLote ? selectedLote.CodigoLote : 'Sin lote activo'}</small>
              </div>
              <button type="button" aria-label="Cerrar ingreso de galpón" onClick={() => setSelectedGalponId('')}>
                <X size={20} />
              </button>
            </header>
            <div className="galpon-sheet__body">
              {selectedLote && selectedSummary ? (
                <OccupiedGalponPanel
                  galpon={selectedGalpon}
                  lote={selectedLote}
                  summary={selectedSummary}
                  user={user}
                  mode={occupiedEntryMode}
                  onModeChange={setOccupiedEntryMode}
                  onSaved={onToast}
                />
              ) : (
                <GalponPreparationPanel galpon={selectedGalpon} onSaved={onToast} />
              )}
            </div>
          </section>
        </div>
      )}

      {selectedSummary && (
        <MobileCard className="selected-lote-card">
          <LoteSummary summary={selectedSummary} />
        </MobileCard>
      )}

      {selectedLote && selectedSummary && (
        <>
          <section className="quick-actions">
            {secondaryActions.map((action) => (
              <button
                key={action}
                className={activeAction === action ? 'is-active' : ''}
                type="button"
                onClick={() => setActiveAction(action)}
              >
                {actionMeta[action].icon}
                <span>{actionMeta[action].label}</span>
              </button>
            ))}
          </section>

          <MobileCard title={actionMeta[activeAction].label} subtitle={selectedLote.CodigoLote}>
            {activeAction === 'actividades' && <ActividadesHoy lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'pesaje' && <PesajeForm lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'vacunas' && <VacunasView lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'entrada' && <EntradaAlimentoForm user={user} onSaved={onToast} />}
            {activeAction === 'agua' && <AguaForm lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'evento' && <EventoSanitarioForm lote={selectedLote} user={user} onSaved={onToast} />}
          </MobileCard>
        </>
      )}

      <MobileCard title="Inventario alimento">
        <div className="inventory-list">
          {inventario?.map((item) => {
            const tipo = tipos?.find((tipoItem) => tipoItem.TipoAlimentoID === item.TipoAlimentoID);
            return (
              <div key={item.InventarioID}>
                <span>{tipo?.Nombre ?? item.TipoAlimentoID}</span>
                <strong>
                  {fmtNumber(item.BultosDisponibles, 1)} bultos · {fmtKg(item.KgDisponibles)}
                </strong>
              </div>
            );
          })}
        </div>
      </MobileCard>
    </main>
  );
}

function OccupiedGalponPanel({
  galpon,
  lote,
  summary,
  user,
  mode,
  onModeChange,
  onSaved,
}: {
  galpon: Galpon;
  lote: Lote;
  summary: LoteResumen;
  user: Usuario;
  mode: OccupiedEntryMode;
  onModeChange: (mode: OccupiedEntryMode) => void;
  onSaved: (message: string) => void;
}) {
  return (
    <div className="galpon-entry">
      <div className="galpon-entry__summary" aria-label="Resumen del galpón seleccionado">
        <span>
          <strong>{fmtNumber(summary.DiaLote)}</strong>
          Día lote
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

      <div className="entry-mode-tabs" role="tablist" aria-label={`Ingreso de datos para galpón ${galpon.NombreGalpon}`}>
        <button className={mode === 'diario' ? 'is-active' : ''} type="button" onClick={() => onModeChange('diario')}>
          <ClipboardCheck size={18} />
          Diario
        </button>
        <button className={mode === 'sacrificio' ? 'is-active' : ''} type="button" onClick={() => onModeChange('sacrificio')}>
          <ShoppingCart size={18} />
          Sacrificio
        </button>
      </div>

      {mode === 'diario' ? (
        <RegistrarDiaForm lote={lote} user={user} onSaved={onSaved} />
      ) : (
        <SalidaForm lote={lote} user={user} onSaved={onSaved} initialTipoSalida="SACRIFICIO" />
      )}
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
      onSaved('Última actividad de alistamiento revertida.');
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
          Deshacer última
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

function LoteSummary({ summary }: { summary: LoteResumen }) {
  return (
    <div className="lote-summary">
      <header>
        <div>
          <strong>{summary.CodigoLote}</strong>
          <span>Día {summary.DiaLote}</span>
        </div>
        <small>{summary.Galpones.join(', ') || 'Sin galpón'}</small>
      </header>
      <div className="stats-grid">
        <StatCard label="Aves vivas" value={fmtNumber(summary.AvesVivasTotal)} />
        <StatCard label="Machos vivos" value={fmtNumber(summary.MachosVivos)} />
        <StatCard label="Hembras vivas" value={fmtNumber(summary.HembrasVivas)} />
        <StatCard label="Pendientes" value={fmtNumber(summary.PendientesHoy)} tone={summary.PendientesHoy > 0 ? 'warn' : 'good'} />
        <StatCard label="Vacunas" value={fmtNumber(summary.VacunasPendientes)} tone={summary.VacunasPendientes > 0 ? 'warn' : 'good'} />
        <StatCard label="Sync" value={fmtNumber(summary.SyncPendiente)} tone={summary.SyncPendiente > 0 ? 'warn' : 'good'} />
      </div>
      <div className="mini-metrics">
        <span>Mortalidad {fmtPercent(summary.MortalidadAcumulada)}</span>
        <span>Consumo {fmtKg(summary.ConsumoAcumuladoKg)}</span>
        <span>Peso {fmtKg(summary.PesoPromedioGeneralKg, 2)}</span>
        <span>CA {fmtNumber(summary.ConversionAlimenticia, 2)}</span>
      </div>
    </div>
  );
}
