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

const preparationStateOrder: Galpon['EstadoActual'][] = ['VACIO', 'LIMPIEZA', 'DESCANSO_SANITARIO', 'PREPARACION', 'RECIBIMIENTO'];

const preparationTasks: Array<{ state: Galpon['EstadoActual']; title: string; detail: string }> = [
  { state: 'LIMPIEZA', title: 'Retiro de gallinaza', detail: 'Cama vieja, pluma y residuos fuera del galpón' },
  { state: 'DESCANSO_SANITARIO', title: 'Lavado y desinfección', detail: 'Lavado a presión y descanso sanitario' },
  { state: 'PREPARACION', title: 'Instalación de equipo', detail: 'Cisco, divisiones, bebederos y comederos' },
  { state: 'RECIBIMIENTO', title: 'Pre-calentamiento', detail: 'Temperatura y cortinas listas para recibir pollito' },
];

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
  const currentIndex = getPreparationIndex(galpon.EstadoActual);
  const progress = Math.round((currentIndex / preparationTasks.length) * 100);
  const ready = currentIndex >= preparationTasks.length;
  const nextState = preparationStateOrder[Math.min(currentIndex + 1, preparationStateOrder.length - 1)];

  async function handleAdvance() {
    if (ready) return;
    setSaving(true);
    try {
      await actualizarEstadoGalpon(galpon.GalponID, nextState, galpon.Observaciones);
      onSaved('Avance de alistamiento guardado offline.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="prep-panel">
      <div className="prep-progress" aria-label={`Alistamiento ${progress}%`}>
        <div>
          <strong>{progress}% listo</strong>
          <span>{ready ? 'Listo para recibir pollito' : 'Siguiente paso pendiente'}</span>
        </div>
        <div className="prep-progress__bar">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="prep-task-list">
        {preparationTasks.map((task, index) => {
          const state = ready || index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'pending';
          return (
            <article className={`prep-task prep-task--${state}`} key={task.state}>
              {state === 'complete' && <CheckCircle2 size={23} />}
              {state === 'current' && <CircleDot size={23} />}
              {state === 'pending' && <Circle size={23} />}
              <div>
                <strong>{task.title}</strong>
                <span>{state === 'complete' ? 'Completado' : state === 'current' ? task.detail : 'Pendiente'}</span>
              </div>
            </article>
          );
        })}
      </div>

      <button className="primary-action primary-action--icon" type="button" onClick={handleAdvance} disabled={saving || ready}>
        <Check size={18} />
        <span>{ready ? 'Alistamiento completo' : 'Guardar avance'}</span>
      </button>
    </div>
  );
}

function getPreparationIndex(estado: Galpon['EstadoActual']): number {
  const index = preparationStateOrder.indexOf(estado);
  if (index < 0) return 0;
  return Math.min(index, preparationTasks.length);
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
