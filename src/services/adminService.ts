import { createId } from '../lib/id';
import { nowISO, todayISO } from '../lib/date';
import { db } from './localDbService';
import { enqueueSync } from './syncService';
import { construirCierreLote, construirCierreSemanal } from './adminAnalyticsService';
import type {
  CierreLote,
  CierreSemanal,
  Cliente,
  CostoLote,
  CurvaEstandar,
  DetalleFacturaCompra,
  DetalleFacturaVenta,
  FacturaCompra,
  FacturaVenta,
  InventarioAlimento,
  MovimientoInventarioAlimento,
  Proveedor,
  SalidaPollo,
  TipoAlimento,
  TratamientoVeterinario,
  Usuario,
} from '../types/entities';

export type ProveedorInput = Omit<Proveedor, 'ProveedorID' | 'Activo'> & { Activo?: boolean };
export type ClienteInput = Omit<Cliente, 'ClienteID' | 'Activo'> & { Activo?: boolean };
export type TipoAlimentoInput = Omit<TipoAlimento, 'TipoAlimentoID' | 'Activo'> & { Activo?: boolean };

export interface CostoInput {
  Fecha: string;
  LoteID: string;
  CategoriaCosto: CostoLote['CategoriaCosto'];
  Concepto: string;
  Cantidad: number;
  Unidad: string;
  ValorUnitario: number;
  ProveedorID: string;
  FacturaID: string;
  Observacion: string;
}

export interface FacturaCompraInput {
  FechaFactura: string;
  ProveedorID: string;
  NumeroFactura: string;
  Categoria: string;
  Subtotal: number;
  IVA: number;
  EstadoPago: FacturaCompra['EstadoPago'];
  Observacion: string;
  detalle: Array<{
    LoteID: string;
    ProductoServicio: string;
    Cantidad: number;
    Unidad: string;
    ValorUnitario: number;
  }>;
}

export interface FacturaVentaInput {
  FechaFactura: string;
  ClienteID: string;
  NumeroFactura: string;
  Subtotal: number;
  IVA: number;
  EstadoCobro: FacturaVenta['EstadoCobro'];
  Observacion: string;
  detalle: Array<{
    LoteID: string;
    ProductoServicio: string;
    CantidadAves: number;
    Kg: number;
    PrecioKg: number;
  }>;
}

export interface MovimientoInventarioInput {
  Fecha: string;
  TipoMovimiento: MovimientoInventarioAlimento['TipoMovimiento'];
  TipoAlimentoID: string;
  CantidadBultos: number;
  KgTotal: number;
  LoteID: string;
  ProveedorID: string;
  FacturaID: string;
  Origen: string;
  Destino: string;
  Observacion: string;
}

export interface CurvaInput {
  LineaGenetica: string;
  Sexo: CurvaEstandar['Sexo'];
  DiaLote: number;
  PesoEsperadoGr: number;
  ConsumoDiarioEsperadoGrAve: number;
  ConsumoAcumuladoEsperadoGrAve: number;
  ConversionEsperada: number;
  MortalidadMaximaAcumulada: number;
  GananciaDiariaEsperada: number;
}

export interface TratamientoInput {
  FechaInicio: string;
  FechaFin: string;
  LoteID: string;
  Producto: string;
  Dosis: string;
  ViaAplicacion: string;
  Motivo: string;
  VeterinarioResponsable: string;
  PeriodoRetiroDias: number;
  Estado: TratamientoVeterinario['Estado'];
  Observaciones: string;
}

export async function crearProveedor(input: ProveedorInput): Promise<Proveedor> {
  const proveedor: Proveedor = {
    ProveedorID: createId('prov'),
    Activo: input.Activo ?? true,
    ...input,
  };
  await db.proveedores.add(proveedor);
  await enqueueSync('Proveedores', proveedor.ProveedorID, 'CREATE', proveedor);
  return proveedor;
}

export async function crearCliente(input: ClienteInput): Promise<Cliente> {
  const cliente: Cliente = {
    ClienteID: createId('cliente'),
    Activo: input.Activo ?? true,
    ...input,
  };
  await db.clientes.add(cliente);
  await enqueueSync('Clientes', cliente.ClienteID, 'CREATE', cliente);
  return cliente;
}

