import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registrarEntradaAlimento } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import type { Usuario } from '../../types/entities';

interface EntradaAlimentoFormProps {
  user: Usuario;
  onSaved: (message: string) => void;
}

export function EntradaAlimentoForm({ user, onSaved }: EntradaAlimentoFormProps) {
  const tipos = useLiveQuery(() => db.tiposAlimento.toArray().then((items) => items.filter((item) => item.Activo)), []);
  const proveedores = useLiveQuery(
    async () => {
      const activos = (await db.proveedores.toArray()).filter((item) => item.Activo);
      const alimento = activos.filter((item) => item.TipoProveedor === 'ALIMENTO');
      return alimento.length > 0 ? alimento : activos;
    },
    [],
  );
  const [tipoId, setTipoId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [bultos, setBultos] = useState('0');
  const [observaciones, setObservaciones] = useState('');
  const selected = useMemo(() => tipos?.find((tipo) => tipo.TipoAlimentoID === tipoId), [tipoId, tipos]);

  useEffect(() => {
    if (!tipoId && tipos?.[0]) setTipoId(tipos[0].TipoAlimentoID);
    if (!proveedorId && proveedores?.[0]) setProveedorId(proveedores[0].ProveedorID);
  }, [proveedorId, proveedores, tipoId, tipos]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await registrarEntradaAlimento(
      {
        Fecha: todayISO(),
        TipoAlimentoID: selected.TipoAlimentoID,
        CantidadBultos: Number(bultos || 0),
        KgPorBulto: selected.KgPorBulto,
        ProveedorID: proveedorId,
        Observaciones: observaciones,
      },
      user,
    );
    setBultos('0');
    setObservaciones('');
    onSaved('Entrada de alimento guardada offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        <span>Tipo alimento</span>
        <select value={tipoId} onChange={(event) => setTipoId(event.target.value)} required>
          {tipos?.map((tipo) => (
            <option key={tipo.TipoAlimentoID} value={tipo.TipoAlimentoID}>
              {tipo.Nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Proveedor</span>
        <select value={proveedorId} onChange={(event) => setProveedorId(event.target.value)}>
          {proveedores?.map((proveedor) => (
            <option key={proveedor.ProveedorID} value={proveedor.ProveedorID}>
              {proveedor.NombreProveedor}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Bultos</span>
        <input type="number" min="0" step="0.25" inputMode="decimal" value={bultos} onChange={(event) => setBultos(event.target.value)} />
      </label>
      <label className="field">
        <span>Kg total</span>
        <input readOnly value={(Number(bultos || 0) * (selected?.KgPorBulto ?? 0)).toFixed(1)} />
      </label>
      <label className="field field--full">
        <span>Observaciones</span>
        <textarea rows={3} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
      </label>
      <button className="primary-action">Guardar entrada</button>
    </form>
  );
}
