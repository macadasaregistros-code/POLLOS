import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registrarSalida } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import type { Lote, SexoLote, Usuario } from '../../types/entities';

interface SalidaFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

export function SalidaForm({ lote, user, onSaved }: SalidaFormProps) {
  const clientes = useLiveQuery(() => db.clientes.toArray().then((items) => items.filter((item) => item.Activo)), []);
  const [clienteId, setClienteId] = useState('');
  const [tipoSalida, setTipoSalida] = useState<'VENTA' | 'SACRIFICIO'>('VENTA');
  const [sexo, setSexo] = useState<SexoLote>('MIXTO');
  const [cantidad, setCantidad] = useState('0');
  const [kg, setKg] = useState('0');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (!clienteId && clientes?.[0]) setClienteId(clientes[0].ClienteID);
  }, [clienteId, clientes]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await registrarSalida(
      {
        Fecha: todayISO(),
        LoteID: lote.LoteID,
        TipoSalida: tipoSalida,
        Sexo: sexo,
        CantidadAves: Number(cantidad || 0),
        PesoTotalKg: Number(kg || 0),
        ClienteID: clienteId,
        Observaciones: observaciones,
      },
      user,
    );
    setCantidad('0');
    setKg('0');
    setObservaciones('');
    onSaved('Salida guardada offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        <span>Tipo salida</span>
        <select value={tipoSalida} onChange={(event) => setTipoSalida(event.target.value as 'VENTA' | 'SACRIFICIO')}>
          <option value="VENTA">Venta</option>
          <option value="SACRIFICIO">Sacrificio</option>
        </select>
      </label>
      <label className="field">
        <span>Sexo</span>
        <select value={sexo} onChange={(event) => setSexo(event.target.value as SexoLote)}>
          <option value="MIXTO">Mixto</option>
          <option value="MACHO">Macho</option>
          <option value="HEMBRA">Hembra</option>
        </select>
      </label>
      <label className="field">
        <span>Aves</span>
        <input type="number" min="0" inputMode="numeric" value={cantidad} onChange={(event) => setCantidad(event.target.value)} />
      </label>
      <label className="field">
        <span>Peso total kg</span>
        <input type="number" min="0" step="0.01" inputMode="decimal" value={kg} onChange={(event) => setKg(event.target.value)} />
      </label>
      {tipoSalida === 'VENTA' && (
        <label className="field">
          <span>Cliente</span>
          <select value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
            {clientes?.map((cliente) => (
              <option key={cliente.ClienteID} value={cliente.ClienteID}>
                {cliente.NombreCliente}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field field--full">
        <span>Observación</span>
        <textarea rows={3} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
      </label>
      <button className="primary-action">Guardar salida</button>
    </form>
  );
}
