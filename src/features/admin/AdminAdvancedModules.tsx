import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { AlertBadge } from '../../components/AlertBadge';
import { fmtCurrency, fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import { todayISO } from '../../lib/date';
import {
  analizarProveedores,
  calcularEconomiaLote,
  calcularPrediccionSalida,
  compararLotes,
  tratamientoEnRetiro,
} from '../../services/adminAnalyticsService';
import {
  crearCliente,
  crearCurvaEstandar,
  crearFacturaCompra,
  crearFacturaVenta,
  crearProveedor,
  crearTipoAlimento,
  crearTratamiento,
  generarCierreFinalLote,
  generarCierreSemanal,
  registrarCosto,
  registrarMovimientoInventario,
} from '../../services/adminService';
import { generarAlertasBasicas } from '../../services/alertsService';
import { db } from '../../services/localDbService';
import type {
  CostoLote,
  CurvaEstandar,
  MovimientoInventarioAlimento,
  Proveedor,
  TratamientoVeterinario,
  Usuario,
} from '../../types/entities';

interface AdminAdvancedModulesProps {
  user: Usuario;
  onToast: (message: string) => void;
}

type TabId = 'finanzas' | 'facturas' | 'maestros' | 'inventario' | 'curvas' | 'veterinaria' | 'cierres' | 'comparacion' | 'proveedores' | 'alertas';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'finanzas', label: 'Costos' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'maestros', label: 'Maestros' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'curvas', label: 'Curvas' },
  { id: 'veterinaria', label: 'Veterinaria' },
  { id: 'cierres', label: 'Cierres' },
  { id: 'comparacion', label: 'Comparación' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'alertas', label: 'Alertas' },
];

