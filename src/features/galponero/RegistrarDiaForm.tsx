import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registrarDia } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { getDiaLote, todayISO } from '../../lib/date';
import type { Lote, TipoAlimento, Usuario } from '../../types/entities';

interface RegistrarDiaFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

const foodOrder = ['preiniciador', 'iniciador', 'engorde'] as const;

export function RegistrarDiaForm({ lote, user, onSaved }: RegistrarDiaFormProps) {
  const tiposAlimento = useLiveQuery(() => db.tiposAlimento.toArray().then((items) => items.filter((item) => item.Activo)), []);
  const registrosLote = useLiveQuery(() => db.registroDiarioLote.where('LoteID').equals(lote.LoteID).toArray(), [lote.LoteID]);
  const salidasLote = useLiveQuery(() => db.salidasPollo.where('LoteID').equals(lote.LoteID).toArray(), [lote.LoteID]);
  const today = todayISO();
  const diaLote = getDiaLote(lote.FechaLlegada, today);
  const [tipoAlimentoId, setTipoAlimentoId] = useState('');
  const [bultos, setBultos] = useState('0');
  const [muertosM, setMuertosM] = useState('0');
  const [muertosH, setMuertosH] = useState('0');
  const [muertosSinClasificar, setMuertosSinClasificar] = useState('0');
  const [sacrificadosM, setSacrificadosM] = useState('0');
  const [sacrificadosH, setSacrificadosH] = useState('0');
  const [sacrificioActivo, setSacrificioActivo] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);

  const tiposOrdenados = useMemo(() => orderFoodTypes(tiposAlimento ?? []), [tiposAlimento]);
  const defaultTipo = tiposOrdenados[0]?.TipoAlimentoID ?? '';
  const latestTipoAlimentoId = useMemo(() => getLatestTipoAlimentoId(registrosLote ?? [], tiposOrdenados), [registrosLote, tiposOrdenados]);
  const currentTipoId = tipoAlimentoId || latestTipoAlimentoId || defaultTipo;
  const sacrificeStorageKey = `pollos.sacrificioActivo.${lote.LoteID}`;
  const sacrificeCanStart = diaLote > 35;
  const sacrificeAlreadyStarted = useMemo(
    () =>
      (registrosLote ?? []).some((registro) => registro.SacrificadosMachos + registro.SacrificadosHembras > 0) ||
      (salidasLote ?? []).some((salida) => salida.TipoSalida === 'SACRIFICIO'),
    [registrosLote, salidasLote],
  );
  const kgConsumidos = Number(bultos || 0) * 40;

  useEffect(() => {
    setTipoAlimentoId(latestTipoAlimentoId || defaultTipo);
  }, [defaultTipo, latestTipoAlimentoId, lote.LoteID]);

  useEffect(() => {
    const stored = window.localStorage.getItem(sacrificeStorageKey) === '1';
    setSacrificioActivo(sacrificeCanStart && (stored || sacrificeAlreadyStarted));
  }, [lote.LoteID, sacrificeAlreadyStarted, sacrificeCanStart, sacrificeStorageKey]);

  function handleActivateSacrifice() {
    if (!sacrificeCanStart) return;
    window.localStorage.setItem(sacrificeStorageKey, '1');
    setSacrificioActivo(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentTipoId) return;
    setSaving(true);
    try {
      await registrarDia(
        {
          LoteID: lote.LoteID,
          Fecha: today,
          TipoAlimentoID: currentTipoId,
          BultosConsumidos: Number(bultos || 0),
          KgConsumidos: kgConsumidos,
          MuertosMachos: Number(muertosM || 0),
          MuertosHembras: Number(muertosH || 0),
          MuertosSinClasificar: Number(muertosSinClasificar || 0),
          SacrificadosMachos: sacrificioActivo ? Number(sacrificadosM || 0) : 0,
          SacrificadosHembras: sacrificioActivo ? Number(sacrificadosH || 0) : 0,
          Observaciones: observacion,
        },
        user,
      );
      setBultos('0');
      setMuertosM('0');
      setMuertosH('0');
      setMuertosSinClasificar('0');
      setSacrificadosM('0');
      setSacrificadosH('0');
      setObservacion('');
      onSaved('Registro diario guardado offline.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <section className="form-section">
        <h3>Alimentación</h3>
        <div className="form-grid">
          <label className="field">
            <span>Tipo alimento</span>
            <select value={currentTipoId} onChange={(event) => setTipoAlimentoId(event.target.value)} required>
              {tiposOrdenados.map((tipo) => (
                <option key={tipo.TipoAlimentoID} value={tipo.TipoAlimentoID}>
                  {tipo.Nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Bultos consumidos</span>
            <input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.25"
              value={bultos}
              onChange={(event) => setBultos(event.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Mortalidad</h3>
        <div className="count-button-grid">
          <CountButton label="Machos" value={muertosM} onChange={setMuertosM} />
          <CountButton label="Hembras" value={muertosH} onChange={setMuertosH} />
        </div>
      </section>

      <section className="form-section">
        <h3>Sacrificio</h3>
        {sacrificioActivo ? (
          <div className="count-button-grid">
            <CountButton label="Machos" value={sacrificadosM} onChange={setSacrificadosM} />
            <CountButton label="Hembras" value={sacrificadosH} onChange={setSacrificadosH} />
          </div>
        ) : sacrificeCanStart ? (
          <button className="sacrifice-start-button" type="button" onClick={handleActivateSacrifice}>
            Activar sacrificio para este lote
          </button>
        ) : (
          <div className="sacrifice-locked">
            <strong>Día {diaLote}</strong>
            <span>El sacrificio se puede activar desde el día 36 del lote.</span>
          </div>
        )}
      </section>

      <label className="field field--full">
        <span>Observación</span>
        <textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} rows={3} />
      </label>
      <button className="primary-action" disabled={saving || !currentTipoId}>
        Guardar registro diario
      </button>
    </form>
  );
}

function CountButton({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const current = Number(value || 0);

  function setNext(nextValue: number) {
    onChange(String(Math.max(0, nextValue)));
  }

  return (
    <div className="count-button">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Restar ${label}`} onClick={() => setNext(current - 1)}>
          -
        </button>
        <input inputMode="numeric" type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" aria-label={`Sumar ${label}`} onClick={() => setNext(current + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

function normalizeFoodName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getFoodOrderIndex(tipo: TipoAlimento): number {
  const normalized = normalizeFoodName(tipo.Nombre);
  const index = foodOrder.findIndex((name) => normalized.includes(name));
  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}

function orderFoodTypes(tipos: TipoAlimento[]): TipoAlimento[] {
  const ordered = tipos
    .filter((tipo) => getFoodOrderIndex(tipo) !== Number.POSITIVE_INFINITY)
    .sort((left, right) => getFoodOrderIndex(left) - getFoodOrderIndex(right));
  return ordered.length > 0 ? ordered : tipos;
}

function getLatestTipoAlimentoId(
  registros: Array<{ Fecha: string; FechaHoraRegistro: string; TipoAlimentoID: string }>,
  tipos: TipoAlimento[],
): string {
  const validIds = new Set(tipos.map((tipo) => tipo.TipoAlimentoID));
  return (
    registros
      .filter((registro) => validIds.has(registro.TipoAlimentoID))
      .sort((left, right) => right.Fecha.localeCompare(left.Fecha) || right.FechaHoraRegistro.localeCompare(left.FechaHoraRegistro))[0]
      ?.TipoAlimentoID ?? ''
  );
}