export async function crearTipoAlimento(input: TipoAlimentoInput): Promise<TipoAlimento> {
  const tipo: TipoAlimento = {
    TipoAlimentoID: createId('alim'),
    Activo: input.Activo ?? true,
    ...input,
  };
  await db.tiposAlimento.add(tipo);
  await enqueueSync('TiposAlimento', tipo.TipoAlimentoID, 'CREATE', tipo);
  return tipo;
}

export async function registrarCosto(input: CostoInput): Promise<CostoLote> {
  const costo: CostoLote = {
    CostoID: createId('costo'),
    ...input,
    ValorTotal: input.Cantidad * input.ValorUnitario,
    Estado: input.FacturaID ? 'COMPLETO' : 'PENDIENTE_FACTURA',
  };
  await db.costosLote.add(costo);
  await enqueueSync('CostosLote', costo.CostoID, 'CREATE', costo);
  return costo;
}

export async function crearFacturaCompra(input: FacturaCompraInput): Promise<FacturaCompra> {
  const factura: FacturaCompra = {
    FacturaCompraID: createId('fac_compra'),
    FechaFactura: input.FechaFactura,
    ProveedorID: input.ProveedorID,
    NumeroFactura: input.NumeroFactura,
    Categoria: input.Categoria,
    Subtotal: input.Subtotal,
    IVA: input.IVA,
    Total: input.Subtotal + input.IVA,
    EstadoPago: input.EstadoPago,
    ArchivoPDF: '',
    Observacion: input.Observacion,
  };
  const detalles: DetalleFacturaCompra[] = input.detalle.map((detalle) => ({
    DetalleID: createId('det_compra'),
    FacturaCompraID: factura.FacturaCompraID,
    LoteID: detalle.LoteID,
    ProductoServicio: detalle.ProductoServicio,
    Cantidad: detalle.Cantidad,
    Unidad: detalle.Unidad,
    ValorUnitario: detalle.ValorUnitario,
    ValorTotal: detalle.Cantidad * detalle.ValorUnitario,
  }));
  const costos: CostoLote[] = detalles
    .filter((detalle) => detalle.LoteID)
    .map((detalle) => ({
      CostoID: createId('costo'),
      Fecha: factura.FechaFactura,
      LoteID: detalle.LoteID,
      CategoriaCosto: mapCategoriaFacturaACosto(factura.Categoria),
      Concepto: detalle.ProductoServicio,
      Cantidad: detalle.Cantidad,
      Unidad: detalle.Unidad,
      ValorUnitario: detalle.ValorUnitario,
      ValorTotal: detalle.ValorTotal,
      ProveedorID: factura.ProveedorID,
      FacturaID: factura.FacturaCompraID,
      Estado: 'COMPLETO',
      Observacion: factura.Observacion,
    }));

  await db.transaction('rw', [db.facturasCompra, db.detalleFacturasCompra, db.costosLote, db.syncQueue], async () => {
    await db.facturasCompra.add(factura);
    await db.detalleFacturasCompra.bulkAdd(detalles);
    if (costos.length) await db.costosLote.bulkAdd(costos);
    await enqueueSync('FacturasCompra', factura.FacturaCompraID, 'CREATE', factura);
    await Promise.all(detalles.map((detalle) => enqueueSync('DetalleFacturasCompra', detalle.DetalleID, 'CREATE', detalle)));
    await Promise.all(costos.map((costo) => enqueueSync('CostosLote', costo.CostoID, 'CREATE', costo)));
  });

  return factura;
}

