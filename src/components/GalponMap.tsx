import type { CSSProperties, ReactNode } from 'react';
import { ArrowDown, BarChart3, Bird, CalendarDays, Check, ClipboardList, HeartPulse, House, Leaf, Package, Scale, ShieldPlus, UsersRound } from 'lucide-react';
import { addDays, todayISO } from '../lib/date';
import { fmtKg, fmtNumber, fmtPercent } from '../lib/format';
import type { FechaISO, Galpon, Lote, LoteGalpon, LoteResumen, RegistroDiarioLote } from '../types/entities';

interface GalponMapProps {
  galpones: Galpon[];
  loteGalpones: LoteGalpon[];
  lotes: Lote[];
  summaries: LoteResumen[];
  registrosDiarios?: RegistroDiarioLote[];
  today?: FechaISO;
  selectedGalponId?: string;
  onSelectGalpon: (galponId: string, loteId?: string) => void;
}

export interface GalponDashboardCardData {
  galpon: string;
  etapa: string;
  tipoAlimento: string;
  capacidad: number;
  dia: number;
  pesoPromedioKg: number;
  ocupacionPct: number;
  entrada: number;
  mortalidadPct: number;
  consumoKg: number;
  consumoBultos: number;
  conversionCA: number;
  pendientes: number;
}

export interface GalponDashboardModel {
  data: GalponDashboardCardData;
  empty: boolean;
  vacating: boolean;
  staleData: boolean;
  emptyState: ReturnType<typeof getEmptyState>;
  capacityRatio: number;
  lote?: Lote;
  summary?: LoteResumen;
}

export interface GalponDashboardModelInput {
  galpon: Galpon;
  loteGalpones: LoteGalpon[];
  lotesById: Map<string, Lote>;
  summariesByLoteId: Map<string, LoteResumen>;
  latestRegistroDatesByLoteId?: Map<string, FechaISO>;
  registrosDiarios?: RegistroDiarioLote[];
  maxCapacity: number;
  today?: FechaISO;
}

const layout = [
  { label: 'Galpón 1', ids: ['galpon_1A', 'galpon_1B'], variant: 'vertical' },
  { label: 'Galpón 2', ids: ['galpon_2A', 'galpon_2B'], variant: 'vertical' },
  { label: 'Galpón 3', ids: ['galpon_3A', 'galpon_3B'], variant: 'horizontal' },
] as const;

const growthStages = [
  { label: 'Bebé', range: '1-7', detail: 'Calor y arranque', className: 'baby', maxDay: 7 },
  { label: 'Inicio', range: '8-14', detail: 'Primer consumo', className: 'starter', maxDay: 14 },
  { label: 'Levante', range: '15-21', detail: 'Pluma y espacio', className: 'grower', maxDay: 21 },
  { label: 'Engorde', range: '22-35', detail: 'Peso acelerado', className: 'fattening', maxDay: 35 },
  { label: 'Listo', range: '36-50', detail: 'Salida ideal', className: 'ready', maxDay: 50 },
  { label: 'Pasado', range: '+51', detail: 'Priorizar salida', className: 'overdue', maxDay: Number.POSITIVE_INFINITY },
] as const;

const chickenImages = [
  { day: 1, src: '/chickens/day-1.png' },
  { day: 8, src: '/chickens/day-8.png' },
  { day: 15, src: '/chickens/day-15.png' },
  { day: 22, src: '/chickens/day-22.png' },
  { day: 29, src: '/chickens/day-29.png' },
  { day: 36, src: '/chickens/day-36.png' },
  { day: 43, src: '/chickens/day-43.png' },
  { day: 50, src: '/chickens/day-50.png' },
  { day: 57, src: '/chickens/day-57.png' },
] as const;

const DEFAULT_KG_PER_BULTO = 40;

