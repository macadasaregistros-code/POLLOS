import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { crearLote } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import type { Usuario } from '../../types/entities';

interface CrearLoteFormProps {
  user: Usuario;
  onSaved: (message: string) => void;
}

export function CrearLoteForm({ user, onSaved }: CrearLoteFormProps) {
  const proveedores = useLiveQuery(
    async () => {
      const activos = (await db.proveedores.toArray()).filter((item) => item.Activo);
      const pollito = activos.filter((item) => item.TipoProveedor === 'POLLITO');
      return pollito.length > 0 ? pollito : activos;
    },
    [],
  );
  const galpones = useLiveQuery(() => db.galpones.toArray().then((items) => items.filter((item) => item.Activo)), []);
  const [codigo, setCodigo] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [machos, setMachos] = useState('0');
  const [hembras, setHembras] = useState('0');
  const [proveedorId, setProveedorId] = useState('');
  const [galponId, setGalponId] = useState('');
  const [linea, setLinea] = useState('Cobb 500');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (!proveedorId && proveedores?.[0]) setProveedorId(proveedores[0].ProveedorID);
    if (!galponId && galpones?.[0]) setGalponId(galpones[0].GalponID);
  }, [galponId, galpones, proveedorId, proveedores]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await crearLote(
      {
        CodigoLote: codigo,
        FechaLlegada: fecha,
        CantidadInicialMachos: Number(machos || 0),
        CantidadInicialHembras: Number(hembras || 0),
        ProveedorPollitoID: proveedorId,
        LineaGenetica: linea,
        GalponID: galponId,
        Observaciones: observaciones,
      },
      user,
    );
    setCodigo('');
    setMachos('0');
    setHembras('0');
    setObservaciones('');
    onSaved('Lote creado offline con actividades y vacunas programadas.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        <span>Código lote</span>
        <input value={codigo} onChange={(event) => setCodigo(event.target.value)} required />
      </label>
      <label className="field">
        <span>Fecha llegada</span>
        <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} required />
      </label>
      <label className="field">
        <span>Machos iniciales</span>
        <input type="number" min="0" inputMode="numeric" value={machos} onChange={(event) => setMachos(event.target.value)} />
      </label>
      <label className="field">
        <span>Hembras iniciales</span>
        <input type="number" min="0" inputMode="numeric" value={hembras} onChange={(event) => setHembras(event.target.value)} />
      </label>
      <label className="field">
        <span>Proveedor pollito</span>
        <select value={proveedorId} onChange={(event) => setProveedorId(event.target.value)}>
          {proveedores?.map((proveedor) => (
            <option key={proveedor.ProveedorID} value={proveedor.ProveedorID}>
              {proveedor.NombreProveedor}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Galpón inicial</span>
        <select value={galponId} onChange={(event) => setGalponId(event.target.value)}>
          {galpones?.map((galpon) => (
            <option key={galpon.GalponID} value={galpon.GalponID}>
              {galpon.NombreGalpon} · {galpon.EstadoActual}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Línea genética</span>
        <input value={linea} onChange={(event) => setLinea(event.target.value)} />
      </label>
      <label className="field field--full">
        <span>Observaciones</span>
        <textarea rows={3} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
      </label>
      <button className="primary-action">Crear lote</button>
    </form>
  );
}
