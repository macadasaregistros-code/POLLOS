import { useMemo, useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { actualizarActividad } from '../services/domainService';
import { buildRoutineMatrix, routineFrequencyLabels, type RoutineMatrixCell } from '../services/routineService';
import type { ActividadLote, Usuario } from '../types/entities';

interface RoutineMatrixProps {
  actividades: ActividadLote[];
  today: string;
  user?: Usuario;
  editable?: boolean;
  onSaved?: (message: string) => void;
}

export function RoutineMatrix({ actividades, today, user, editable = false, onSaved }: RoutineMatrixProps) {
  const [savingKey, setSavingKey] = useState('');
  const matrix = useMemo(() => buildRoutineMatrix(actividades, today), [actividades, today]);

  async function handleToggle(rowName: string, cell: RoutineMatrixCell) {
    if (!editable || !user || cell.disabled) return;
    const savingId = `${rowName}:${cell.date}`;
    setSavingKey(savingId);
    try {
      const nextState = cell.completed < cell.total ? 'REALIZADA' : 'PENDIENTE';
      for (const activityId of cell.activityIds) {
        await actualizarActividad(activityId, nextState, user);
      }
      onSaved?.(nextState === 'REALIZADA' ? 'Rutina marcada como realizada.' : 'Rutina devuelta a pendiente.');
    } finally {
      setSavingKey('');
    }
  }

  return (
    <div className="routine-matrix">
      <header className="routine-matrix__header">
        <div>
          <strong>Rutinas del mes</strong>
          <span>{matrix.month}</span>
        </div>
        <div className="routine-matrix__legend" aria-label="Estados">
          <span><i className="routine-dot routine-dot--done" /> Hecha</span>
          <span><i className="routine-dot routine-dot--pending" /> Falta</span>
        </div>
      </header>

      <div className="routine-matrix__scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Actividad</th>
              {matrix.days.map((day) => (
                <th scope="col" key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  <strong>{row.name}</strong>
                  <span>{routineFrequencyLabels[row.frequency]}</span>
                </th>
                {row.cells.map((cell) => {
                  const key = `${row.name}:${cell.date}`;
                  return (
                    <td key={cell.date} className={`routine-cell routine-cell--${cell.state}`}>
                      {cell.total === 0 ? (
                        <span className="routine-cell__blank" aria-label="Sin rutina programada" />
                      ) : (
                        <button
                          type="button"
                          disabled={!editable || !user || cell.disabled || savingKey === key}
                          aria-label={`${row.name} ${cell.date}`}
                          onClick={() => void handleToggle(row.name, cell)}
                        >
                          {cell.state === 'done' && <Check size={15} />}
                          {cell.state === 'partial' && <span>{cell.completed}/{cell.total}</span>}
                          {cell.state === 'pending' && <Minus size={15} />}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matrix.rows.length === 0 && <p className="empty-state">No hay rutinas programadas para este mes.</p>}
    </div>
  );
}
