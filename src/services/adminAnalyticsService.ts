import { addDays, getDiaLote, todayISO } from '../lib/date';
import type {
  ActividadLote,
  Alerta,
  CierreLote,
  CierreSemanal,
  Cliente,
  CostoLote,
  CurvaEstandar,
  EventoSanitario,
  FacturaCompra,
  FacturaVenta,
  Lote,
  Pesaje,
  Proveedor,
  RegistroDiarioLote,
  SalidaPollo,
  TratamientoVeterinario,
} from '../types/entities';
import { costoPorKgVendido, gananciaDiaria, margen, prediccionSalidaDias, utilidadBruta } from './calculationsService';

export interface EconomiaLote {
  loteId: string;
  costoTotal: number;
  ingresoTotal: number;
  utilidadBruta: number;
  margen: number;
  kgVendidos: number;
  avesVendidas: number;
  costoPorKg: number;
  ingresoPorKg: number;
  utilidadPorKg: number;
  costoPorAveInicial: number;
  costoPorAveVendida: number;
}

export interface ComparacionLoteRow extends EconomiaLote {
  codigoLote: string;
  mortalidadTotal: number;
  conversionFinal: number;
  pesoFinal: number;
  edadFinal: number;
  consumoTotal: number;
  utilidadPorAve: number;
  proveedorPollito: string;
  alertas: number;
  cumplimientoActividades: number;
}

export interface AnalisisProveedorRow {
  proveedorId: string;
  proveedor: string;
  tipo: string;
  lotes: number;
  mortalidadPromedio: number;
  pesoFinalPromedio: number;
  conversionPromedio: number;
  rentabilidadPromedio: number;
  costoPromedio: number;
  eventosSanitarios: number;
  cumplimientoActividades: number;
}

export interface PrediccionSalida {
  pesoActualGr: number;
  pesoObjetivoGr: number;
  gananciaDiariaGr: number;
  diasEstimados: number;
  fechaEstimada: string;
  consumoAdicionalKg: number;
  costoAdicionalEstimado: number;
  escenarios: Array<{
    dia: number;
    fecha: string;
    pesoEstimadoGr: number;
  }>;
}

export function calcularEconomiaLote(input: {
  lote: Lote;
  costos: CostoLote[];
  salidas: SalidaPollo[];
}): EconomiaLote {
  const loteCostos = input.costos.filter((costo) => costo.LoteID === input.lote.LoteID);
  const loteSalidas = input.salidas.filter((salida) => salida.LoteID === input.lote.LoteID && salida.TipoSalida === 'VENTA');
  const costoTotal = loteCostos.reduce((sum, costo) => sum + costo.ValorTotal, 0);
  const ingresoTotal = loteSalidas.reduce((sum, salida) => sum + salida.ValorTotal, 0);
  const kgVendidos = loteSalidas.reduce((sum, salida) => sum + salida.PesoTotalKg, 0);
  const avesVendidas = loteSalidas.reduce((sum, salida) => sum + salida.CantidadAves, 0);
  const utilidad = utilidadBruta(ingresoTotal, costoTotal);

  return {
    loteId: input.lote.LoteID,
    costoTotal,
    ingresoTotal,
    utilidadBruta: utilidad,
    margen: margen(ingresoTotal, utilidad),
    kgVendidos,
    avesVendidas,
    costoPorKg: costoPorKgVendido(costoTotal, kgVendidos),
    ingresoPorKg: kgVendidos > 0 ? ingresoTotal / kgVendidos : 0,
    utilidadPorKg: kgVendidos > 0 ? utilidad / kgVendidos : 0,
    costoPorAveInicial: input.lote.CantidadInicialTotal > 0 ? costoTotal / input.lote.CantidadInicialTotal : 0,
    costoPorAveVendida: avesVendidas > 0 ? costoTotal / avesVendidas : 0,
  };
}

export function calcularMortalidadTotal(lote: Lote, registros: RegistroDiarioLote[]): number {
  const muertos = registros
    .filter((registro) => registro.LoteID === lote.LoteID)
    .reduce((sum, registro) => sum + registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar, 0);
  return lote.CantidadInicialTotal > 0 ? muertos / lote.CantidadInicialTotal : 0;
}

export function consumoTotalLote(lote: Lote, registros: RegistroDiarioLote[]): number {
  return registros.filter((registro) => registro.LoteID === lote.LoteID).reduce((sum, registro) => sum + registro.KgConsumidos, 0);
}

