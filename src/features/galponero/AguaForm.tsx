import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FormOptionalPanel } from '../../components/FormOptionalPanel';
import { registrarControlAgua } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import { fileToDataUrl } from '../../lib/photo';
import type { ControlAgua, Lote, Usuario } from '../../types/entities';

interface AguaFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

export function AguaForm({ lote, user, onSaved }: AguaFormProps) {
  const galpones = useLiveQuery(() => db.loteGalpones.where('LoteID').equals(lote.LoteID).toArray(), [lote.LoteID]);
  const [galponId, setGalponId] = useState('');
  const [dosificacion, setDosificacion] = useState('');
  const [ph, setPh] = useState('7.0');
  const [cloro, setCloro] = useState('1.0');
  const [lugar, setLugar] = useState<ControlAgua['LugarMedicion']>('LINEA');
  const [accion, setAccion] = useState('');
  const [foto, setFoto] = useState('');
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
        DosificacionCloroGr: Number(dosificacion || 0),
        VerificacionPH: Number(ph || 0),
        VerificacionCloro: Number(cloro || 0),
        LugarMedicion: lugar,
        AccionTomada: accion,
        Foto: foto,
        Observacion: observacion,
      },
      user,
    );
    setDosificacion('');
    setAccion('');
    setFoto('');
    setObservacion('');
    onSaved('Control de agua guardado offline.');
  }

  return (
    <form className="form-grid flow-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Galpon</span>
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
          <option value="LINEA">Linea</option>
          <option value="NIPPLE">Nipple</option>
        </select>
      </label>
      <label className="field">
        <span>Dosificacion cloro (gr)</span>
        <input type="number" step="0.1" inputMode="decimal" value={dosificacion} onChange={(event) => setDosificacion(event.target.value)} />
      </label>
      <label className="field">
        <span>pH</span>
        <input type="number" step="0.1" inputMode="decimal" value={ph} onChange={(event) => setPh(event.target.value)} />
      </label>
      <label className="field">
        <span>Verificacion cloro</span>
        <input type="number" step="0.1" inputMode="decimal" value={cloro} onChange={(event) => setCloro(event.target.value)} />
      </label>
      <FormOptionalPanel label="Detalles adicionales" value={accion || foto || observacion}>
        <div className="form-grid form-grid--nested">
          <label className="field field--full">
            <span>Accion tomada</span>
            <input value={accion} onChange={(event) => setAccion(event.target.value)} />
          </label>
          <label className="field field--full">
            <span>Foto opcional</span>
            <input type="file" accept="image/*" capture="environment" onChange={(event) => void fileToDataUrl(event.target.files?.[0]).then(setFoto)} />
          </label>
          <label className="field field--full">
            <span>Observacion</span>
            <textarea rows={3} value={observacion} onChange={(event) => setObservacion(event.target.value)} />
          </label>
        </div>
      </FormOptionalPanel>
      <button className="primary-action">Guardar agua</button>
    </form>
  );
}
