import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FormOptionalPanel } from '../../components/FormOptionalPanel';
import { registrarEntradaAlimento } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import type { Usuario } from '../../types/entities';
import { FoodTypeSelector, getFeedTypeOptions } from './FeedTypeSelector';

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
  const tipoOptions = useMemo(() => getFeedTypeOptions(tipos ?? []), [tipos]);
  const selected = useMemo(() => tipoOptions.find((foodType) => foodType.tipo.TipoAlimentoID === tipoId)?.tipo, [tipoId, tipoOptions]);

  useEffect(() => {
    if (!tipoId && tipoOptions[0]) setTipoId(tipoOptions[0].tipo.TipoAlimentoID);
    if (!proveedorId && proveedores?.[0]) setProveedorId(proveedores[0].ProveedorID);
  }, [proveedorId, proveedores, tipoId, tipoOptions]);

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
    onSaved('Entrada de alimento guardada en este dispositivo.');
  }

  return (
    <form className="form-grid flow-form" onSubmit={handleSubmit}>
      <FoodTypeSelector options={tipoOptions} selectedTipoId={tipoId} onSelect={setTipoId} className="field--full" />
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
      <FormOptionalPanel label="Observaciones" value={observaciones}>
        <label className="field field--full field--nested">
          <span>Observaciones</span>
          <textarea rows={3} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
        </label>
      </FormOptionalPanel>
      <button className="primary-action">Guardar entrada</button>
    </form>
  );
}