export function latestPesaje(lote: Lote, pesajes: Pesaje[]): Pesaje | undefined {
  return pesajes
    .filter((pesaje) => pesaje.LoteID === lote.LoteID)
    .sort((a, b) => b.DiaLote - a.DiaLote || b.Fecha.localeCompare(a.Fecha))[0];
}

export function cumplimientoActividades(lote: Lote, actividades: ActividadLote[]): number {
  const loteActividades = actividades.filter((actividad) => actividad.LoteID === lote.LoteID);
  if (loteActividades.length === 0) return 1;
  return loteActividades.filter((actividad) => actividad.Estado === 'REALIZADA' || actividad.Estado === 'NO_APLICA').length / loteActividades.length;
}

export function compararLotes(input: {
  lotes: Lote[];
  costos: CostoLote[];
  salidas: SalidaPollo[];
  registros: RegistroDiarioLote[];
  pesajes: Pesaje[];
  proveedores: Proveedor[];
  alertas: Alerta[];
  actividades: ActividadLote[];
}): ComparacionLoteRow[] {
  const proveedoresById = new Map(input.proveedores.map((proveedor) => [proveedor.ProveedorID, proveedor.NombreProveedor]));
  return input.lotes.map((lote) => {
    const economia = calcularEconomiaLote({ lote, costos: input.costos, salidas: input.salidas });
    const consumo = consumoTotalLote(lote, input.registros);
    const pesaje = latestPesaje(lote, input.pesajes);
    return {
      ...economia,
      codigoLote: lote.CodigoLote,
      mortalidadTotal: calcularMortalidadTotal(lote, input.registros),
      conversionFinal: economia.kgVendidos > 0 ? consumo / economia.kgVendidos : 0,
      pesoFinal: pesaje?.PesoPromedioGeneral ?? 0,
      edadFinal: pesaje?.DiaLote ?? getDiaLote(lote.FechaLlegada),
      consumoTotal: consumo,
      utilidadPorAve: economia.avesVendidas > 0 ? economia.utilidadBruta / economia.avesVendidas : 0,
      proveedorPollito: proveedoresById.get(lote.ProveedorPollitoID) ?? 'Sin proveedor',
      alertas: input.alertas.filter((alerta) => alerta.LoteID === lote.LoteID).length,
      cumplimientoActividades: cumplimientoActividades(lote, input.actividades),
    };
  });
}

export function analizarProveedores(input: {
  proveedores: Proveedor[];
  lotes: Lote[];
  costos: CostoLote[];
  salidas: SalidaPollo[];
  registros: RegistroDiarioLote[];
  pesajes: Pesaje[];
  eventos: EventoSanitario[];
  actividades: ActividadLote[];
}): AnalisisProveedorRow[] {
  return input.proveedores.map((proveedor) => {
    const lotesProveedor = input.lotes.filter((lote) => lote.ProveedorPollitoID === proveedor.ProveedorID);
    const comparacion = compararLotes({
      lotes: lotesProveedor,
      costos: input.costos,
      salidas: input.salidas,
      registros: input.registros,
      pesajes: input.pesajes,
      proveedores: input.proveedores,
      alertas: [],
      actividades: input.actividades,
    });
    const avg = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
    return {
      proveedorId: proveedor.ProveedorID,
      proveedor: proveedor.NombreProveedor,
      tipo: proveedor.TipoProveedor,
      lotes: lotesProveedor.length,
      mortalidadPromedio: avg(comparacion.map((row) => row.mortalidadTotal)),
      pesoFinalPromedio: avg(comparacion.map((row) => row.pesoFinal)),
      conversionPromedio: avg(comparacion.map((row) => row.conversionFinal)),
      rentabilidadPromedio: avg(comparacion.map((row) => row.margen)),
      costoPromedio: avg(comparacion.map((row) => row.costoTotal)),
      eventosSanitarios: input.eventos.filter((evento) => lotesProveedor.some((lote) => lote.LoteID === evento.LoteID)).length,
      cumplimientoActividades: avg(comparacion.map((row) => row.cumplimientoActividades)),
    };
  });
}

