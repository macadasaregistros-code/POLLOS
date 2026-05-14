import type { CSSProperties } from 'react';
import { fmtNumber, fmtPercent } from '../lib/format';
import type { Galpon, Lote, LoteGalpon, LoteResumen } from '../types/entities';

interface GalponMapProps {
  galpones: Galpon[];
  loteGalpones: LoteGalpon[];
  lotes: Lote[];
  summaries: LoteResumen[];
  selectedLoteId?: string;
  onSelectLote: (loteId: string) => void;
}

const layout = [
  { label: 'Galpón 1', ids: ['galpon_1A', 'galpon_1B'], variant: 'vertical' },
  { label: 'Galpón 2', ids: ['galpon_2A', 'galpon_2B'], variant: 'vertical' },
  { label: 'Galpón 3', ids: ['galpon_3A', 'galpon_3B'], variant: 'horizontal' },
] as const;

export function GalponMap({ galpones, loteGalpones, lotes, summaries, selectedLoteId, onSelectLote }: GalponMapProps) {
  const galponesById = new Map(galpones.map((galpon) => [galpon.GalponID, galpon]));
  const lotesById = new Map(lotes.map((lote) => [lote.LoteID, lote]));
  const summariesByLoteId = new Map(summaries.map((summary) => [summary.LoteID, summary]));
  const maxCapacity = Math.max(...galpones.map((galpon) => galpon.Capacidad), 2500);

  return (
    <section className="farm-map-card" aria-label="Plano visual de galpones">
      <header className="farm-map-card__header">
        <div>
          <span>Vista principal</span>
          <h2>Galpones</h2>
        </div>
        <strong>{fmtNumber(galpones.length)} unidades</strong>
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
                    selectedLoteId={selectedLoteId}
                    maxCapacity={maxCapacity}
                    onSelectLote={onSelectLote}
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
  selectedLoteId,
  maxCapacity,
  onSelectLote,
}: {
  galpon: Galpon;
  loteGalpones: LoteGalpon[];
  lotesById: Map<string, Lote>;
  summariesByLoteId: Map<string, LoteResumen>;
  selectedLoteId?: string;
  maxCapacity: number;
  onSelectLote: (loteId: string) => void;
}) {
  const assignments = loteGalpones.filter((item) => item.GalponID === galpon.GalponID && item.Estado === 'ACTIVO');
  const primaryAssignment = assignments[0];
  const lote = primaryAssignment ? lotesById.get(primaryAssignment.LoteID) : undefined;
  const summary = lote ? summariesByLoteId.get(lote.LoteID) : undefined;
  const avesEnGalpon = assignments.reduce((sum, item) => sum + Math.max(0, item.CantidadEntrada - item.CantidadSalida), 0);
  const ocupacion = galpon.Capacidad > 0 ? Math.min(1, avesEnGalpon / galpon.Capacidad) : 0;
  const capacityRatio = Math.max(0.45, galpon.Capacidad / maxCapacity);
  const isSelected = Boolean(selectedLoteId && assignments.some((item) => item.LoteID === selectedLoteId));
  const stage = galpon.EstadoActual.replaceAll('_', ' ');
  const style = { '--capacity-ratio': capacityRatio, '--occupancy-percent': `${Math.round(ocupacion * 100)}%` } as CSSProperties;

  return (
    <button
      type="button"
      className={`farm-shed farm-shed--${galpon.Capacidad >= 2000 ? 'large' : 'small'} ${isSelected ? 'is-selected' : ''}`}
      style={style}
      onClick={() => {
        if (lote) onSelectLote(lote.LoteID);
      }}
    >
      <span className="farm-shed__stage">{stage}</span>
      <header>
        <div>
          <span>Galpón</span>
          <strong>{galpon.NombreGalpon}</strong>
        </div>
        <small>{fmtNumber(galpon.Capacidad)} aves</small>
      </header>
      <div className="farm-shed__body">
        <strong>{fmtNumber(avesEnGalpon)} aves</strong>
        <span>{lote?.CodigoLote ?? 'Sin lote activo'}</span>
      </div>
      <div className="farm-shed__bar" aria-label={`Ocupación ${fmtPercent(ocupacion)}`}>
        <span />
      </div>
      {summary && (
        <footer>
          <span>Día {summary.DiaLote}</span>
          <span>Mort. {fmtPercent(summary.MortalidadAcumulada)}</span>
          <span>Pend. {fmtNumber(summary.PendientesHoy)}</span>
        </footer>
      )}
    </button>
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
