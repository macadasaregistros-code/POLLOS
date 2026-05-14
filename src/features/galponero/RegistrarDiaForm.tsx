import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registrarDia } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import type { Lote, Usuario } from '../../types/entities';

interface RegistrarDiaFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

export function RegistrarDiaForm({ lote, user, onSaved }: RegistrarDiaFormProps) {
  const tiposAlimento = useLiveQuery(() => db.tiposAlimento.toArray().then((items) => items.filter((item) => item.Activo)), []);
  const defaultTipo = tiposAlimento?.[0]?.TipoAlimentoID ?? '';
  const [tipoAlimentoId, setTipoAlimentoId] = useState(defaultTipo);
  const [bultos, setBultos] = useState('0');
  const [muertosM, setMuertosM] = useState('0');
  const [muertosH, setMuertosH] = useState('0');
  const [muertosSinClasificar, setMuertosSinClasificar] = useState('0');
  const [sacrificadosM, setSacrificadosM] = useState('0');
  const [sacrificadosH, setSacrificadosH] = useState('0');
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);

  const currentTipoId = tipoAlimentoId || defaultTipo;
  const selectedTipo = useMemo(
    () => tiposAlimento?.find((tipo) => tipo.TipoAlimentoID === currentTipoId),
    [currentTipoId, tiposAlimento],
  );
  const kgConsumidos = Number(bultos || 0) * (selectedTipo?.KgPorBulto ?? 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentTipoId) return;
    setSaving(true);
    try {
      await registrarDia(
        {
          LoteID: lote.LoteID,
          Fecha: todayISO(),
          TipoAlimentoID: currentTipoId,
          BultosConsumidos: Number(bultos || 0),
          KgConsumidos: kgConsumidos,
          MuertosMachos: Number(muertosM || 0),
          MuertosHembras: Number(muertosH || 0),
          MuertosSinClasificar: Number(muertosSinClasificar || 0),
          SacrificadosMachos: Number(sacrificadosM || 0),
          SacrificadosHembras: Number(sacrificadosH || 0),
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
      <label className="field">
        <span>Tipo alimento</span>
        <select value={currentTipoId} onChange={(event) => setTipoAlimentoId(event.target.value)} required>
          {tiposAlimento?.map((tipo) => (
            <option key={tipo.TipoAlimentoID} value={tipo.TipoAlimentoID}>
              {tipo.Nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Bultos consumidos</span>
        <input inputMode="decimal" type="number" min="0" step="0.25" value={bultos} onChange={(event) => setBultos(event.target.value)} />
      </label>
      <label className="field">
        <span>Kg consumidos</span>
        <input value={kgConsumidos.toFixed(1)} readOnly />
      </label>
      <label className="field">
        <span>Muertos machos</span>
        <input inputMode="numeric" type="number" min="0" value={muertosM} onChange={(event) => setMuertosM(event.target.value)} />
      </label>
      <label className="field">
        <span>Muertas hembras</span>
        <input inputMode="numeric" type="number" min="0" value={muertosH} onChange={(event) => setMuertosH(event.target.value)} />
      </label>
      <label className="field">
        <span>Sin clasificar</span>
        <input
          inputMode="numeric"
          type="number"
          min="0"
          value={muertosSinClasificar}
          onChange={(event) => setMuertosSinClasificar(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Sacrificados machos</span>
        <input inputMode="numeric" type="number" min="0" value={sacrificadosM} onChange={(event) => setSacrificadosM(event.target.value)} />
      </label>
      <label className="field">
        <span>Sacrificadas hembras</span>
        <input inputMode="numeric" type="number" min="0" value={sacrificadosH} onChange={(event) => setSacrificadosH(event.target.value)} />
      </label>
      <label className="field field--full">
        <span>Observación</span>
        <textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} rows={3} />
      </label>
      <button className="primary-action" disabled={saving || !currentTipoId}>
        Guardar registro
      </button>
    </form>
  );
}