export async function crearFacturaVenta(input: FacturaVentaInput): Promise<FacturaVenta> {
  const factura: FacturaVenta = {
    FacturaVentaID: createId('fac_venta'),
    FechaFactura: input.FechaFactura,
    ClienteID: input.ClienteID,
    NumeroFactura: input.NumeroFactura,
    Subtotal: input.Subtotal,
    IVA: input.IVA,
    Total: input.Subtotal + input.IVA,
    EstadoCobro: input.EstadoCobro,
    ArchivoPDF: '',
    Observacion: input.Observacion,
  };
  const detalles: DetalleFacturaVenta[] = input.detalle.map((detalle) => ({
    DetalleVentaID: createId('det_venta'),
    FacturaVentaID: factura.FacturaVentaID,
    LoteID: detalle.LoteID,
    ProductoServicio: detalle.ProductoServicio,
    CantidadAves: detalle.CantidadAves,
    Kg: detalle.Kg,
    PrecioKg: detalle.PrecioKg,
    ValorTotal: detalle.Kg * detalle.PrecioKg,
  }));

  const salidas: SalidaPollo[] = detalles
    .filter((detalle) => detalle.LoteID)
    .map((detalle) => ({
      SalidaID: createId('salida_admin'),
      Fecha: factura.FechaFactura,
      LoteID: detalle.LoteID,
      TipoSalida: 'VENTA',
      Sexo: 'MIXTO',
      CantidadAves: detalle.CantidadAves,
      PesoTotalKg: detalle.Kg,
      PesoPromedioKg: detalle.CantidadAves > 0 ? detalle.Kg / detalle.CantidadAves : 0,
      ClienteID: factura.ClienteID,
      PrecioKg: detalle.PrecioKg,
      ValorTotal: detalle.ValorTotal,
      FacturaVentaID: factura.FacturaVentaID,
      EstadoAdministrativo: 'COMPLETO',
      RegistradoPor: 'ADMIN',
      Observaciones: factura.Observacion,
      EstadoSync: 'PENDIENTE',
    }));

  await db.transaction('rw', [db.facturasVenta, db.detalleFacturasVenta, db.salidasPollo, db.syncQueue], async () => {
    await db.facturasVenta.add(factura);
    await db.detalleFacturasVenta.bulkAdd(detalles);
    if (salidas.length) await db.salidasPollo.bulkAdd(salidas);
    await enqueueSync('FacturasVenta', factura.FacturaVentaID, 'CREATE', factura);
    await Promise.all(detalles.map((detalle) => enqueueSync('DetalleFacturasVenta', detalle.DetalleVentaID, 'CREATE', detalle)));
    await Promise.all(salidas.map((salida) => enqueueSync('SalidasPollo', salida.SalidaID, 'CREATE', salida)));
  });

  return factura;
}

export async function registrarMovimientoInventario(input: MovimientoInventarioInput, user: Usuario): Promise<MovimientoInventarioAlimento> {
  const movimiento: MovimientoInventarioAlimento = {
    MovimientoInventarioID: createId('mov_inv'),
    ...input,
    RegistradoPor: user.UsuarioID,
  };
  await db.transaction('rw', [db.movimientosInventarioAlimento, db.inventarioAlimento, db.syncQueue], async () => {
    await db.movimientosInventarioAlimento.add(movimiento);
    await aplicarMovimientoInventario(movimiento);
    await enqueueSync('MovimientosInventarioAlimento', movimiento.MovimientoInventarioID, 'CREATE', movimiento);
  });
  return movimiento;
}

export async function crearCurvaEstandar(input: CurvaInput): Promise<CurvaEstandar> {
  const curva: CurvaEstandar = {
    CurvaID: createId('curva'),
    ...input,
  };
  await db.curvasEstandar.add(curva);
  await enqueueSync('CurvasEstandar', curva.CurvaID, 'CREATE', curva);
  return curva;
}

export async function crearTratamiento(input: TratamientoInput): Promise<TratamientoVeterinario> {
  const tratamiento: TratamientoVeterinario = {
    TratamientoID: createId('trat'),
    ...input,
  };
  await db.tratamientosVeterinarios.add(tratamiento);
  await enqueueSync('TratamientosVeterinarios', tratamiento.TratamientoID, 'CREATE', tratamiento);
  return tratamiento;
}

