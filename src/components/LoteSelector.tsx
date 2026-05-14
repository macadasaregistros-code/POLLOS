import type { Lote } from '../types/entities';

interface LoteSelectorProps {
  lotes: Lote[];
  value: string;
  onChange: (loteId: string) => void;
}

export function LoteSelector({ lotes, value, onChange }: LoteSelectorProps) {
  return (
    <label className="field">
      <span>Lote</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {lotes.map((lote) => (
          <option key={lote.LoteID} value={lote.LoteID}>
            {lote.CodigoLote}
          </option>
        ))}
      </select>
    </label>
  );
}