export function AdminAdvancedModules({ user, onToast }: AdminAdvancedModulesProps) {
  const lotes = useLiveQuery(() => db.lotes.toArray(), []) ?? [];
  const costos = useLiveQuery(() => db.costosLote.toArray(), []) ?? [];
  const salidas = useLiveQuery(() => db.salidasPollo.toArray(), []) ?? [];
  const registros = useLiveQuery(() => db.registroDiarioLote.toArray(), []) ?? [];
  const pesajes = useLiveQuery(() => db.pesajes.toArray(), []) ?? [];
  const proveedores = useLiveQuery(() => db.proveedores.toArray(), []) ?? [];
  const clientes = useLiveQuery(() => db.clientes.toArray(), []) ?? [];
  const tiposAlimento = useLiveQuery(() => db.tiposAlimento.toArray(), []) ?? [];
  const inventario = useLiveQuery(() => db.inventarioAlimento.toArray(), []) ?? [];
  const movimientos = useLiveQuery(() => db.movimientosInventarioAlimento.toArray(), []) ?? [];
  const curvas = useLiveQuery(() => db.curvasEstandar.toArray(), []) ?? [];
  const tratamientos = useLiveQuery(() => db.tratamientosVeterinarios.toArray(), []) ?? [];
  const eventos = useLiveQuery(() => db.eventosSanitarios.toArray(), []) ?? [];
  const actividades = useLiveQuery(() => db.actividadesLote.toArray(), []) ?? [];
  const alertas = useLiveQuery(() => db.alertas.toArray(), []) ?? [];
  const facturasCompra = useLiveQuery(() => db.facturasCompra.toArray(), []) ?? [];
  const detalleCompra = useLiveQuery(() => db.detalleFacturasCompra.toArray(), []) ?? [];
  const facturasVenta = useLiveQuery(() => db.facturasVenta.toArray(), []) ?? [];
  const detalleVenta = useLiveQuery(() => db.detalleFacturasVenta.toArray(), []) ?? [];
  const cierresSemanales = useLiveQuery(() => db.cierresSemanales.toArray(), []) ?? [];
  const cierresLote = useLiveQuery(() => db.cierreLote.toArray(), []) ?? [];
  const [tab, setTab] = useState<TabId>('finanzas');
  const [selectedLoteId, setSelectedLoteId] = useState('');
  const [pesoObjetivo, setPesoObjetivo] = useState('2500');

  const selectedLote = lotes.find((lote) => lote.LoteID === (selectedLoteId || lotes[0]?.LoteID));
  const economia = selectedLote ? calcularEconomiaLote({ lote: selectedLote, costos, salidas }) : undefined;
  const comparacion = useMemo(
    () => compararLotes({ lotes, costos, salidas, registros, pesajes, proveedores, alertas, actividades }),
    [actividades, alertas, costos, lotes, pesajes, proveedores, registros, salidas],
  );
  const analisisProveedores = useMemo(
    () => analizarProveedores({ proveedores, lotes, costos, salidas, registros, pesajes, eventos, actividades }),
    [actividades, costos, eventos, lotes, pesajes, proveedores, registros, salidas],
  );
  const prediccion = selectedLote
    ? calcularPrediccionSalida({
        lote: selectedLote,
        pesajes,
        curvas,
        costos,
        registros,
        pesoObjetivoGr: Number(pesoObjetivo || 0),
      })
    : undefined;

  return (
    <section className="advanced-admin">
      <div className="admin-tabs">
        {tabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="admin-grid">
        <MobileCard title="Lote administrativo">
          <div className="form-grid">
            <label className="field">
              <span>Lote</span>
              <select value={selectedLote?.LoteID ?? ''} onChange={(event) => setSelectedLoteId(event.target.value)}>
                {lotes.map((lote) => (
                  <option key={lote.LoteID} value={lote.LoteID}>
                    {lote.CodigoLote}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Peso objetivo gr</span>
              <input type="number" value={pesoObjetivo} onChange={(event) => setPesoObjetivo(event.target.value)} />
            </label>
          </div>
        </MobileCard>

        {economia && (
          <MobileCard title="Rentabilidad del lote">
            <div className="stats-grid">
              <StatCard label="Costo total" value={fmtCurrency(economia.costoTotal)} />
              <StatCard label="Ingreso total" value={fmtCurrency(economia.ingresoTotal)} />
              <StatCard label="Utilidad bruta" value={fmtCurrency(economia.utilidadBruta)} tone={economia.utilidadBruta >= 0 ? 'good' : 'danger'} />
              <StatCard label="Margen" value={fmtPercent(economia.margen)} tone={economia.margen >= 0 ? 'good' : 'danger'} />
              <StatCard label="Costo/kg" value={fmtCurrency(economia.costoPorKg)} />
              <StatCard label="Utilidad/kg" value={fmtCurrency(economia.utilidadPorKg)} />
            </div>
          </MobileCard>
        )}
      </div>

      {tab === 'finanzas' && selectedLote && (
        <FinanzasTab loteId={selectedLote.LoteID} costos={costos} proveedores={proveedores} onToast={onToast} />
      )}
      {tab === 'facturas' && (
        <FacturasTab lotes={lotes} proveedores={proveedores} clientes={clientes} facturasCompra={facturasCompra} detalleCompra={detalleCompra} facturasVenta={facturasVenta} detalleVenta={detalleVenta} onToast={onToast} />
      )}
      {tab === 'maestros' && (
        <MaestrosTab proveedores={proveedores} clientes={clientes} tiposAlimento={tiposAlimento} onToast={onToast} />
      )}
      {tab === 'inventario' && (
        <InventarioTab user={user} inventario={inventario} movimientos={movimientos} tiposAlimento={tiposAlimento} lotes={lotes} proveedores={proveedores} onToast={onToast} />
      )}
      {tab === 'curvas' && <CurvasTab curvas={curvas} onToast={onToast} />}
      {tab === 'veterinaria' && selectedLote && (
        <VeterinariaTab loteId={selectedLote.LoteID} tratamientos={tratamientos} onToast={onToast} />
      )}
      {tab === 'cierres' && selectedLote && (
        <CierresTab loteId={selectedLote.LoteID} cierresSemanales={cierresSemanales} cierresLote={cierresLote} onToast={onToast} />
      )}
      {tab === 'comparacion' && <ComparacionTab rows={comparacion} />}
      {tab === 'proveedores' && <AnalisisProveedoresTab rows={analisisProveedores} />}
      {tab === 'alertas' && (
        <AlertasTab lotes={lotes} alertas={alertas} onToast={onToast} />
      )}

      {prediccion && (
        <MobileCard title="Predicción avanzada de salida">
          <div className="stats-grid">
            <StatCard label="Peso actual" value={`${fmtNumber(prediccion.pesoActualGr)} g`} />
            <StatCard label="Ganancia diaria" value={`${fmtNumber(prediccion.gananciaDiariaGr, 1)} g`} />
            <StatCard label="Días estimados" value={fmtNumber(prediccion.diasEstimados, 1)} />
            <StatCard label="Fecha estimada" value={prediccion.fechaEstimada} />
            <StatCard label="Consumo adicional" value={fmtKg(prediccion.consumoAdicionalKg)} />
            <StatCard label="Costo adicional" value={fmtCurrency(prediccion.costoAdicionalEstimado)} />
          </div>
          <div className="scenario-row">
            {prediccion.escenarios.map((escenario) => (
              <span key={escenario.dia}>
                Día {escenario.dia}: {fmtNumber(escenario.pesoEstimadoGr)} g
              </span>
            ))}
          </div>
        </MobileCard>
      )}
    </section>
  );
}

function FinanzasTab({ loteId, costos, proveedores, onToast }: { loteId: string; costos: CostoLote[]; proveedores: Proveedor[]; onToast: (message: string) => void }) {
  const [categoria, setCategoria] = useState<CostoLote['CategoriaCosto']>('ALIMENTO');
  const [concepto, setConcepto] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [unidad, setUnidad] = useState('UND');
  const [valorUnitario, setValorUnitario] = useState('0');
  const [proveedorId, setProveedorId] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await registrarCosto({
      Fecha: todayISO(),
      LoteID: loteId,
      CategoriaCosto: categoria,
      Concepto: concepto,
      Cantidad: Number(cantidad || 0),
      Unidad: unidad,
      ValorUnitario: Number(valorUnitario || 0),
      ProveedorID: proveedorId,
      FacturaID: '',
      Observacion: '',
    });
    setConcepto('');
    setCantidad('1');
    setValorUnitario('0');
    onToast('Costo registrado en ADMIN.');
  }

  return (
    <div className="admin-grid">
      <MobileCard title="Registrar costo por lote">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Categoría</span>
            <select value={categoria} onChange={(event) => setCategoria(event.target.value as CostoLote['CategoriaCosto'])}>
              {['POLLITO', 'ALIMENTO', 'CISCO', 'GAS', 'VACUNA', 'MEDICAMENTO', 'DESINFECTANTE', 'MANO_OBRA', 'TRANSPORTE', 'SERVICIOS', 'OTRO'].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Proveedor</span>
            <select value={proveedorId} onChange={(event) => setProveedorId(event.target.value)}>
              <option value="">Sin proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.ProveedorID} value={proveedor.ProveedorID}>
                  {proveedor.NombreProveedor}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--full">
            <span>Concepto</span>
            <input value={concepto} onChange={(event) => setConcepto(event.target.value)} required />
          </label>
          <label className="field">
            <span>Cantidad</span>
            <input type="number" step="0.01" value={cantidad} onChange={(event) => setCantidad(event.target.value)} />
          </label>
          <label className="field">
            <span>Unidad</span>
            <input value={unidad} onChange={(event) => setUnidad(event.target.value)} />
          </label>
          <label className="field">
            <span>Valor unitario</span>
            <input type="number" step="1" value={valorUnitario} onChange={(event) => setValorUnitario(event.target.value)} />
          </label>
          <label className="field">
            <span>Total</span>
            <input readOnly value={fmtCurrency(Number(cantidad || 0) * Number(valorUnitario || 0))} />
          </label>
          <button className="primary-action">Guardar costo</button>
        </form>
      </MobileCard>
      <MobileCard title="Costos del lote">
        <SimpleTable
          headers={['Fecha', 'Categoría', 'Concepto', 'Total', 'Estado']}
          rows={costos
            .filter((costo) => costo.LoteID === loteId)
            .map((costo) => [costo.Fecha, costo.CategoriaCosto, costo.Concepto, fmtCurrency(costo.ValorTotal), costo.Estado])}
        />
      </MobileCard>
    </div>
  );
}

function FacturasTab({
  lotes,
  proveedores,
  clientes,
  facturasCompra,
  detalleCompra,
  facturasVenta,
  detalleVenta,
  onToast,
}: {
  lotes: Array<{ LoteID: string; CodigoLote: string }>;
  proveedores: Proveedor[];
  clientes: Array<{ ClienteID: string; NombreCliente: string }>;
  facturasCompra: Array<{ FacturaCompraID: string; FechaFactura: string; NumeroFactura: string; ProveedorID: string; Total: number; EstadoPago: string }>;
  detalleCompra: Array<{ DetalleID: string }>;
  facturasVenta: Array<{ FacturaVentaID: string; FechaFactura: string; NumeroFactura: string; ClienteID: string; Total: number; EstadoCobro: string }>;
  detalleVenta: Array<{ DetalleVentaID: string }>;
  onToast: (message: string) => void;
}) {
  const [compra, setCompra] = useState({ proveedorId: '', loteId: '', numero: '', categoria: 'ALIMENTO', producto: '', cantidad: '1', unidad: 'UND', valor: '0', iva: '0' });
  const [venta, setVenta] = useState({ clienteId: '', loteId: '', numero: '', producto: 'Pollo en pie', aves: '0', kg: '0', precio: '0', iva: '0' });

  async function saveCompra(event: FormEvent) {
    event.preventDefault();
    await crearFacturaCompra({
      FechaFactura: todayISO(),
      ProveedorID: compra.proveedorId,
      NumeroFactura: compra.numero,
      Categoria: compra.categoria,
      Subtotal: Number(compra.cantidad || 0) * Number(compra.valor || 0),
      IVA: Number(compra.iva || 0),
      EstadoPago: 'PENDIENTE',
      Observacion: '',
      detalle: [{ LoteID: compra.loteId, ProductoServicio: compra.producto, Cantidad: Number(compra.cantidad || 0), Unidad: compra.unidad, ValorUnitario: Number(compra.valor || 0) }],
    });
    setCompra({ ...compra, numero: '', producto: '', cantidad: '1', valor: '0', iva: '0' });
    onToast('Factura de compra creada con detalle y costo.');
  }

  async function saveVenta(event: FormEvent) {
    event.preventDefault();
    await crearFacturaVenta({
      FechaFactura: todayISO(),
      ClienteID: venta.clienteId,
      NumeroFactura: venta.numero,
      Subtotal: Number(venta.kg || 0) * Number(venta.precio || 0),
      IVA: Number(venta.iva || 0),
      EstadoCobro: 'PENDIENTE',
      Observacion: '',
      detalle: [{ LoteID: venta.loteId, ProductoServicio: venta.producto, CantidadAves: Number(venta.aves || 0), Kg: Number(venta.kg || 0), PrecioKg: Number(venta.precio || 0) }],
    });
    setVenta({ ...venta, numero: '', aves: '0', kg: '0', precio: '0', iva: '0' });
    onToast('Factura de venta creada con detalle e ingreso.');
  }

  return (
    <div className="admin-grid">
      <MobileCard title="Factura de compra">
        <form className="form-grid" onSubmit={saveCompra}>
          <SelectField label="Proveedor" value={compra.proveedorId} onChange={(value) => setCompra({ ...compra, proveedorId: value })} options={proveedores.map((p) => [p.ProveedorID, p.NombreProveedor])} />
          <SelectField label="Lote" value={compra.loteId} onChange={(value) => setCompra({ ...compra, loteId: value })} options={lotes.map((l) => [l.LoteID, l.CodigoLote])} />
          <InputField label="Número factura" value={compra.numero} onChange={(value) => setCompra({ ...compra, numero: value })} />
          <InputField label="Categoría" value={compra.categoria} onChange={(value) => setCompra({ ...compra, categoria: value })} />
          <InputField label="Producto/servicio" value={compra.producto} onChange={(value) => setCompra({ ...compra, producto: value })} />
          <InputField label="Cantidad" type="number" value={compra.cantidad} onChange={(value) => setCompra({ ...compra, cantidad: value })} />
          <InputField label="Unidad" value={compra.unidad} onChange={(value) => setCompra({ ...compra, unidad: value })} />
          <InputField label="Valor unitario" type="number" value={compra.valor} onChange={(value) => setCompra({ ...compra, valor: value })} />
          <InputField label="IVA" type="number" value={compra.iva} onChange={(value) => setCompra({ ...compra, iva: value })} />
          <button className="primary-action">Guardar compra</button>
        </form>
      </MobileCard>
      <MobileCard title="Factura de venta">
        <form className="form-grid" onSubmit={saveVenta}>
          <SelectField label="Cliente" value={venta.clienteId} onChange={(value) => setVenta({ ...venta, clienteId: value })} options={clientes.map((c) => [c.ClienteID, c.NombreCliente])} />
          <SelectField label="Lote" value={venta.loteId} onChange={(value) => setVenta({ ...venta, loteId: value })} options={lotes.map((l) => [l.LoteID, l.CodigoLote])} />
          <InputField label="Número factura" value={venta.numero} onChange={(value) => setVenta({ ...venta, numero: value })} />
          <InputField label="Producto/servicio" value={venta.producto} onChange={(value) => setVenta({ ...venta, producto: value })} />
          <InputField label="Aves" type="number" value={venta.aves} onChange={(value) => setVenta({ ...venta, aves: value })} />
          <InputField label="Kg" type="number" value={venta.kg} onChange={(value) => setVenta({ ...venta, kg: value })} />
          <InputField label="Precio kg" type="number" value={venta.precio} onChange={(value) => setVenta({ ...venta, precio: value })} />
          <InputField label="IVA" type="number" value={venta.iva} onChange={(value) => setVenta({ ...venta, iva: value })} />
          <button className="primary-action">Guardar venta</button>
        </form>
      </MobileCard>
      <MobileCard title="Facturas registradas">
        <SimpleTable headers={['Tipo', 'Fecha', 'Número', 'Total', 'Estado']} rows={[...facturasCompra.map((f) => ['Compra', f.FechaFactura, f.NumeroFactura, fmtCurrency(f.Total), f.EstadoPago]), ...facturasVenta.map((f) => ['Venta', f.FechaFactura, f.NumeroFactura, fmtCurrency(f.Total), f.EstadoCobro])]} />
        <p className="empty-state">Detalles compra: {detalleCompra.length} · detalles venta: {detalleVenta.length}</p>
      </MobileCard>
    </div>
  );
}

function MaestrosTab({ proveedores, clientes, tiposAlimento, onToast }: { proveedores: Proveedor[]; clientes: Array<{ ClienteID: string; NombreCliente: string; Telefono: string }>; tiposAlimento: Array<{ TipoAlimentoID: string; Nombre: string; KgPorBulto: number }>; onToast: (message: string) => void }) {
  const [proveedor, setProveedor] = useState({ nombre: '', tipo: 'ALIMENTO' as Proveedor['TipoProveedor'], telefono: '', nit: '' });
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', nit: '' });
  const [alimento, setAlimento] = useState({ nombre: '', desde: '1', hasta: '10', kg: '40' });

  async function saveProveedor(event: FormEvent) {
    event.preventDefault();
    await crearProveedor({ NombreProveedor: proveedor.nombre, TipoProveedor: proveedor.tipo, Telefono: proveedor.telefono, NIT: proveedor.nit, Contacto: '', ProductoPrincipal: '', Observaciones: '' });
    setProveedor({ ...proveedor, nombre: '', telefono: '', nit: '' });
    onToast('Proveedor creado.');
  }
  async function saveCliente(event: FormEvent) {
    event.preventDefault();
    await crearCliente({ NombreCliente: cliente.nombre, Telefono: cliente.telefono, NIT: cliente.nit, TipoCliente: 'GENERAL', Observaciones: '' });
    setCliente({ nombre: '', telefono: '', nit: '' });
    onToast('Cliente creado.');
  }
  async function saveAlimento(event: FormEvent) {
    event.preventDefault();
    await crearTipoAlimento({ Nombre: alimento.nombre, EtapaRecomendadaDesdeDia: Number(alimento.desde), EtapaRecomendadaHastaDia: Number(alimento.hasta), KgPorBulto: Number(alimento.kg) });
    setAlimento({ ...alimento, nombre: '' });
    onToast('Tipo de alimento creado.');
  }

  return (
    <div className="admin-grid">
      <MobileCard title="Proveedores">
        <form className="form-grid" onSubmit={saveProveedor}>
          <InputField label="Nombre" value={proveedor.nombre} onChange={(value) => setProveedor({ ...proveedor, nombre: value })} />
          <label className="field">
            <span>Tipo</span>
            <select value={proveedor.tipo} onChange={(event) => setProveedor({ ...proveedor, tipo: event.target.value as Proveedor['TipoProveedor'] })}>
              {['POLLITO', 'ALIMENTO', 'CISCO', 'GAS', 'MEDICAMENTO', 'VACUNA', 'TRANSPORTE', 'VETERINARIO', 'OTRO'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <InputField label="Teléfono" value={proveedor.telefono} onChange={(value) => setProveedor({ ...proveedor, telefono: value })} />
          <InputField label="NIT" value={proveedor.nit} onChange={(value) => setProveedor({ ...proveedor, nit: value })} />
          <button className="primary-action">Crear proveedor</button>
        </form>
        <SimpleTable headers={['Nombre', 'Tipo', 'Teléfono']} rows={proveedores.map((p) => [p.NombreProveedor, p.TipoProveedor, p.Telefono])} />
      </MobileCard>
      <MobileCard title="Clientes y alimento">
        <form className="form-grid" onSubmit={saveCliente}>
          <InputField label="Cliente" value={cliente.nombre} onChange={(value) => setCliente({ ...cliente, nombre: value })} />
          <InputField label="Teléfono" value={cliente.telefono} onChange={(value) => setCliente({ ...cliente, telefono: value })} />
          <InputField label="NIT" value={cliente.nit} onChange={(value) => setCliente({ ...cliente, nit: value })} />
          <button className="primary-action">Crear cliente</button>
        </form>
        <form className="form-grid compact-form" onSubmit={saveAlimento}>
          <InputField label="Alimento" value={alimento.nombre} onChange={(value) => setAlimento({ ...alimento, nombre: value })} />
          <InputField label="Desde día" type="number" value={alimento.desde} onChange={(value) => setAlimento({ ...alimento, desde: value })} />
          <InputField label="Hasta día" type="number" value={alimento.hasta} onChange={(value) => setAlimento({ ...alimento, hasta: value })} />
          <InputField label="Kg/bulto" type="number" value={alimento.kg} onChange={(value) => setAlimento({ ...alimento, kg: value })} />
          <button className="primary-action">Crear alimento</button>
        </form>
        <p className="empty-state">Clientes: {clientes.length} · alimentos: {tiposAlimento.length}</p>
      </MobileCard>
    </div>
  );
}

function InventarioTab({ user, inventario, movimientos, tiposAlimento, lotes, proveedores, onToast }: { user: Usuario; inventario: Array<{ InventarioID: string; TipoAlimentoID: string; BultosDisponibles: number; KgDisponibles: number }>; movimientos: MovimientoInventarioAlimento[]; tiposAlimento: Array<{ TipoAlimentoID: string; Nombre: string }>; lotes: Array<{ LoteID: string; CodigoLote: string }>; proveedores: Proveedor[]; onToast: (message: string) => void }) {
  const [form, setForm] = useState({ tipoMovimiento: 'AJUSTE_ADMIN' as MovimientoInventarioAlimento['TipoMovimiento'], alimento: '', bultos: '0', kg: '0', lote: '', proveedor: '', observacion: '' });
  async function save(event: FormEvent) {
    event.preventDefault();
    await registrarMovimientoInventario({ Fecha: todayISO(), TipoMovimiento: form.tipoMovimiento, TipoAlimentoID: form.alimento, CantidadBultos: Number(form.bultos || 0), KgTotal: Number(form.kg || 0), LoteID: form.lote, ProveedorID: form.proveedor, FacturaID: '', Origen: '', Destino: '', Observacion: form.observacion }, user);
    setForm({ ...form, bultos: '0', kg: '0', observacion: '' });
    onToast('Movimiento de inventario registrado.');
  }
  return (
    <div className="admin-grid">
      <MobileCard title="Movimiento de inventario">
        <form className="form-grid" onSubmit={save}>
          <label className="field">
            <span>Movimiento</span>
            <select value={form.tipoMovimiento} onChange={(event) => setForm({ ...form, tipoMovimiento: event.target.value as MovimientoInventarioAlimento['TipoMovimiento'] })}>
              {['ENTRADA_COMPRA', 'CONSUMO_LOTE', 'AJUSTE_ADMIN', 'DEVOLUCION', 'MERMA', 'TRASLADO'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <SelectField label="Alimento" value={form.alimento} onChange={(value) => setForm({ ...form, alimento: value })} options={tiposAlimento.map((t) => [t.TipoAlimentoID, t.Nombre])} />
          <InputField label="Bultos" type="number" value={form.bultos} onChange={(value) => setForm({ ...form, bultos: value })} />
          <InputField label="Kg" type="number" value={form.kg} onChange={(value) => setForm({ ...form, kg: value })} />
          <SelectField label="Lote" value={form.lote} onChange={(value) => setForm({ ...form, lote: value })} options={lotes.map((l) => [l.LoteID, l.CodigoLote])} />
          <SelectField label="Proveedor" value={form.proveedor} onChange={(value) => setForm({ ...form, proveedor: value })} options={proveedores.map((p) => [p.ProveedorID, p.NombreProveedor])} />
          <InputField label="Observación" value={form.observacion} onChange={(value) => setForm({ ...form, observacion: value })} />
          <button className="primary-action">Guardar movimiento</button>
        </form>
      </MobileCard>
      <MobileCard title="Inventario exacto">
        <SimpleTable headers={['Alimento', 'Bultos', 'Kg']} rows={inventario.map((item) => [tiposAlimento.find((tipo) => tipo.TipoAlimentoID === item.TipoAlimentoID)?.Nombre ?? item.TipoAlimentoID, fmtNumber(item.BultosDisponibles, 1), fmtKg(item.KgDisponibles)])} />
        <SimpleTable headers={['Fecha', 'Movimiento', 'Bultos', 'Kg']} rows={movimientos.slice(-8).reverse().map((m) => [m.Fecha, m.TipoMovimiento, fmtNumber(m.CantidadBultos, 1), fmtKg(m.KgTotal)])} />
      </MobileCard>
    </div>
  );
}

function CurvasTab({ curvas, onToast }: { curvas: CurvaEstandar[]; onToast: (message: string) => void }) {
  const [form, setForm] = useState({ linea: 'Cobb 500', sexo: 'GENERAL' as CurvaEstandar['Sexo'], dia: '1', peso: '45', consumoDia: '12', consumoAcum: '12', conversion: '1.1', mortalidad: '0.005', ganancia: '20' });
  async function save(event: FormEvent) {
    event.preventDefault();
    await crearCurvaEstandar({ LineaGenetica: form.linea, Sexo: form.sexo, DiaLote: Number(form.dia), PesoEsperadoGr: Number(form.peso), ConsumoDiarioEsperadoGrAve: Number(form.consumoDia), ConsumoAcumuladoEsperadoGrAve: Number(form.consumoAcum), ConversionEsperada: Number(form.conversion), MortalidadMaximaAcumulada: Number(form.mortalidad), GananciaDiariaEsperada: Number(form.ganancia) });
    onToast('Curva estándar creada.');
  }
  return (
    <div className="admin-grid">
      <MobileCard title="Curva estándar">
        <form className="form-grid" onSubmit={save}>
          <InputField label="Línea genética" value={form.linea} onChange={(value) => setForm({ ...form, linea: value })} />
          <label className="field">
            <span>Sexo</span>
            <select value={form.sexo} onChange={(event) => setForm({ ...form, sexo: event.target.value as CurvaEstandar['Sexo'] })}>
              <option>GENERAL</option>
              <option>MACHO</option>
              <option>HEMBRA</option>
            </select>
          </label>
          <InputField label="Día" type="number" value={form.dia} onChange={(value) => setForm({ ...form, dia: value })} />
          <InputField label="Peso esperado gr" type="number" value={form.peso} onChange={(value) => setForm({ ...form, peso: value })} />
          <InputField label="Consumo diario gr/ave" type="number" value={form.consumoDia} onChange={(value) => setForm({ ...form, consumoDia: value })} />
          <InputField label="Consumo acumulado" type="number" value={form.consumoAcum} onChange={(value) => setForm({ ...form, consumoAcum: value })} />
          <InputField label="Conversión esperada" type="number" value={form.conversion} onChange={(value) => setForm({ ...form, conversion: value })} />
          <InputField label="Mortalidad máxima" type="number" value={form.mortalidad} onChange={(value) => setForm({ ...form, mortalidad: value })} />
          <InputField label="Ganancia diaria" type="number" value={form.ganancia} onChange={(value) => setForm({ ...form, ganancia: value })} />
          <button className="primary-action">Guardar curva</button>
        </form>
      </MobileCard>
      <MobileCard title="Curvas registradas">
        <SimpleTable headers={['Línea', 'Sexo', 'Día', 'Peso', 'CA']} rows={curvas.slice(-12).reverse().map((c) => [c.LineaGenetica, c.Sexo, c.DiaLote, `${fmtNumber(c.PesoEsperadoGr)} g`, fmtNumber(c.ConversionEsperada, 2)])} />
      </MobileCard>
    </div>
  );
}

function VeterinariaTab({ loteId, tratamientos, onToast }: { loteId: string; tratamientos: TratamientoVeterinario[]; onToast: (message: string) => void }) {
  const [form, setForm] = useState({ producto: '', dosis: '', via: 'Agua', motivo: '', veterinario: '', retiro: '0', fin: todayISO() });
  async function save(event: FormEvent) {
    event.preventDefault();
    await crearTratamiento({ FechaInicio: todayISO(), FechaFin: form.fin, LoteID: loteId, Producto: form.producto, Dosis: form.dosis, ViaAplicacion: form.via, Motivo: form.motivo, VeterinarioResponsable: form.veterinario, PeriodoRetiroDias: Number(form.retiro || 0), Estado: 'ACTIVO', Observaciones: '' });
    setForm({ ...form, producto: '', dosis: '', motivo: '' });
    onToast('Tratamiento veterinario registrado.');
  }
  return (
    <div className="admin-grid">
      <MobileCard title="Tratamiento veterinario">
        <form className="form-grid" onSubmit={save}>
          <InputField label="Producto" value={form.producto} onChange={(value) => setForm({ ...form, producto: value })} />
          <InputField label="Dosis" value={form.dosis} onChange={(value) => setForm({ ...form, dosis: value })} />
          <InputField label="Vía aplicación" value={form.via} onChange={(value) => setForm({ ...form, via: value })} />
          <InputField label="Motivo" value={form.motivo} onChange={(value) => setForm({ ...form, motivo: value })} />
          <InputField label="Veterinario" value={form.veterinario} onChange={(value) => setForm({ ...form, veterinario: value })} />
          <InputField label="Fecha fin" type="date" value={form.fin} onChange={(value) => setForm({ ...form, fin: value })} />
          <InputField label="Retiro días" type="number" value={form.retiro} onChange={(value) => setForm({ ...form, retiro: value })} />
          <button className="primary-action">Guardar tratamiento</button>
        </form>
      </MobileCard>
      <MobileCard title="Control veterinario y retiro">
        <SimpleTable headers={['Producto', 'Estado', 'Retiro', 'Vence']} rows={tratamientos.filter((t) => t.LoteID === loteId).map((t) => [t.Producto, t.Estado, tratamientoEnRetiro(t) ? 'EN RETIRO' : 'Libre', t.FechaFin])} />
      </MobileCard>
    </div>
  );
}

function CierresTab({ loteId, cierresSemanales, cierresLote, onToast }: { loteId: string; cierresSemanales: Array<{ CierreSemanalID: string; LoteID: string; SemanaLote: number; ConsumoAcumuladoKg: number; CostoAcumulado: number; EstadoCierre: string }>; cierresLote: Array<{ CierreLoteID: string; LoteID: string; FechaCierre: string; CostoTotal: number; IngresoTotal: number; UtilidadBruta: number; Margen: number }>; onToast: (message: string) => void }) {
  const [semana, setSemana] = useState('1');
  return (
    <div className="admin-grid">
      <MobileCard title="Cierres automáticos">
        <div className="form-grid">
          <InputField label="Semana lote" type="number" value={semana} onChange={setSemana} />
          <button className="primary-action" type="button" onClick={() => generarCierreSemanal(loteId, Number(semana || 1)).then(() => onToast('Cierre semanal generado.'))}>
            Generar cierre semanal
          </button>
          <button className="primary-action" type="button" onClick={() => generarCierreFinalLote(loteId).then(() => onToast('Cierre final de lote generado.'))}>
            Generar cierre final
          </button>
        </div>
      </MobileCard>
      <MobileCard title="Historial de cierres">
        <SimpleTable headers={['Semana', 'Consumo acum.', 'Costo acum.', 'Estado']} rows={cierresSemanales.filter((c) => c.LoteID === loteId).map((c) => [c.SemanaLote, fmtKg(c.ConsumoAcumuladoKg), fmtCurrency(c.CostoAcumulado), c.EstadoCierre])} />
        <SimpleTable headers={['Fecha cierre', 'Costo', 'Ingreso', 'Utilidad']} rows={cierresLote.filter((c) => c.LoteID === loteId).map((c) => [c.FechaCierre, fmtCurrency(c.CostoTotal), fmtCurrency(c.IngresoTotal), fmtCurrency(c.UtilidadBruta)])} />
      </MobileCard>
    </div>
  );
}

function ComparacionTab({ rows }: { rows: ReturnType<typeof compararLotes> }) {
  return (
    <MobileCard title="Comparación entre lotes">
      <SimpleTable headers={['Lote', 'Mort.', 'CA final', 'Peso final', 'Costo/kg', 'Utilidad', 'Proveedor', 'Cumpl.']} rows={rows.map((row) => [row.codigoLote, fmtPercent(row.mortalidadTotal), fmtNumber(row.conversionFinal, 2), `${fmtNumber(row.pesoFinal)} g`, fmtCurrency(row.costoPorKg), fmtCurrency(row.utilidadBruta), row.proveedorPollito, fmtPercent(row.cumplimientoActividades)])} />
    </MobileCard>
  );
}

function AnalisisProveedoresTab({ rows }: { rows: ReturnType<typeof analizarProveedores> }) {
  return (
    <MobileCard title="Análisis por proveedor">
      <SimpleTable headers={['Proveedor', 'Tipo', 'Lotes', 'Mort.', 'Peso final', 'Rentabilidad', 'Eventos', 'Cumpl.']} rows={rows.map((row) => [row.proveedor, row.tipo, row.lotes, fmtPercent(row.mortalidadPromedio), `${fmtNumber(row.pesoFinalPromedio)} g`, fmtPercent(row.rentabilidadPromedio), row.eventosSanitarios, fmtPercent(row.cumplimientoActividades)])} />
    </MobileCard>
  );
}

function AlertasTab({ lotes, alertas, onToast }: { lotes: Array<{ LoteID: string; CodigoLote: string }>; alertas: Array<{ AlertaID: string; LoteID: string; Nivel: 'INFORMATIVA' | 'MEDIA' | 'ALTA' | 'CRITICA'; TipoAlerta: string; Mensaje: string; Estado: string }>; onToast: (message: string) => void }) {
  async function generarTodas() {
    let total = 0;
    for (const lote of lotes) {
      total += (await generarAlertasBasicas(lote as never)).length;
    }
    onToast(`${total} alerta(s) automática(s) nueva(s).`);
  }
  return (
    <MobileCard title="Alertas automáticas">
      <div className="section-actions">
        <button type="button" onClick={generarTodas}>Generar alertas</button>
      </div>
      <div className="stack">
        {alertas.map((alerta) => (
          <article className="list-row" key={alerta.AlertaID}>
            <AlertBadge nivel={alerta.Nivel}>{alerta.Nivel}</AlertBadge>
            <div>
              <strong>{alerta.TipoAlerta}</strong>
              <span>{alerta.Mensaje}</span>
            </div>
            <span>{alerta.Estado}</span>
          </article>
        ))}
      </div>
    </MobileCard>
  );
}

function InputField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Seleccionar</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => <th key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty-state">Sin registros.</p>}
    </div>
  );
}