export async function generarCierreSemanal(loteId: string, semana: number): Promise<CierreSemanal> {
  const [lote, registros, pesajes, costos, actividades, alertas] = await Promise.all([
    db.lotes.get(loteId),
    db.registroDiarioLote.where('LoteID').equals(loteId).toArray(),
    db.pesajes.where('LoteID').equals(loteId).toArray(),
    db.costosLote.where('LoteID').equals(loteId).toArray(),
    db.actividadesLote.where('LoteID').equals(loteId).toArray(),
    db.alertas.where('LoteID').equals(loteId).toArray(),
  ]);
  if (!lote) throw new Error('Lote no encontrado.');
  const cierre: CierreSemanal = {
    ...construirCierreSemanal({ lote, semana, registros, pesajes, costos, actividades, alertas }),
    CierreSemanalID: createId('cierre_sem'),
  };
  await db.cierresSemanales.add(cierre);
  await enqueueSync('CierresSemanales', cierre.CierreSemanalID, 'CREATE', cierre);
  return cierre;
}

export async function generarCierreFinalLote(loteId: string): Promise<CierreLote> {
  const [lote, registros, pesajes, costos, salidas] = await Promise.all([
    db.lotes.get(loteId),
    db.registroDiarioLote.where('LoteID').equals(loteId).toArray(),
    db.pesajes.where('LoteID').equals(loteId).toArray(),
    db.costosLote.where('LoteID').equals(loteId).toArray(),
    db.salidasPollo.where('LoteID').equals(loteId).toArray(),
  ]);
  if (!lote) throw new Error('Lote no encontrado.');
  const cierre: CierreLote = {
    ...construirCierreLote({ lote, registros, pesajes, costos, salidas }),
    CierreLoteID: createId('cierre_lote'),
  };
  await db.transaction('rw', [db.cierreLote, db.lotes, db.syncQueue], async () => {
    await db.cierreLote.add(cierre);
    await db.lotes.update(lote.LoteID, { EstadoLote: 'CERRADO' });
    await enqueueSync('CierreLote', cierre.CierreLoteID, 'CREATE', cierre);
    await enqueueSync('Lotes', lote.LoteID, 'UPDATE', { ...lote, EstadoLote: 'CERRADO' });
  });
  return cierre;
}

async function aplicarMovimientoInventario(movimiento: MovimientoInventarioAlimento): Promise<void> {
  const existing = await db.inventarioAlimento.where('TipoAlimentoID').equals(movimiento.TipoAlimentoID).first();
  const sign = ['ENTRADA_COMPRA', 'DEVOLUCION'].includes(movimiento.TipoMovimiento) ? 1 : -1;
  const nextBultos = (existing?.BultosDisponibles ?? 0) + sign * movimiento.CantidadBultos;
  const nextKg = (existing?.KgDisponibles ?? 0) + sign * movimiento.KgTotal;
  const inventario: InventarioAlimento = {
    InventarioID: existing?.InventarioID ?? createId('inv'),
    TipoAlimentoID: movimiento.TipoAlimentoID,
    BultosDisponibles: Math.max(0, nextBultos),
    KgDisponibles: Math.max(0, nextKg),
    UltimaActualizacion: nowISO(),
  };
  await db.inventarioAlimento.put(inventario);
  await enqueueSync('InventarioAlimento', inventario.InventarioID, existing ? 'UPDATE' : 'CREATE', inventario);
}

function mapCategoriaFacturaACosto(categoria: string): CostoLote['CategoriaCosto'] {
  const normalized = categoria.toUpperCase();
  if (normalized.includes('POLLITO')) return 'POLLITO';
  if (normalized.includes('ALIMENTO')) return 'ALIMENTO';
  if (normalized.includes('CISCO')) return 'CISCO';
  if (normalized.includes('GAS')) return 'GAS';
  if (normalized.includes('VACUNA')) return 'VACUNA';
  if (normalized.includes('MEDIC')) return 'MEDICAMENTO';
  if (normalized.includes('TRANSPORTE')) return 'TRANSPORTE';
  return 'OTRO';
}

export function nuevaFacturaCompraVacia(): FacturaCompraInput {
  return {
    FechaFactura: todayISO(),
    ProveedorID: '',
    NumeroFactura: '',
    Categoria: 'ALIMENTO',
    Subtotal: 0,
    IVA: 0,
    EstadoPago: 'PENDIENTE',
    Observacion: '',
    detalle: [{ LoteID: '', ProductoServicio: '', Cantidad: 1, Unidad: 'UND', ValorUnitario: 0 }],
  };
}
