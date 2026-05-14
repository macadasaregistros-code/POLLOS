import { Check, Minus, X } from 'lucide-react';
import type { ActividadLote } from '../types/entities';

interface ChecklistItemProps {
  actividad: ActividadLote;
  onChange: (estado: ActividadLote['Estado']) => void;
}

export function ChecklistItem({ actividad, onChange }: ChecklistItemProps) {
  return (
    <article className={`checklist-item checklist-item--${actividad.Estado.toLowerCase()}`}>
      <div>
        <strong>{actividad.NombreActividad}</strong>
        <span>
          {actividad.Categoria} · día {actividad.DiaLote}
        </span>
      </div>
      <div className="checklist-item__actions">
        <button aria-label="Marcar realizada" title="Realizada" onClick={() => onChange('REALIZADA')}>
          <Check size={22} />
        </button>
        <button aria-label="Marcar no realizada" title="No realizada" onClick={() => onChange('NO_REALIZADA')}>
          <X size={22} />
        </button>
        <button aria-label="Marcar no aplica" title="No aplica" onClick={() => onChange('NO_APLICA')}>
          <Minus size={22} />
        </button>
      </div>
    </article>
  );
}
