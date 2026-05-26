import type { CSSProperties, ReactNode } from 'react';
import { BarChart3, CalendarDays, ClipboardList, Leaf, Package, Scale, ShieldPlus, UsersRound } from 'lucide-react';
import { fmtKg, fmtNumber, fmtPercent } from '../lib/format';
import type { Galpon, Lote, LoteGalpon, LoteResumen } from '../types/entities';

interface GalponMapProps {
  galpones: Galpon[];
  loteGalpones: LoteGalpon[];
  lotes: Lote[];
  summaries: LoteResumen[];
  selectedGalponId?: string;
  onSelectGalpon: (galponId: string, loteId?: string) => void;
}

const layout = [
  { label: 'Galpón 1', ids: ['galpon_1A', 'galpon_1B'], variant: 'vertical' },
  { label: 'Galpón 2', ids: ['galpon_2A', 'galpon_2B'], variant: 'vertical' },
  { label: 'Galpón 3', ids: ['galpon_3A', 'galpon_3B'], variant: 'horizontal' },
] as const;

const growthStages = [
  { label: 'Bebé', range: '1-7', detail: 'Calor y arranque', className: 'baby', maxDay: 7 },
  { label: 'Inicio', range: '8-14', detail: 'Primer consumo', className: 'starter', maxDay: 14 },
  { label: 'Levante', range: '15-24', detail: 'Pluma y espacio', className: 'grower', maxDay: 24 },
  { label: 'Engorde', range: '25-34', detail: 'Peso acelerado', className: 'fattening', maxDay: 34 },
  { label: 'Listo', range: '35-42', detail: 'Salida ideal', className: 'ready', maxDay: 42 },
  { label: 'Pasado', range: '+42', detail: 'Priorizar salida', className: 'overdue', maxDay: Number.POSITIVE_INFINITY },
] as const;

const emptyStateFlow = [
  { key: 'VACIO', label: 'Vacío', detail: 'Sin lote activo' },
  { key: 'LIMPIEZA', label: 'Limpieza', detail: 'Lavado y retiro' },
  { key: 'DESCANSO_SANITARIO', label: 'Descanso', detail: 'Sanidad' },
  { key: 'PREPARACION', label: 'Preparación', detail: 'Cama y equipos' },
  { key: 'RECIBIMIENTO', label: 'Recibir', detail: 'Listo para pollito' },
] as const;