export function calcularPrediccionSalida(input: {
  lote: Lote;
  pesajes: Pesaje[];
  curvas: CurvaEstandar[];
  costos: CostoLote[];
  registros: RegistroDiarioLote[];
  pesoObjetivoGr: number;
}): PrediccionSalida {
  const lotePesajes = input.pesajes.filter((pesaje) => pesaje.LoteID === input.lote.LoteID).sort((a, b) => a.DiaLote - b.DiaLote);
  const current = lotePesajes.at(-1);
  const previous = lotePesajes.at(-2);
  const pesoActualGr = current?.PesoPromedioGeneral ?? 0;
  const ganancia = current && previous ? gananciaDiaria(current.PesoPromedioGeneral, previous.PesoPromedioGeneral, current.DiaLote - previous.DiaLote) : 65;
  const diasEstimados = prediccionSalidaDias(input.pesoObjetivoGr, pesoActualGr, ganancia);
  const diaActual = current?.DiaLote ?? getDiaLote(input.lote.FechaLlegada);
  const curvaActual = input.curvas.find((curva) => curva.LineaGenetica === input.lote.LineaGenetica && curva.Sexo === 'GENERAL' && curva.DiaLote === diaActual);
  const avesVivas = Math.max(0, input.lote.CantidadInicialTotal - input.registros.filter((registro) => registro.LoteID === input.lote.LoteID).reduce((sum, registro) => sum + registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar, 0));
  const consumoAdicionalKg = ((curvaActual?.ConsumoDiarioEsperadoGrAve ?? 130) * avesVivas * diasEstimados) / 1000;
  const costosAlimento = input.costos.filter((costo) => costo.LoteID === input.lote.LoteID && costo.CategoriaCosto === 'ALIMENTO');
  const kgConsumido = consumoTotalLote(input.lote, input.registros);
  const costoKgAlimento = kgConsumido > 0 ? costosAlimento.reduce((sum, costo) => sum + costo.ValorTotal, 0) / kgConsumido : 0;

  return {
    pesoActualGr,
    pesoObjetivoGr: input.pesoObjetivoGr,
    gananciaDiariaGr: ganancia,
    diasEstimados,
    fechaEstimada: addDays(todayISO(), Math.ceil(diasEstimados)),
    consumoAdicionalKg,
    costoAdicionalEstimado: consumoAdicionalKg * costoKgAlimento,
    escenarios: [35, 38, 42].map((dia) => ({
      dia,
      fecha: addDays(input.lote.FechaLlegada, dia - 1),
      pesoEstimadoGr: pesoActualGr + Math.max(0, dia - diaActual) * ganancia,
    })),
  };
}

export function construirCierreSemanal(input: {
  lote: Lote;
  semana: number;
  registros: RegistroDiarioLote[];
  pesajes: Pesaje[];
  costos: CostoLote[];
  actividades: ActividadLote[];
  alertas: Alerta[];
}): CierreSemanal {
  const fromDay = (input.semana - 1) * 7 + 1;
  const toDay = input.semana * 7;
  const registrosSemana = input.registros.filter((registro) => registro.LoteID === input.lote.LoteID && registro.DiaLote >= fromDay && registro.DiaLote <= toDay);
  const registrosAcumulados = input.registros.filter((registro) => registro.LoteID === input.lote.LoteID && registro.DiaLote <= toDay);
  const muertosSemana = registrosSemana.reduce((sum, registro) => sum + registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar, 0);
  const muertosAcumulados = registrosAcumulados.reduce((sum, registro) => sum + registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar, 0);
  const consumoSemana = registrosSemana.reduce((sum, registro) => sum + registro.KgConsumidos, 0);
  const consumoAcumulado = registrosAcumulados.reduce((sum, registro) => sum + registro.KgConsumidos, 0);
  const pesaje = input.pesajes.filter((item) => item.LoteID === input.lote.LoteID && item.DiaLote <= toDay).sort((a, b) => b.DiaLote - a.DiaLote)[0];
  const avesFinalSemana = Math.max(0, input.lote.CantidadInicialTotal - muertosAcumulados);
  const costoSemana = input.costos.filter((costo) => costo.LoteID === input.lote.LoteID && costo.Fecha >= addDays(input.lote.FechaLlegada, fromDay - 1) && costo.Fecha <= addDays(input.lote.FechaLlegada, toDay - 1)).reduce((sum, costo) => sum + costo.ValorTotal, 0);

  return {
    CierreSemanalID: '',
    LoteID: input.lote.LoteID,
    SemanaLote: input.semana,
    FechaInicio: addDays(input.lote.FechaLlegada, fromDay - 1),
    FechaFin: addDays(input.lote.FechaLlegada, toDay - 1),
    AvesInicialSemana: Math.max(0, input.lote.CantidadInicialTotal - (muertosAcumulados - muertosSemana)),
    AvesFinalSemana: avesFinalSemana,
    MuertosSemana: muertosSemana,
    MortalidadSemana: input.lote.CantidadInicialTotal > 0 ? muertosSemana / input.lote.CantidadInicialTotal : 0,
    MortalidadAcumulada: input.lote.CantidadInicialTotal > 0 ? muertosAcumulados / input.lote.CantidadInicialTotal : 0,
    ConsumoSemanaKg: consumoSemana,
    ConsumoAcumuladoKg: consumoAcumulado,
    PesoPromedioMacho: pesaje?.PesoPromedioMachos ?? 0,
    PesoPromedioHembra: pesaje?.PesoPromedioHembras ?? 0,
    PesoPromedioGeneral: pesaje?.PesoPromedioGeneral ?? 0,
    GananciaDiariaMacho: 0,
    GananciaDiariaHembra: 0,
    ConversionSemana: pesaje?.PesoPromedioGeneral ? consumoSemana / ((avesFinalSemana * pesaje.PesoPromedioGeneral) / 1000) : 0,
    ConversionAcumulada: pesaje?.PesoPromedioGeneral ? consumoAcumulado / ((avesFinalSemana * pesaje.PesoPromedioGeneral) / 1000) : 0,
    CostoSemana: costoSemana,
    CostoAcumulado: input.costos.filter((costo) => costo.LoteID === input.lote.LoteID && costo.Fecha <= addDays(input.lote.FechaLlegada, toDay - 1)).reduce((sum, costo) => sum + costo.ValorTotal, 0),
    ActividadesNoRealizadas: input.actividades.filter((actividad) => actividad.LoteID === input.lote.LoteID && (actividad.Estado === 'NO_REALIZADA' || actividad.Estado === 'VENCIDA')).length,
    AlertasGeneradas: input.alertas.filter((alerta) => alerta.LoteID === input.lote.LoteID).length,
    EstadoCierre: 'GENERADO',
  };
}

