import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registrarControlAgua } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import type { ControlAgua, Lote, Usuario } from '../../types/entities';

interface AguaFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

export function AguaForm({ lote, user, onSaved }: AguaFormProps) {
  const galpones = useLiveQuery(() => db.loteGalpones.where('LoteID').equals(lote.LoteID).toArray(), [lote.LoteID]);
  const [galponId, setGalponId] = useState('');
  const [ph, setPh] = useState('7.0');
  const [cloro, setCloro] = useState('1.0');
  const [lugar, setLugar] = useState<ControlAgua['LugarMedicion']>('LINEA');
  const [accion, setAccion] = useState('');
  const [observacion, setObservacion] = useState('');

  useEffect(() => {
    if (!galponId && galpones?.[0]) setGalponId(galpones[0].GalponID);
  }, [galponId, galpones]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await registrarControlAgua(
      {
        Fecha: todayISO(),
        LoteID: lote.LoteID,
        GalponID: galponId,
        PH: Number(ph || 0),
        CloroLibrePPM: Number(cloro || 0),
        LugarMedicion: lugar,
        AccionTomada: accion,
        Observacion: observacion,
      },
      user,
    );
    setAccion('');
    setObservacion('');
    onSaved('Control de agua guardado offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        <span>Galpón</span>
        <select value={galponId} onChange={(event) => setGalponId(event.target.value)}>
          {galpones?.map((item) => (
            <option key={item.LoteGalponID} value={item.GalponID}>
              {item.GalponID}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Lugar</span>
        <select value={lugar} onChange={(event) => setLugar(event.target.value as ControlAgua['LugarMedicion'])}>
          <option value="TANQUE">Tanque</option>
          <option value="LINEA">Línea</option>
          <option value="NIPPLE">Nipple</option>
        </select>
      </label>
      <label className="field">
        <span>pH</span>
        <input type="number" step="0.1" inputMode="decimal" value={ph} onChange={(event) => setPh(event.target.value)} />
      </label>
      <label className="field">
        <span>Cloro libre PPM</span>
        <input type="number" step="0.1" inputMode="decimal" value={cloro} onChange={(event) => setCloro(event.target.value)} />
      </label>
      <label className="field field--full">
        <span>Acción tomada</span>
        <input value={accion} onChange={(event) => setAccion(event.target.value)} />
      </label>
      <label className="field field--full">
        <span>Observación</span>
        <textarea rows={3} value={observacion} onChange={(event) => setObservacion(event.target.value)} />
      </label>
      <button className="primary-action">Guardar agua</button>
    </form>
  );
}
