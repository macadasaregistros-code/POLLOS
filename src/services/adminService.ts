import { createId } from '../lib/id';
import { addDays, nowISO, todayISO } from '../lib/date';
import { db } from './localDbService';
import { enqueueSync } from './syncService';
import { construirCierreLote, construirCierreSemanal } from './adminAnalyticsService';
import { getProgramacionActivityCategory, getProgramacionTemplateCategory } from './programmingCatalogService';
import type {
  ActividadLote,
  ActividadProgramada,
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
  PlanVacunalBase,
  Perro,
  Proveedor,
  SalidaPollo,
  TipoAlimento,
  TratamientoVeterinario,
  Usuario,
  VacunaLote,
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

export type ActividadProgramadaInput = Omit<ActividadProgramada, 'ActividadProgramadaID'> & { ActividadProgramadaID?: string };
export type PlanVacunalInput = Omit<PlanVacunalBase, 'VacunaBaseID'> & { VacunaBaseID?: string };
export type PerroProgramacionInput = Omit<Perro, 'PerroID' | 'EstadoSync'> & { PerroID?: string };

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

export async function guardarActividadProgramada(input: ActividadProgramadaInput): Promise<ActividadProgramada> {
  const actividad: ActividadProgramada = {
    ActividadProgramadaID: input.ActividadProgramadaID || createId('act_base'),
    NombreActividad: input.NombreActividad.trim(),
    Categoria: input.Categoria.trim(),
    TipoFrecuencia: input.TipoFrecuencia,
    DiaLote: input.DiaLote,
    HoraSugerida: input.HoraSugerida.trim(),
    AplicaDesdeDia: input.AplicaDesdeDia,
    AplicaHastaDia: input.AplicaHastaDia,
    RequiereDato: input.RequiereDato,
    RequiereFoto: input.RequiereFoto,
    Activa: input.Activa,
  };
  const exists = Boolean(input.ActividadProgramadaID && await db.actividadesProgramadas.get(input.ActividadProgramadaID));
  await db.actividadesProgramadas.put(actividad);
  await enqueueSync('ActividadesProgramadas', actividad.ActividadProgramadaID, exists ? 'UPDATE' : 'CREATE', actividad);
  return actividad;
}

export async function guardarPlanVacunalBase(input: PlanVacunalInput): Promise<PlanVacunalBase> {
  const vacuna: PlanVacunalBase = {
    VacunaBaseID: input.VacunaBaseID || createId('vac_base'),
    NombreVacuna: input.NombreVacuna.trim(),
    DiaProgramado: input.DiaProgramado,
    ViaAplicacion: input.ViaAplicacion.trim(),
    Activa: input.Activa,
  };
  const exists = Boolean(input.VacunaBaseID && await db.planVacunalBase.get(input.VacunaBaseID));
  await db.planVacunalBase.put(vacuna);
  await enqueueSync('PlanVacunalBase', vacuna.VacunaBaseID, exists ? 'UPDATE' : 'CREATE', vacuna);
  return vacuna;
}

export async function guardarPerroProgramacion(input: PerroProgramacionInput): Promise<Perro> {
  const perro: Perro = {
    PerroID: input.PerroID || createId('perro'),
    NombrePerro: input.NombrePerro.trim(),
    Activo: input.Activo,
    FechaUltimaRabia: input.FechaUltimaRabia,
    FechaUltimaDesparasitacion: input.FechaUltimaDesparasitacion,
    FrecuenciaRabiaDias: input.FrecuenciaRabiaDias || 365,
    FrecuenciaDesparasitacionDias: input.FrecuenciaDesparasitacionDias || 90,
    Observaciones: input.Observaciones,
    EstadoSync: 'PENDIENTE',
  };
  const exists = Boolean(input.PerroID && await db.perros.get(input.PerroID));
  await db.perros.put(perro);
  await enqueueSync('Perros', perro.PerroID, exists ? 'UPDATE' : 'CREATE', perro);
  return perro;
}

export async function regenerarProgramacionFutura(user: Usuario): Promise<{ actividades: number; vacunas: number }> {
  const today = todayISO();
  const [lotes, assignments, templates, vacunasBase, oldActivities, oldVaccines] = await Promise.all([
    db.lotes.where('EstadoLote').equals('ACTIVO').toArray(),
    db.loteGalpones.where('Estado').equals('ACTIVO').toArray(),
    db.actividadesProgramadas.toArray(),
    db.planVacunalBase.toArray(),
    db.actividadesLote.toArray(),
    db.vacunasLote.toArray(),
  ]);
  const activeLoteIds = new Set(lotes.map((lote) => lote.LoteID));
  const activeTemplates = templates.filter((template) => template.Activa);
  const loteTemplates = activeTemplates.filter((template) => getProgramacionTemplateCategory(template) === 'lote');
  const routineTemplates = activeTemplates.filter((template) => getProgramacionTemplateCategory(template) === 'routine');
  const futureActivities = oldActivities.filter(
    (actividad) =>
      (activeLoteIds.has(actividad.LoteID) || !actividad.LoteID || getProgramacionActivityCategory(actividad, templates) === 'routine') &&
      actividad.FechaProgramada >= today &&
      actividad.Estado !== 'REALIZADA' &&
      actividad.Estado !== 'NO_APLICA',
  );
  const futureVaccines = oldVaccines.filter(
    (vacuna) => activeLoteIds.has(vacuna.LoteID) && vacuna.FechaProgramada >= today && vacuna.Estado !== 'APLICADA' && vacuna.Estado !== 'NO_APLICADA',
  );
  const newActivities: ActividadLote[] = [];
  const newVaccines: VacunaLote[] = [];

  for (const lote of lotes) {
    const assignment = assignments.find((item) => item.LoteID === lote.LoteID);
    if (!assignment) continue;
    newActivities.push(
      ...buildFutureActivitiesForLote(lote, assignment.GalponID, loteTemplates, today),
    );
    newVaccines.push(
      ...vacunasBase
        .filter((vacuna) => vacuna.Activa)
        .map((vacuna): VacunaLote => ({
          VacunaLoteID: createId('vac_lote'),
          LoteID: lote.LoteID,
          GalponID: assignment.GalponID,
          NombreVacuna: vacuna.NombreVacuna,
          Producto: vacuna.NombreVacuna,
          Laboratorio: '',
          LoteProducto: '',
          FechaVencimientoProducto: '',
          ViaAdministracion: vacuna.ViaAplicacion || 'Agua de bebida',
          Cepa: '',
          Enfermedad: vacuna.NombreVacuna,
          NumeroAves: lote.CantidadInicialTotal,
          EdadDias: vacuna.DiaProgramado,
          DiaProgramado: vacuna.DiaProgramado,
          FechaProgramada: addDays(lote.FechaLlegada, vacuna.DiaProgramado - 1),
          Estado: 'PENDIENTE',
          FechaAplicacion: '',
          AplicadaPor: '',
          Responsable: '',
          FirmaResponsable: '',
          Foto: '',
          Observacion: '',
          EstadoSync: 'PENDIENTE',
        }))
        .filter((vacuna) => vacuna.FechaProgramada >= today),
    );
  }
  newActivities.push(...buildFutureRoutineActivities(routineTemplates, today));

  await db.transaction('rw', [db.actividadesLote, db.vacunasLote, db.syncQueue], async () => {
    await Promise.all(
      futureActivities.map(async (actividad) => {
        const patch: Partial<ActividadLote> = { Estado: 'NO_APLICA', Observacion: 'Reprogramada por admin', EstadoSync: 'PENDIENTE' };
        await db.actividadesLote.update(actividad.ActividadLoteID, patch);
        await enqueueSync('ActividadesLote', actividad.ActividadLoteID, 'UPDATE', { ...actividad, ...patch });
      }),
    );
    await Promise.all(
      futureVaccines.map(async (vacuna) => {
        const patch: Partial<VacunaLote> = { Estado: 'NO_APLICADA', Observacion: 'Reprogramada por admin', EstadoSync: 'PENDIENTE' };
        await db.vacunasLote.update(vacuna.VacunaLoteID, patch);
        await enqueueSync('VacunasLote', vacuna.VacunaLoteID, 'UPDATE', { ...vacuna, ...patch });
      }),
    );
    if (newActivities.length) await db.actividadesLote.bulkAdd(newActivities);
    if (newVaccines.length) await db.vacunasLote.bulkAdd(newVaccines);
    await Promise.all(newActivities.map((actividad) => enqueueSync('ActividadesLote', actividad.ActividadLoteID, 'CREATE', actividad)));
    await Promise.all(newVaccines.map((vacuna) => enqueueSync('VacunasLote', vacuna.VacunaLoteID, 'CREATE', vacuna)));
  });

  void user;
  return { actividades: newActivities.length, vacunas: newVaccines.length };
}

function buildFutureActivitiesForLote(lote: { LoteID: string; FechaLlegada: string }, galponId: string, templates: ActividadProgramada[], today: string): ActividadLote[] {
  return templates.flatMap((template) =>
    getTemplateDays(template)
      .map((day): ActividadLote => ({
        ActividadLoteID: createId('act_lote'),
        LoteID: lote.LoteID,
        GalponID: galponId,
        FechaProgramada: addDays(lote.FechaLlegada, day - 1),
        DiaLote: day,
        NombreActividad: template.NombreActividad,
        Categoria: template.Categoria,
        Estado: 'PENDIENTE',
        FechaRealizada: '',
        RealizadaPor: '',
        Observacion: '',
        CerradaComoPendiente: false,
        EstadoSync: 'PENDIENTE',
      }))
      .filter((actividad) => actividad.FechaProgramada >= today),
  );
}

function buildFutureRoutineActivities(templates: ActividadProgramada[], today: string, horizonDays = 42): ActividadLote[] {
  return templates.flatMap((template) =>
    getRoutineOffsets(template, horizonDays).map((offset): ActividadLote => ({
      ActividadLoteID: createId('act_rutina'),
      LoteID: '',
      GalponID: '',
      FechaProgramada: addDays(today, offset),
      DiaLote: 0,
      NombreActividad: template.NombreActividad,
      Categoria: template.Categoria,
      Estado: 'PENDIENTE',
      FechaRealizada: '',
      RealizadaPor: '',
      Observacion: '',
      CerradaComoPendiente: false,
      EstadoSync: 'PENDIENTE',
    })),
  );
}

function getRoutineOffsets(template: ActividadProgramada, horizonDays: number): number[] {
  const step = template.TipoFrecuencia === 'CADA_3_DIAS'
    ? 3
    : template.TipoFrecuencia === 'SEMANAL'
      ? 7
      : template.TipoFrecuencia === 'MENSUAL'
        ? 30
        : 1;
  const offsets: number[] = [];
  for (let offset = 0; offset <= horizonDays; offset += step) offsets.push(offset);
  return offsets;
}

function getTemplateDays(template: ActividadProgramada): number[] {
  const days: number[] = [];
  if (template.TipoFrecuencia === 'DIARIA') {
    for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 1) days.push(day);
  } else if (template.TipoFrecuencia === 'CADA_3_DIAS') {
    for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 3) days.push(day);
  } else if (template.TipoFrecuencia === 'SEMANAL') {
    for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 7) days.push(day);
  } else if (template.TipoFrecuencia === 'MENSUAL') {
    for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 30) days.push(day);
  } else {
    days.push(Math.max(1, template.DiaLote));
  }
  return days;
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