export function GalponMap({ galpones, loteGalpones, lotes, summaries, selectedGalponId, onSelectGalpon }: GalponMapProps) {
  const galponesById = new Map(galpones.map((galpon) => [galpon.GalponID, galpon]));
  const lotesById = new Map(lotes.map((lote) => [lote.LoteID, lote]));
  const summariesByLoteId = new Map(summaries.map((summary) => [summary.LoteID, summary]));
  const maxCapacity = Math.max(...galpones.map((galpon) => galpon.Capacidad), 2500);
  const activeAssignments = loteGalpones.filter((item) => item.Estado === 'ACTIVO');
  const totalCapacity = galpones.reduce((sum, galpon) => sum + galpon.Capacidad, 0);
  const totalBirds = activeAssignments.reduce((sum, item) => sum + Math.max(0, item.CantidadEntrada - item.CantidadSalida), 0);
  const activeSheds = new Set(activeAssignments.map((item) => item.GalponID)).size;

  return (
    <section className="farm-map-card" aria-label="Plano visual de galpones">
      <header className="farm-map-card__header">
        <div>
          <span>Vista principal</span>
          <h2>Mapa vivo de galpones</h2>
        </div>
        <div className="farm-map-card__stats" aria-label="Resumen general de galpones">
          <span>
            <strong>{fmtNumber(totalBirds)}</strong>
            Aves
          </span>
          <span>
            <strong>{fmtPercent(totalCapacity > 0 ? totalBirds / totalCapacity : 0, 0)}</strong>
            Ocup.
          </span>
          <span>
            <strong>
              {fmtNumber(activeSheds)}/{fmtNumber(galpones.length)}
            </strong>
            Activos
          </span>
        </div>
      </header>

      <div className="farm-map__scroll">
        <div className="farm-map__grid">
          {layout.map((group) => (
            <div className={`farm-map__group farm-map__group--${group.variant}`} key={group.label}>
              <span className="farm-map__group-label">{group.label}</span>
              {group.ids.map((galponId) => {
                const galpon = galponesById.get(galponId);
                if (!galpon) return <MissingGalpon key={galponId} label={galponId} />;
                return (
                  <GalponTile
                    key={galpon.GalponID}
                    galpon={galpon}
                    loteGalpones={loteGalpones}
                    lotesById={lotesById}
                    summariesByLoteId={summariesByLoteId}
                    selectedGalponId={selectedGalponId}
                    maxCapacity={maxCapacity}
                    onSelectGalpon={onSelectGalpon}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GalponTile({
  galpon,
  loteGalpones,
  lotesById,
  summariesByLoteId,
  selectedGalponId,
  maxCapacity,
  onSelectGalpon,
}: {
  galpon: Galpon;
  loteGalpones: LoteGalpon[];
  lotesById: Map<string, Lote>;
  summariesByLoteId: Map<string, LoteResumen>;
  selectedGalponId?: string;
  maxCapacity: number;
  onSelectGalpon: (galponId: string, loteId?: string) => void;
}) {
  const assignments = loteGalpones.filter((item) => item.GalponID === galpon.GalponID && item.Estado === 'ACTIVO');
  const primaryAssignment = assignments[0];
  const lote = primaryAssignment ? lotesById.get(primaryAssignment.LoteID) : undefined;
  const summary = lote ? summariesByLoteId.get(lote.LoteID) : undefined;
  const avesEnGalpon = assignments.reduce((sum, item) => sum + Math.max(0, item.CantidadEntrada - item.CantidadSalida), 0);
  const avesEntrada = assignments.reduce((sum, item) => sum + item.CantidadEntrada, 0);
  const avesSalida = assignments.reduce((sum, item) => sum + item.CantidadSalida, 0);
  const ocupacion = galpon.Capacidad > 0 ? Math.min(1, avesEnGalpon / galpon.Capacidad) : 0;
  const salidaRatio = avesEntrada > 0 ? Math.min(1, Math.max(0, avesSalida / avesEntrada)) : 0;
  const capacityRatio = Math.max(0.45, galpon.Capacidad / maxCapacity);
  const isSelected = selectedGalponId === galpon.GalponID;
  const isEmpty = assignments.length === 0 || !lote;
  const isVacating = !isEmpty && (galpon.EstadoActual === 'SALIDA' || salidaRatio > 0);
  const growth = getGrowthState(summary?.DiaLote ?? 0);
  const emptyState = getEmptyState(galpon.EstadoActual);
  const statusLabel = isEmpty ? emptyState.label : isVacating ? 'Salida' : growth.stage.label;
  const statusDetail = isEmpty ? emptyState.detail : isVacating ? `${fmtPercent(salidaRatio, 0)} desocupado` : growth.stage.detail;
  const visibleCountLabel = `${fmtNumber(avesEnGalpon)} / ${fmtNumber(galpon.Capacidad)}`;
  const style = {
    '--capacity-ratio': capacityRatio,
    '--occupancy-percent': `${Math.round(ocupacion * 100)}%`,
    '--occupancy-ratio': ocupacion,
    '--departure-percent': `${Math.round(salidaRatio * 100)}%`,
    '--growth-percent': `${Math.round(growth.progress * 100)}%`,
    '--growth-ratio': growth.progress,
    '--empty-progress-percent': `${Math.round(emptyState.progress * 100)}%`,
    '--empty-progress-ratio': emptyState.progress,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={[
        'farm-shed',
        'farm-shed--story',
        `farm-shed--${galpon.Capacidad >= 2000 ? 'large' : 'small'}`,
        isSelected ? 'is-selected' : '',
        isEmpty ? 'farm-shed--empty' : '',
        isVacating ? 'farm-shed--vacating' : '',
        growth.isOverdue ? 'farm-shed--overdue' : '',
      ].join(' ')}
      style={style}
      aria-pressed={isSelected}
      data-galpon-id={galpon.GalponID}
      onClick={() => onSelectGalpon(galpon.GalponID, lote?.LoteID)}
    >
      <header className="farm-shed__hero-header">
        <div className="farm-shed__title-block">
          <strong>Galpón {galpon.NombreGalpon}</strong>
        </div>
        <span className="farm-shed__status-pill">
          <Leaf size={17} />
          <span>
            <strong>{statusLabel}</strong>
            <small>{statusDetail}</small>
          </span>
        </span>
        <span className="farm-shed__capacity-pill">
          <UsersRound size={17} />
          <strong>{fmtNumber(galpon.Capacidad)}</strong>
          <small>cap.</small>
        </span>
      </header>

      <section className="farm-shed__visual" aria-hidden="true">
        <span className="shed-room">
          <span className="shed-room__roof" />
          <span className="shed-room__wall shed-room__wall--left" />
          <span className="shed-room__wall shed-room__wall--right" />
          <span className="shed-room__door" />
          <span className="shed-room__fan" />
          <span className="shed-room__lamp shed-room__lamp--left" />
          <span className="shed-room__lamp shed-room__lamp--right" />
          <span className="shed-room__litter" />
        </span>
        <StatBubble className="farm-shed__day-bubble" icon={<CalendarDays size={18} />} label="Día" value={summary ? fmtNumber(summary.DiaLote) : '-'} />
        <StatBubble
          className="farm-shed__weight-bubble"
          icon={<Scale size={18} />}
          label="Peso"
          value={summary ? fmtNumber(summary.PesoPromedioGeneralKg, 2) : '-'}
          suffix="kg"
        />
        {isEmpty ? (
          <ShedProgressVisual progress={emptyState.progress} />
        ) : (
          <BirdFigure stage={growth.stage.className} emphasis={isVacating || growth.isOverdue} />
        )}
      </section>

      {isEmpty ? <EmptyStateTrack currentIndex={emptyState.index} /> : <GrowthTrack currentIndex={growth.index} />}

      <section className="farm-shed__occupancy-panel">
        <div className="farm-shed__occupancy-copy">
          <strong>{fmtPercent(ocupacion, 0)}</strong>
          <span>ocup.</span>
        </div>
        <div className="farm-shed__count-copy">
          <strong>{visibleCountLabel}</strong>
          <span>{isVacating ? 'quedan' : 'en galpón'}</span>
        </div>
        <FlockLayer />
        <div className="farm-shed__vertical-meter" aria-hidden="true">
          <span className="farm-shed__vertical-track">
            <span />
          </span>
          <small>100%</small>
          <small>75%</small>
          <small>{fmtPercent(ocupacion, 0)}</small>
          <small>25%</small>
          <small>0%</small>
        </div>
      </section>

      <footer className="farm-shed__metric-dock">
        <MetricPill icon={<ShieldPlus size={21} />} label="Mort." value={summary ? fmtPercent(summary.MortalidadAcumulada) : '-'} />
        <MetricPill icon={<Package size={21} />} label="Cons." value={summary ? fmtKg(summary.ConsumoAcumuladoKg, 0) : '-'} />
        <MetricPill icon={<BarChart3 size={21} />} label="CA" value={summary ? fmtNumber(summary.ConversionAlimenticia, 2) : '-'} />
        <MetricPill
          icon={<ClipboardList size={21} />}
          label="Pend."
          value={summary ? fmtNumber(summary.PendientesHoy) : '-'}
          tone={summary && summary.PendientesHoy > 0 ? 'warn' : 'neutral'}
        />
      </footer>
    </button>
  );
}

function getGrowthState(day: number) {
  const safeDay = Math.max(1, day);
  const index = growthStages.findIndex((stage) => safeDay <= stage.maxDay);
  const stageIndex = index >= 0 ? index : growthStages.length - 1;

  return {
    index: stageIndex,
    stage: growthStages[stageIndex],
    progress: Math.min(1, safeDay / 42),
    isOverdue: safeDay > 42,
  };
}

function getEmptyState(estado: Galpon['EstadoActual']) {
  const index = emptyStateFlow.findIndex((step) => step.key === estado);
  const stageIndex = index >= 0 ? index : 0;

  return {
    ...emptyStateFlow[stageIndex],
    index: stageIndex,
    progress: emptyStateFlow.length <= 1 ? 1 : stageIndex / (emptyStateFlow.length - 1),
  };
}

function StatBubble({
  className,
  icon,
  label,
  value,
  suffix,
}: {
  className: string;
  icon: ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <span className={`farm-shed__stat-bubble ${className}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
      {suffix && <small>{suffix}</small>}
    </span>
  );
}

function BirdFigure({ stage, emphasis = false }: { stage: (typeof growthStages)[number]['className']; emphasis?: boolean }) {
  return (
    <span className={`bird-figure bird-figure--${stage} ${emphasis ? 'bird-figure--emphasis' : ''}`}>
      <span className="bird-figure__shadow" />
      <span className="bird-figure__leg bird-figure__leg--left" />
      <span className="bird-figure__leg bird-figure__leg--right" />
      <span className="bird-figure__body" />
      <span className="bird-figure__wing" />
      <span className="bird-figure__head" />
      <span className="bird-figure__comb" />
      <span className="bird-figure__beak" />
      <span className="bird-figure__eye" />
    </span>
  );
}

function ShedProgressVisual({ progress }: { progress: number }) {
  return (
    <span className="shed-progress-visual">
      <span className="shed-progress-visual__roof" />
      <span className="shed-progress-visual__house">
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
      <span className="shed-progress-visual__floor" />
    </span>
  );
}

function GrowthTrack({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="growth-track" aria-label="Etapa de crecimiento del lote">
      <span className="growth-track__fill" />
      {growthStages.map((stage, index) => (
        <span
          key={stage.label}
          className={`growth-track__step ${index <= currentIndex ? 'is-complete' : ''} ${index === currentIndex ? 'is-current' : ''}`}
          title={`${stage.label}: días ${stage.range}`}
        >
          <span />
          <small>{stage.label}</small>
        </span>
      ))}
    </div>
  );
}

function EmptyStateTrack({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="empty-state-track" aria-label="Avance del estado del galpón">
      <span className="empty-state-track__fill" />
      {emptyStateFlow.map((step, index) => (
        <span
          key={step.key}
          className={`empty-state-track__step ${index <= currentIndex ? 'is-complete' : ''} ${index === currentIndex ? 'is-current' : ''}`}
          title={step.detail}
        >
          <span />
          <small>{step.label}</small>
        </span>
      ))}
    </div>
  );
}

function FlockLayer() {
  return (
    <div className="farm-shed__flock" aria-hidden="true">
      {Array.from({ length: 24 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

function MetricPill({ icon, label, value, tone = 'neutral' }: { icon: ReactNode; label: string; value: string; tone?: 'neutral' | 'warn' }) {
  return (
    <span className={`farm-shed__metric farm-shed__metric--${tone}`}>
      <span className="farm-shed__metric-icon">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
      <span className="farm-shed__sparkline" />
    </span>
  );
}

function MissingGalpon({ label }: { label: string }) {
  return (
    <div className="farm-shed farm-shed--missing">
      <strong>{label}</strong>
      <span>Sin crear</span>
    </div>
  );
}
