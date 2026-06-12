import { useLiveQuery } from 'dexie-react-hooks';
import { ChecklistItem } from '../../components/ChecklistItem';
import { actualizarActividad, cerrarActividadesPendientesDelDia } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import type { ActividadLote, Lote, Usuario } from '../../types/entities';

interface ActividadesHoyProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

export function ActividadesHoy({ lote, user, onSaved }: ActividadesHoyProps) {
  const today = todayISO();
  const actividades = useLiveQuery(
    () =>
      db.actividadesLote
        .where('LoteID')
        .equals(lote.LoteID)
        .and((actividad) => actividad.FechaProgramada <= today && actividad.Estado !== 'REALIZADA' && actividad.Estado !== 'NO_APLICA')
        .sortBy('FechaProgramada'),
    [lote.LoteID, today],
  );

  async function handleChange(actividad: ActividadLote, estado: ActividadLote['Estado']) {
    const needsGas = actividad.NombreActividad.toLowerCase().includes('retirada calentadoras') && estado === 'REALIZADA';
    const gas = needsGas ? Number(window.prompt('Cilindros de gas consumidos') ?? 0) : undefined;
    await actualizarActividad(actividad.ActividadLoteID, estado, user, '', gas);
    onSaved('Actividad guardada en este dispositivo.');
  }

  return (
    <div className="stack">
      <div className="section-actions">
        <button type="button" onClick={() => cerrarActividadesPendientesDelDia(lote.LoteID, user).then(() => onSaved('Día cerrado con pendientes registrados.'))}>
          Cerrar día
        </button>
      </div>
      {actividades?.length ? (
        actividades.map((actividad) => (
          <ChecklistItem key={actividad.ActividadLoteID} actividad={actividad} onChange={(estado) => handleChange(actividad, estado)} />
        ))
      ) : (
        <p className="empty-state">No hay actividades pendientes para este lote.</p>
      )}
    </div>
  );
}
