import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  ClipboardCheck,
  Droplets,
  Home,
  Package,
  Scale,
  ShieldAlert,
  ShoppingCart,
  Syringe,
  Truck,
} from 'lucide-react';
import { GalponMap } from '../../components/GalponMap';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { buildLoteResumen } from '../../services/calculationsService';
import { actualizarEstadoGalpon } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import { fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type { Galpon, InventarioAlimento, Lote, LoteResumen, TipoAlimento, Usuario } from '../../types/entities';
import type { MainView } from '../../types/navigation';
import { RegistrarDiaForm } from './RegistrarDiaForm';
import { PesajeForm } from './PesajeForm';
import { ActividadesHoy } from './ActividadesHoy';
import { VacunasView } from './VacunasView';
import { EntradaAlimentoForm } from './EntradaAlimentoForm';
import { SalidaForm } from './SalidaForm';
import { AguaForm } from './AguaForm';
import { EventoSanitarioForm } from './EventoSanitarioForm';

type GalponeroAction = 'dia' | 'actividades' | 'pesaje' | 'vacunas' | 'entrada' | 'salida' | 'agua' | 'evento';

interface GalponeroHomeProps {
  user: Usuario;
  activeView: MainView;
  onViewChange: (view: MainView) => void;
  onToast: (message: string) => void;
}

const actionMeta: Record<GalponeroAction, { label: string; icon: ReactNode }> = {
  dia: { label: 'Registro diario', icon: <ClipboardCheck size={22} /> },
  actividades: { label: 'Actividades de hoy', icon: <Activity size={22} /> },
  pesaje: { label: 'Pesaje', icon: <Scale size={22} /> },
  vacunas: { label: 'Vacunas', icon: <Syringe size={22} /> },
  entrada: { label: 'Entrada alimento', icon: <Truck size={22} /> },
  salida: { label: 'Sacrificio / salida', icon: <ShoppingCart size={22} /> },
  agua: { label: 'Agua', icon: <Droplets size={22} /> },
  evento: { label: 'Sanidad', icon: <ShieldAlert size={22} /> },
};

const occupiedActions: GalponeroAction[] = ['dia', 'actividades', 'agua', 'pesaje', 'vacunas', 'evento', 'salida'];

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
    label: 'Desinfeccion',
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
  const inventario = useLiveQuery(() => db.inventarioAlimento.toArray(), []);
  const tipos = useLiveQuery(() => db.tiposAlimento.toArray(), []);
  const [selectedGalponId, setSelectedGalponId] = useState<string>('');
  const [activeAction, setActiveAction] = useState<GalponeroAction>('dia');

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
  const activeSummaries = summaries.filter((summary) => lotes?.some((lote) => lote.LoteID === summary.LoteID && lote.EstadoLote === 'ACTIVO'));
  const totals = {
    lotes: activeSummaries.length,
    aves: activeSummaries.reduce((sum, summary) => sum + summary.AvesVivasTotal, 0),
    pendientes: activeSummaries.reduce((sum, summary) => sum + summary.PendientesHoy, 0),
    vacunas: activeSummaries.reduce((sum, summary) => sum + summary.VacunasPendientes, 0),
    sync: activeSummaries.reduce((sum, summary) => sum + summary.SyncPendiente, 0),
    consumo: activeSummaries.reduce((sum, summary) => sum + summary.ConsumoAcumuladoKg, 0),
  };

  useEffect(() => {
    if (activeView !== 'galpones' && selectedGalponId) setSelectedGalponId('');
  }, [activeView, selectedGalponId]);

  function handleSelectGalpon(galponId: string, loteId?: string) {
    setSelectedGalponId(galponId);
    setActiveAction(loteId ? 'dia' : 'actividades');
    onViewChange('galpones');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  if (activeView === 'galpones' && selectedGalpon) {
    return (
      <main className="page-shell page-shell--mobile page-shell--detail">
        <GalponDetailHeader
          galpon={selectedGalpon}
          lote={selectedLote}
          mode={selectedLote ? 'Ingreso de datos' : 'Alistamiento'}
          onBack={() => setSelectedGalponId('')}
        />

        {selectedLote && selectedSummary ? (
          <OccupiedGalponPanel
            galpon={selectedGalpon}
            lote={selectedLote}
            summary={selectedSummary}
            user={user}
            activeAction={activeAction}
            onActionChange={setActiveAction}
            onSaved={onToast}
          />
        ) : (
          <MobileCard className="native-view-card">
            <GalponPreparationPanel galpon={selectedGalpon} onSaved={onToast} />
          </MobileCard>
        )}
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--mobile">
      {activeView === 'inicio' && (
        <>
          <section className="page-title native-page-title">
            <div>
              <span>GALPONERO</span>
              <h1>Inicio</h1>
            </div>
            <Home size={34} />
          </section>

          <section className="stats-grid stats-grid--wide">
            <StatCard label="Lotes activos" value={fmtNumber(totals.lotes)} />
            <StatCard label="Aves vivas" value={fmtNumber(totals.aves)} />
            <StatCard label="Consumo acum." value={fmtKg(totals.consumo)} />
            <StatCard label="Pendientes hoy" value={fmtNumber(totals.pendientes)} tone={totals.pendientes > 0 ? 'warn' : 'good'} />
            <StatCard label="Vacunas" value={fmtNumber(totals.vacunas)} tone={totals.vacunas > 0 ? 'warn' : 'good'} />
            <StatCard label="Por sincronizar" value={fmtNumber(totals.sync)} tone={totals.sync > 0 ? 'warn' : 'good'} />
          </section>

          <MobileCard title="Prioridad de hoy" subtitle="Toca un lote para ver su estado">
            <div className="native-list">
              {activeSummaries.length ? (
                activeSummaries.map((summary) => (
                  <button key={summary.LoteID} type="button" onClick={() => onViewChange('lotes')}>
                    <span>
                      <strong>{summary.CodigoLote}</strong>
                      <small>
                        Dia {summary.DiaLote} - {summary.Galpones.join(', ') || 'Sin galpon'}
                      </small>
                    </span>
                    <span>{fmtNumber(summary.PendientesHoy + summary.VacunasPendientes)} pendientes</span>
                  </button>
                ))
              ) : (
                <p className="empty-state">No hay lotes activos.</p>
              )}
            </div>
          </MobileCard>
        </>
      )}

      {activeView === 'galpones' && (
        <>
          <section className="page-title native-page-title">
            <div>
              <span>MAPA</span>
              <h1>Galpones</h1>
            </div>
            <ClipboardCheck size={34} />
          </section>
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

      {activeView === 'lotes' && (
        <>
          <section className="page-title native-page-title">
            <div>
              <span>PRODUCCION</span>
              <h1>Lotes</h1>
            </div>
            <BarChart3 size={34} />
          </section>
          <div className="lote-card-grid">
            {activeSummaries.length ? (
              activeSummaries.map((summary) => (
                <MobileCard key={summary.LoteID} className="selected-lote-card">
                  <LoteSummary summary={summary} />
                </MobileCard>
              ))
            ) : (
              <MobileCard>
                <p className="empty-state">No hay lotes activos.</p>
              </MobileCard>
            )}
          </div>
        </>
      )}

      {activeView === 'inventario' && (
        <>
          <section className="page-title native-page-title">
            <div>
              <span>ALIMENTO</span>
              <h1>Inventario</h1>
            </div>
            <Package size={34} />
          </section>
          <MobileCard title="Entrada de alimento">
            <EntradaAlimentoForm user={user} onSaved={onToast} />
          </MobileCard>
          <MobileCard title="Existencias">
            <InventoryList inventario={inventario ?? []} tipos={tipos ?? []} />
          </MobileCard>
        </>
      )}

      {activeView === 'reportes' && (
        <>
          <section className="page-title native-page-title">
            <div>
              <span>SEGUIMIENTO</span>
              <h1>Reportes</h1>
            </div>
            <BarChart3 size={34} />
          </section>
          <MobileCard title="Resumen operativo">
            <div className="stats-grid">
              <StatCard label="Mortalidad prom." value={fmtPercent(getAverageMortality(activeSummaries))} />
              <StatCard label="Consumo total" value={fmtKg(totals.consumo)} />
              <StatCard label="Pendientes" value={fmtNumber(totals.pendientes)} tone={totals.pendientes > 0 ? 'warn' : 'good'} />
              <StatCard label="Vacunas" value={fmtNumber(totals.vacunas)} tone={totals.vacunas > 0 ? 'warn' : 'good'} />
            </div>
          </MobileCard>
          <MobileCard title="Lotes activos">
            <div className="native-list">
              {activeSummaries.length ? (
                activeSummaries.map((summary) => (
                  <button key={summary.LoteID} type="button" onClick={() => onViewChange('lotes')}>
                    <span>
                      <strong>{summary.CodigoLote}</strong>
                      <small>
                        Mortalidad {fmtPercent(summary.MortalidadAcumulada)} - CA {fmtNumber(summary.ConversionAlimenticia, 2)}
                      </small>
                    </span>
                    <span>Dia {summary.DiaLote}</span>
                  </button>
                ))
              ) : (
                <p className="empty-state">No hay datos para reportar.</p>
              )}
            </div>
          </MobileCard>
        </>
      )}
    </main>
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
  galpon,
  lote,
  summary,
  user,
  activeAction,
  onActionChange,
  onSaved,
}: {
  galpon: Galpon;
  lote: Lote;
  summary: LoteResumen;
  user: Usuario;
  activeAction: GalponeroAction;
  onActionChange: (action: GalponeroAction) => void;
  onSaved: (message: string) => void;
}) {
  return (
    <div className="galpon-entry">
      <div className="galpon-entry__summary" aria-label={`Resumen del galpon ${galpon.NombreGalpon}`}>
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

      <section className="native-action-tabs" aria-label={`Vistas del galpon ${galpon.NombreGalpon}`}>
        {occupiedActions.map((action) => (
          <button key={action} className={activeAction === action ? 'is-active' : ''} type="button" onClick={() => onActionChange(action)}>
            {actionMeta[action].icon}
            <span>{actionMeta[action].label}</span>
          </button>
        ))}
      </section>

      <MobileCard className="native-view-card" title={actionMeta[activeAction].label} subtitle={lote.CodigoLote}>
        {activeAction === 'dia' && <RegistrarDiaForm lote={lote} user={user} onSaved={onSaved} />}
        {activeAction === 'actividades' && <ActividadesHoy lote={lote} user={user} onSaved={onSaved} />}
        {activeAction === 'agua' && <AguaForm lote={lote} user={user} onSaved={onSaved} />}
        {activeAction === 'pesaje' && <PesajeForm lote={lote} user={user} onSaved={onSaved} />}
        {activeAction === 'vacunas' && <VacunasView lote={lote} user={user} onSaved={onSaved} />}
        {activeAction === 'evento' && <EventoSanitarioForm lote={lote} user={user} onSaved={onSaved} />}
        {activeAction === 'salida' && <SalidaForm lote={lote} user={user} onSaved={onSaved} initialTipoSalida="SACRIFICIO" />}
        {activeAction === 'entrada' && <EntradaAlimentoForm user={user} onSaved={onSaved} />}
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

function InventoryList({ inventario, tipos }: { inventario: InventarioAlimento[]; tipos: TipoAlimento[] }) {
  if (inventario.length === 0) return <p className="empty-state">No hay inventario registrado.</p>;

  return (
    <div className="inventory-list">
      {inventario.map((item) => {
        const tipo = tipos.find((tipoItem) => tipoItem.TipoAlimentoID === item.TipoAlimentoID);
        return (
          <div key={item.InventarioID}>
            <span>{tipo?.Nombre ?? item.TipoAlimentoID}</span>
            <strong>
              {fmtNumber(item.BultosDisponibles, 1)} bultos - {fmtKg(item.KgDisponibles)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function getAverageMortality(summaries: LoteResumen[]): number {
  if (summaries.length === 0) return 0;
  return summaries.reduce((sum, summary) => sum + summary.MortalidadAcumulada, 0) / summaries.length;
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
          <span>Dia {summary.DiaLote}</span>
        </div>
        <small>{summary.Galpones.join(', ') || 'Sin galpon'}</small>
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