const emptyStateFlow = [
  { key: 'VACIO', label: 'Vacío', detail: 'Sin lote activo' },
  { key: 'LIMPIEZA', label: 'Limpieza', detail: 'Lavado y retiro' },
  { key: 'DESCANSO_SANITARIO', label: 'Descanso', detail: 'Sanidad' },
  { key: 'PREPARACION', label: 'Preparación', detail: 'Cama y equipos' },
  { key: 'RECIBIMIENTO', label: 'Recibir', detail: 'Listo para pollito' },
] as const;

export function GalponMap({ galpones, loteGalpones, lotes, summaries, registrosDiarios = [], today = todayISO(), selectedGalponId, onSelectGalpon }: GalponMapProps) {
  const galponesById = new Map(galpones.map((galpon) => [galpon.GalponID, galpon]));
  const lotesById = new Map(lotes.map((lote) => [lote.LoteID, lote]));
  const summariesByLoteId = new Map(summaries.map((summary) => [summary.LoteID, summary]));
  const latestRegistroDatesByLoteId = buildLatestRegistroDateMap(registrosDiarios);
  const maxCapacity = getMaxGalponCapacity(galpones);
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
                    latestRegistroDatesByLoteId={latestRegistroDatesByLoteId}
                    registrosDiarios={registrosDiarios}
                    selectedGalponId={selectedGalponId}
                    maxCapacity={maxCapacity}
                    today={today}
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
  latestRegistroDatesByLoteId,
  registrosDiarios,
  selectedGalponId,
  maxCapacity,
  today,
  onSelectGalpon,
}: {
  galpon: Galpon;
  loteGalpones: LoteGalpon[];
  lotesById: Map<string, Lote>;
  summariesByLoteId: Map<string, LoteResumen>;
  latestRegistroDatesByLoteId: Map<string, FechaISO>;
  registrosDiarios: RegistroDiarioLote[];
  selectedGalponId?: string;
  maxCapacity: number;
  today: FechaISO;
  onSelectGalpon: (galponId: string, loteId?: string) => void;
}) {
  const isSelected = selectedGalponId === galpon.GalponID;
  const dashboardModel = buildGalponDashboardModel({
    galpon,
    loteGalpones,
    lotesById,
    summariesByLoteId,
    latestRegistroDatesByLoteId,
    registrosDiarios,
    maxCapacity,
    today,
  });

  return (
    <GalponDashboardCard
      data={dashboardModel.data}
      selected={isSelected}
      empty={dashboardModel.empty}
      vacating={dashboardModel.vacating}
      staleData={dashboardModel.staleData}
      emptyState={dashboardModel.emptyState}
      capacityRatio={dashboardModel.capacityRatio}
      dataGalponId={galpon.GalponID}
      onClick={() => onSelectGalpon(galpon.GalponID, dashboardModel.lote?.LoteID)}
    />
  );
}

export function getMaxGalponCapacity(galpones: Galpon[]) {
  return Math.max(2500, ...galpones.map((galpon) => galpon.Capacidad));
}

export function buildGalponDashboardModel({
  galpon,
  loteGalpones,
  lotesById,
  summariesByLoteId,
  latestRegistroDatesByLoteId,
  registrosDiarios,
  maxCapacity,
  today = todayISO(),
}: GalponDashboardModelInput): GalponDashboardModel {
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
  const empty = assignments.length === 0 || !lote;
  const vacating = !empty && (galpon.EstadoActual === 'SALIDA' || salidaRatio > 0);
  const latestDates = latestRegistroDatesByLoteId ?? (registrosDiarios ? buildLatestRegistroDateMap(registrosDiarios) : undefined);
  const staleData = latestDates ? !empty && isGalponRegistroStale(assignments, latestDates, today) : false;
  const growth = getGrowthState(summary?.DiaLote ?? 0);
  const emptyState = getEmptyState(galpon.EstadoActual);

  return {
    data: {
      galpon: galpon.NombreGalpon,
      etapa: growth.stage.label.toUpperCase(),
      tipoAlimento: growth.stage.detail,
      capacidad: galpon.Capacidad,
      dia: summary?.DiaLote ?? 0,
      pesoPromedioKg: summary?.PesoPromedioGeneralKg ?? 0,
      ocupacionPct: ocupacion * 100,
      entrada: vacating ? avesEnGalpon : avesEntrada,
      mortalidadPct: summary ? summary.MortalidadAcumulada * 100 : 0,
      consumoKg: summary?.ConsumoAcumuladoKg ?? 0,
      consumoBultos: getConsumptionBultos(assignments, summary, registrosDiarios),
      conversionCA: summary?.ConversionAlimenticia ?? 0,
      pendientes: summary?.PendientesHoy ?? 0,
    },
    empty,
    vacating,
    staleData,
    emptyState,
    capacityRatio,
    lote,
    summary,
  };
}

