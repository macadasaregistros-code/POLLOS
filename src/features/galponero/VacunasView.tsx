import { useLiveQuery } from 'dexie-react-hooks';
import { Syringe } from 'lucide-react';
import { aplicarVacuna } from '../../services/domainService';
import { db } from '../../services/localDbService';
import type { Lote, Usuario } from '../../types/entities';

interface VacunasViewProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

export function VacunasView({ lote, user, onSaved }: VacunasViewProps) {
  const vacunas = useLiveQuery(() => db.vacunasLote.where('LoteID').equals(lote.LoteID).sortBy('FechaProgramada'), [lote.LoteID]);

  return (
    <div className="stack">
      {vacunas?.map((vacuna) => (
        <article className="list-row" key={vacuna.VacunaLoteID}>
          <Syringe size={22} />
          <div>
            <strong>{vacuna.NombreVacuna}</strong>
            <span>
              Día {vacuna.DiaProgramado} · {vacuna.FechaProgramada} · {vacuna.Estado}
            </span>
          </div>
          {vacuna.Estado !== 'APLICADA' && (
            <button type="button" onClick={() => aplicarVacuna(vacuna.VacunaLoteID, user).then(() => onSaved('Vacuna marcada como aplicada.'))}>
              Aplicada
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
