import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registrarEventoSanitario } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import type { EventoSanitario, Lote, Usuario } from '../../types/entities';

interface EventoSanitarioFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

export function EventoSanitarioForm({ lote, user, onSaved }: EventoSanitarioFormProps) {
  const galpones = useLiveQuery(() => db.loteGalpones.where('LoteID').equals(lote.LoteID).toArray(), [lote.LoteID]);
  const [galponId, setGalponId] = useState('');
  const [tipo, setTipo] = useState<EventoSanitario['TipoEvento']>('DIARREA');
  const [severidad, setSeveridad] = useState<EventoSanitario['Severidad']>('BAJA');
  const [descripcion, setDescripcion] = useState('');

  useEffect(() => {
    if (!galponId && galpones?.[0]) setGalponId(galpones[0].GalponID);
  }, [galponId, galpones]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await registrarEventoSanitario(
      {
        Fecha: todayISO(),
        LoteID: lote.LoteID,
        GalponID: galponId,
        TipoEvento: tipo,
        Severidad: severidad,
        Descripcion: descripcion,
      },
      user,
    );
    setDescripcion('');
    onSaved('Evento sanitario guardado offline.');
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
        <span>Tipo evento</span>
        <select value={tipo} onChange={(event) => setTipo(event.target.value as EventoSanitario['TipoEvento'])}>
          <option value="DIARREA">Diarrea</option>
          <option value="RESPIRATORIO">Respiratorio</option>
          <option value="MORTALIDAD_ALTA">Mortalidad alta</option>
          <option value="CAMA_HUMEDA">Cama húmeda</option>
          <option value="BAJO_CONSUMO">Bajo consumo</option>
          <option value="CALOR">Calor</option>
          <option value="PATAS">Patas</option>
          <option value="LESIONES">Lesiones</option>
          <option value="OTRO">Otro</option>
        </select>
      </label>
      <label className="field">
        <span>Severidad</span>
        <select value={severidad} onChange={(event) => setSeveridad(event.target.value as EventoSanitario['Severidad'])}>
          <option value="BAJA">Baja</option>
          <option value="MEDIA">Media</option>
          <option value="ALTA">Alta</option>
          <option value="CRITICA">Crítica</option>
        </select>
      </label>
      <label className="field field--full">
        <span>Descripción</span>
        <textarea rows={4} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} required />
      </label>
      <button className="primary-action">Guardar evento</button>
    </form>
  );
}