export function GalponDashboardCard({
  data,
  selected = false,
  empty = false,
  vacating = false,
  staleData = false,
  emptyState,
  capacityRatio = 1,
  dataGalponId,
  onClick,
}: {
  data: GalponDashboardCardData;
  selected?: boolean;
  empty?: boolean;
  vacating?: boolean;
  staleData?: boolean;
  emptyState?: ReturnType<typeof getEmptyState>;
  capacityRatio?: number;
  dataGalponId?: string;
  onClick?: () => void;
}) {
  const occupancyPercent = Math.min(100, Math.max(0, data.ocupacionPct));
  const occupancyRatio = occupancyPercent / 100;
  const occupancyTone = getOccupancyTone(occupancyPercent);
  const growth = getGrowthState(data.dia);
  const chickenImage = getChickenImage(data.dia);
  const resolvedEmptyState = emptyState ?? getEmptyState('VACIO');
  const statusLabel = empty ? resolvedEmptyState.label : vacating ? 'Salida' : growth.stage.label;
  const statusDetail = empty
    ? resolvedEmptyState.detail
    : vacating
      ? `${fmtNumber(100 - occupancyPercent, 0)}% desocupado`
      : data.tipoAlimento || growth.stage.detail;
  const occupancyValue = fmtPercent(occupancyRatio, 0);
  const compactProgressRatio = empty ? resolvedEmptyState.progress : occupancyRatio;
  const compactProgressValue = fmtPercent(compactProgressRatio, 0);
  const compactProgressLabel = empty ? 'alistamiento' : 'ocupación';
  const entryLabel = vacating ? 'quedan' : 'entrada';
  const isOverdue = !empty && growth.isOverdue;
  const birdStageLabel = empty ? resolvedEmptyState.label : getBirdStageLabel(growth.index);
  const compactSubtitle = empty ? resolvedEmptyState.detail : data.tipoAlimento || growth.stage.detail;
  const style = {
    '--capacity-ratio': capacityRatio,
    '--occupancy-percent': `${Math.round(occupancyPercent)}%`,
    '--compact-progress-percent': `${Math.round(compactProgressRatio * 100)}%`,
    '--occupancy-ratio': occupancyRatio,
    '--departure-percent': `${Math.round(100 - occupancyPercent)}%`,
    '--growth-percent': `${Math.round(growth.progress * 100)}%`,
    '--growth-ratio': growth.progress,
    '--empty-progress-percent': `${Math.round(resolvedEmptyState.progress * 100)}%`,
    '--empty-progress-ratio': resolvedEmptyState.progress,
    '--flock-height': `${Math.round(38 + occupancyRatio * 124)}px`,
    '--flock-opacity': Math.min(0.95, 0.34 + occupancyRatio * 0.58),
  } as CSSProperties;

  return (
    <button
      type="button"
      className={[
        'farm-shed',
        'farm-shed--story',
        `farm-shed--${data.capacidad >= 2000 ? 'large' : 'small'}`,
        `farm-shed--occupancy-${occupancyTone}`,
        selected ? 'is-selected' : '',
        empty ? 'farm-shed--empty' : '',
        vacating ? 'farm-shed--vacating' : '',
        staleData ? 'farm-shed--stale-data' : '',
        isOverdue ? 'farm-shed--overdue' : '',
        'farm-shed--compact',
      ].join(' ')}
      style={style}
      aria-pressed={selected}
      aria-expanded={false}
      data-galpon-id={dataGalponId}
      onClick={onClick}
    >
      <section className="farm-shed__compact-summary">
        <div className="farm-shed__compact-top">
          <span className="farm-shed__compact-home">
            <House size={34} strokeWidth={1.9} />
          </span>
          <div className="farm-shed__compact-title">
            <strong>Galpón {data.galpon}</strong>
            <span>
              <Leaf size={17} />
              {compactSubtitle}
            </span>
          </div>
          <span className="farm-shed__compact-capacity">
            <small>Capacidad</small>
            <strong>{fmtNumber(data.capacidad)}</strong>
            <span>cap.</span>
          </span>
        </div>

        <div className="farm-shed__compact-main">
          <div className="farm-shed__compact-day">
            <small>Día</small>
            <strong>{empty ? '-' : fmtNumber(data.dia)}</strong>
            <span>{birdStageLabel}</span>
          </div>
          <div className="farm-shed__compact-bird" aria-hidden="true">
            {empty ? (
              <ShedProgressVisual progress={resolvedEmptyState.progress} />
            ) : (
              <img
                className={`farm-shed__compact-bird-image farm-shed__compact-bird-image--day-${chickenImage.day}`}
                src={chickenImage.src}
                alt=""
                loading="lazy"
                decoding="async"
              />
            )}
          </div>
          <div className="farm-shed__compact-weight">
            <small>Peso promedio</small>
            <strong>
              {empty ? '-' : fmtNumber(data.pesoPromedioKg, 2)}
              {!empty && <span>kg</span>}
            </strong>
            <span>
              <Scale size={16} />
              por pollo
            </span>
          </div>
        </div>

        <div className="farm-shed__compact-progress" aria-hidden="true">
          <span>
            <span />
          </span>
          <strong>{compactProgressValue}</strong>
          <small>{compactProgressLabel}</small>
        </div>

        <div className="farm-shed__compact-metrics">
          <CompactMetric icon={<Package size={26} />} label="Consumo en btos" value={empty ? '-' : `${fmtNumber(data.consumoBultos, 1)} btos`} detail="Alimento" />
          <CompactMetric icon={<Scale size={26} />} label="Conversión" value={empty ? '-' : fmtNumber(data.conversionCA, 2)} />
          <CompactMetric icon={<HeartPulse size={26} />} label="Mortalidad" value={empty ? '-' : `${fmtNumber(data.mortalidadPct, 1)}%`} />
        </div>
      </section>

      <header className="farm-shed__hero-header" aria-hidden={!selected}>
        <div className="farm-shed__title-block">
          <strong>Galpón {data.galpon}</strong>
        </div>
        <span className="farm-shed__status-pill">
          <span className="farm-shed__status-icon">
            <Leaf size={18} />
          </span>
          <span>
            <strong>{statusLabel}</strong>
            <small>{statusDetail}</small>
          </span>
        </span>
        <span className="farm-shed__capacity-pill">
          <UsersRound size={17} />
          <strong>{fmtNumber(data.capacidad)}</strong>
          <small>cap.</small>
        </span>
      </header>

      <section className="farm-shed__visual" aria-hidden="true">
        <span className="shed-room">
          <img className="shed-room__asset" src="/galpon-dashboard/shed-scene.svg" alt="" loading="lazy" decoding="async" />
        </span>
        <span className="farm-shed__visual-haze" />
        <StatBubble className="farm-shed__day-bubble" icon={<CalendarDays size={18} />} label="Día" value={empty ? '-' : fmtNumber(data.dia)} />
        <StatBubble
          className="farm-shed__weight-bubble"
          icon={<Scale size={18} />}
          label="Peso"
          value={empty ? '-' : fmtNumber(data.pesoPromedioKg, 2)}
          suffix="kg"
        />
        {empty ? (
          <ShedProgressVisual progress={resolvedEmptyState.progress} />
        ) : (
          <img
            className={`farm-shed__bird-image farm-shed__bird-image--day-${chickenImage.day}`}
            src={chickenImage.src}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
      </section>

      {empty ? <EmptyStateTrack currentIndex={resolvedEmptyState.index} /> : <GrowthTrack currentIndex={growth.index} />}

      <section className="farm-shed__occupancy-panel">
        <div className="farm-shed__occupancy-copy">
          <strong>{occupancyValue}</strong>
          <span>ocup.</span>
        </div>
        <span className="farm-shed__occupancy-action" aria-hidden="true">
          <Check size={21} />
        </span>
        <div className="farm-shed__count-copy">
          <span className="farm-shed__count-action" aria-hidden="true">
            <ArrowDown size={20} />
          </span>
          <strong>
            {fmtNumber(data.entrada)}
            <small> / {fmtNumber(data.capacidad)}</small>
          </strong>
          <span>{entryLabel}</span>
        </div>
        <span className="farm-shed__occupancy-badge">{occupancyValue}</span>
        <FlockLayer />
        <div className="farm-shed__vertical-meter" aria-hidden="true">
          <span className="farm-shed__vertical-track">
            <span />
          </span>
          <small>100%</small>
          <small>75%</small>
          <small>50%</small>
          <small>25%</small>
          <small>0%</small>
          <strong>{occupancyValue}</strong>
        </div>
      </section>

      <footer className="farm-shed__metric-dock">
        <MetricPill icon={<ShieldPlus size={21} />} label="Mort." value={empty ? '-' : `${fmtNumber(data.mortalidadPct, 1)}%`} />
        <MetricPill icon={<Package size={21} />} label="Cons." value={empty ? '-' : fmtKg(data.consumoKg, 0)} />
        <MetricPill icon={<BarChart3 size={21} />} label="CA" value={empty ? '-' : fmtNumber(data.conversionCA, 2)} />
        <MetricPill
          icon={<ClipboardList size={21} />}
          label="Pend."
          value={empty ? '-' : fmtNumber(data.pendientes)}
          tone={!empty && data.pendientes > 0 ? 'warn' : 'neutral'}
        />
      </footer>
    </button>
  );
}

export function GalponPremiumDashboardCard({
  data,
  empty = false,
  vacating = false,
  staleData = false,
  emptyState,
  capacityRatio = 1,
}: {
  data: GalponDashboardCardData;
  empty?: boolean;
  vacating?: boolean;
  staleData?: boolean;
  emptyState?: ReturnType<typeof getEmptyState>;
  capacityRatio?: number;
}) {
  const occupancyPercent = Math.min(100, Math.max(0, data.ocupacionPct));
  const occupancyRatio = occupancyPercent / 100;
  const occupancyTone = getOccupancyTone(occupancyPercent);
  const growth = getGrowthState(data.dia);
  const chickenImage = getChickenImage(data.dia);
  const resolvedEmptyState = emptyState ?? getEmptyState('VACIO');
  const statusLabel = empty ? resolvedEmptyState.label : vacating ? 'Salida' : growth.stage.label;
  const statusDetail = empty
    ? resolvedEmptyState.detail
    : vacating
      ? `${fmtNumber(100 - occupancyPercent, 0)}% desocupado`
      : data.tipoAlimento || growth.stage.detail;
  const occupancyValue = fmtPercent(occupancyRatio, 0);
  const entryLabel = vacating ? 'quedan' : 'entrada';
  const isOverdue = !empty && growth.isOverdue;
  const style = {
    '--capacity-ratio': capacityRatio,
    '--occupancy-percent': `${Math.round(occupancyPercent)}%`,
    '--occupancy-ratio': occupancyRatio,
    '--departure-percent': `${Math.round(100 - occupancyPercent)}%`,
    '--growth-percent': `${Math.round(growth.progress * 100)}%`,
    '--growth-ratio': growth.progress,
    '--empty-progress-percent': `${Math.round(resolvedEmptyState.progress * 100)}%`,
    '--empty-progress-ratio': resolvedEmptyState.progress,
    '--flock-height': `${Math.round(38 + occupancyRatio * 124)}px`,
    '--flock-opacity': Math.min(0.95, 0.34 + occupancyRatio * 0.58),
  } as CSSProperties;

  return (
    <article
      className={[
        'farm-shed',
        'farm-shed--story',
        'farm-shed--premium',
        'farm-shed--expanded',
        `farm-shed--${data.capacidad >= 2000 ? 'large' : 'small'}`,
        `farm-shed--occupancy-${occupancyTone}`,
        empty ? 'farm-shed--empty' : '',
        vacating ? 'farm-shed--vacating' : '',
        staleData ? 'farm-shed--stale-data' : '',
        isOverdue ? 'farm-shed--overdue' : '',
      ].join(' ')}
      style={style}
      aria-label={`Detalle visual del galpon ${data.galpon}`}
    >
      <header className="farm-shed__hero-header">
        <div className="farm-shed__title-block">
          <strong>Galpón {data.galpon}</strong>
        </div>
        <span className="farm-shed__status-pill">
          <span className="farm-shed__status-icon">
            <Leaf size={18} />
          </span>
          <span>
            <strong>{statusLabel}</strong>
            <small>{statusDetail}</small>
          </span>
        </span>
        <span className="farm-shed__capacity-pill">
          <UsersRound size={17} />
          <strong>{fmtNumber(data.capacidad)}</strong>
          <small>cap.</small>
        </span>
      </header>

      <section className="farm-shed__visual" aria-hidden="true">
        <span className="shed-room">
          <img className="shed-room__asset" src="/galpon-dashboard/shed-scene.svg" alt="" loading="lazy" decoding="async" />
        </span>
        <span className="farm-shed__visual-haze" />
        <StatBubble className="farm-shed__day-bubble" icon={<CalendarDays size={18} />} label="Día" value={empty ? '-' : fmtNumber(data.dia)} />
        <StatBubble
          className="farm-shed__weight-bubble"
          icon={<Scale size={18} />}
          label="Peso"
          value={empty ? '-' : fmtNumber(data.pesoPromedioKg, 2)}
          suffix="kg"
        />
        {empty ? (
          <ShedProgressVisual progress={resolvedEmptyState.progress} />
        ) : (
          <img
            className={`farm-shed__bird-image farm-shed__bird-image--day-${chickenImage.day}`}
            src={chickenImage.src}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
      </section>

      {empty ? <EmptyStateTrack currentIndex={resolvedEmptyState.index} /> : <GrowthTrack currentIndex={growth.index} />}

      <section className="farm-shed__occupancy-panel">
        <div className="farm-shed__occupancy-copy">
          <strong>{occupancyValue}</strong>
          <span>ocup.</span>
        </div>
        <span className="farm-shed__occupancy-action" aria-hidden="true">
          <Check size={21} />
        </span>
        <div className="farm-shed__count-copy">
          <span className="farm-shed__count-action" aria-hidden="true">
            <ArrowDown size={20} />
          </span>
          <strong>
            {fmtNumber(data.entrada)}
            <small> / {fmtNumber(data.capacidad)}</small>
          </strong>
          <span>{entryLabel}</span>
        </div>
        <span className="farm-shed__occupancy-badge">{occupancyValue}</span>
        <FlockLayer />
        <div className="farm-shed__vertical-meter" aria-hidden="true">
          <span className="farm-shed__vertical-track">
            <span />
          </span>
          <small>100%</small>
          <small>75%</small>
          <small>50%</small>
          <small>25%</small>
          <small>0%</small>
          <strong>{occupancyValue}</strong>
        </div>
      </section>

      <footer className="farm-shed__metric-dock">
        <MetricPill icon={<ShieldPlus size={21} />} label="Mort." value={empty ? '-' : `${fmtNumber(data.mortalidadPct, 1)}%`} />
        <MetricPill icon={<Package size={21} />} label="Cons." value={empty ? '-' : fmtKg(data.consumoKg, 0)} />
        <MetricPill icon={<BarChart3 size={21} />} label="CA" value={empty ? '-' : fmtNumber(data.conversionCA, 2)} />
        <MetricPill
          icon={<ClipboardList size={21} />}
          label="Pend."
          value={empty ? '-' : fmtNumber(data.pendientes)}
          tone={!empty && data.pendientes > 0 ? 'warn' : 'neutral'}
        />
      </footer>
    </article>
  );
}

function getBirdStageLabel(stageIndex: number) {
  switch (stageIndex) {
    case 0:
      return 'Pollo bebé';
    case 1:
      return 'Pollo bebé';
    case 2:
      return 'Pollo levante';
    case 3:
      return 'Pollo engorde';
    case 4:
      return 'Listo sacrificio';
    default:
      return 'Pasado';
  }
}

function getGrowthState(day: number) {
  const safeDay = Math.max(1, day);
  const index = growthStages.findIndex((stage) => safeDay <= stage.maxDay);
  const stageIndex = index >= 0 ? index : growthStages.length - 1;

  return {
    index: stageIndex,
    stage: growthStages[stageIndex],
    progress: growthStages.length <= 1 ? 1 : stageIndex / (growthStages.length - 1),
    isOverdue: safeDay >= 51,
  };
}

function getOccupancyTone(occupancyPercent: number) {
  if (occupancyPercent >= 90) return 'high';
  if (occupancyPercent >= 50) return 'medium';
  return 'low';
}

function getConsumptionBultos(assignments: LoteGalpon[], summary?: LoteResumen, registrosDiarios: RegistroDiarioLote[] = []) {
  const loteIds = new Set(assignments.map((assignment) => assignment.LoteID));
  const bultosFromRecords = registrosDiarios
    .filter((registro) => loteIds.has(registro.LoteID))
    .reduce((sum, registro) => sum + registro.BultosConsumidos, 0);

  if (bultosFromRecords > 0) return bultosFromRecords;
  return (summary?.ConsumoAcumuladoKg ?? 0) / DEFAULT_KG_PER_BULTO;
}

function getChickenImage(day: number) {
  const safeDay = Math.max(1, day);

  for (let index = chickenImages.length - 1; index >= 0; index -= 1) {
    if (safeDay >= chickenImages[index].day) return chickenImages[index];
  }

  return chickenImages[0];
}

function buildLatestRegistroDateMap(registros: RegistroDiarioLote[]): Map<string, FechaISO> {
  const latestByLote = new Map<string, FechaISO>();

  for (const registro of registros) {
    const current = latestByLote.get(registro.LoteID);
    if (!current || registro.Fecha > current) latestByLote.set(registro.LoteID, registro.Fecha);
  }

  return latestByLote;
}

function isGalponRegistroStale(assignments: LoteGalpon[], latestByLote: Map<string, FechaISO>, today: FechaISO): boolean {
  const yesterday = addDays(today, -1);
  const occupiedAssignments = assignments.filter((assignment) => Math.max(0, assignment.CantidadEntrada - assignment.CantidadSalida) > 0);

  return occupiedAssignments.some((assignment) => {
    const latestDate = latestByLote.get(assignment.LoteID);
    return !latestDate || latestDate < yesterday;
  });
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
          <span>{index === currentIndex && <Bird size={18} strokeWidth={2.5} />}</span>
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
      <img className="farm-shed__flock-asset" src="/galpon-dashboard/flock-mass.svg" alt="" loading="lazy" decoding="async" />
    </div>
  );
}

function CompactMetric({
  icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <span className={`farm-shed__compact-metric farm-shed__compact-metric--${tone}`}>
      <span className="farm-shed__compact-metric-icon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        {detail && <em>{detail}</em>}
      </span>
    </span>
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