export function construirCierreLote(input: {
  lote: Lote;
  registros: RegistroDiarioLote[];
  pesajes: Pesaje[];
  costos: CostoLote[];
  salidas: SalidaPollo[];
}): CierreLote {
  const economia = calcularEconomiaLote({ lote: input.lote, costos: input.costos, salidas: input.salidas });
  const muertos = input.registros.filter((registro) => registro.LoteID === input.lote.LoteID).reduce((sum, registro) => sum + registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar, 0);
  const pesaje = latestPesaje(input.lote, input.pesajes);
  return {
    CierreLoteID: '',
    LoteID: input.lote.LoteID,
    FechaCierre: todayISO(),
    CantidadInicial: input.lote.CantidadInicialTotal,
    CantidadVendida: economia.avesVendidas,
    CantidadMuerta: muertos,
    MortalidadFinal: input.lote.CantidadInicialTotal > 0 ? muertos / input.lote.CantidadInicialTotal : 0,
    KgVendidos: economia.kgVendidos,
    IngresoTotal: economia.ingresoTotal,
    CostoTotal: economia.costoTotal,
    UtilidadBruta: economia.utilidadBruta,
    CostoPorAveInicial: economia.costoPorAveInicial,
    CostoPorAveVendida: economia.costoPorAveVendida,
    CostoPorKg: economia.costoPorKg,
    IngresoPorKg: economia.ingresoPorKg,
    UtilidadPorKg: economia.utilidadPorKg,
    Margen: economia.margen,
    ConversionFinal: economia.kgVendidos > 0 ? consumoTotalLote(input.lote, input.registros) / economia.kgVendidos : 0,
    PesoPromedioFinal: pesaje?.PesoPromedioGeneral ?? 0,
    EdadFinal: pesaje?.DiaLote ?? getDiaLote(input.lote.FechaLlegada),
    EstadoCierre: 'GENERADO',
  };
}

export function tratamientoEnRetiro(tratamiento: TratamientoVeterinario, fecha = todayISO()): boolean {
  if (!tratamiento.FechaFin || tratamiento.PeriodoRetiroDias <= 0) return false;
  return fecha <= addDays(tratamiento.FechaFin, tratamiento.PeriodoRetiroDias);
}

export function facturaCompraPendiente(factura: FacturaCompra): boolean {
  return factura.EstadoPago === 'PENDIENTE';
}

export function facturaVentaPendiente(factura: FacturaVenta): boolean {
  return factura.EstadoCobro === 'PENDIENTE' || factura.EstadoCobro === 'CREDITO';
}

export function clienteNombre(clienteId: string, clientes: Cliente[]): string {
  return clientes.find((cliente) => cliente.ClienteID === clienteId)?.NombreCliente ?? 'Sin cliente';
}
