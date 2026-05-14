import type {
  ActividadLote,
  ConsumoAlimentoLote,
  CurvaEstandar,
  Lote,
  LoteGalpon,
  LoteResumen,
  Pesaje,
  PesajeDetalle,
  RegistroDiarioLote,
  SalidaPollo,
  SyncQueueItem,
  VacunaLote,
} from '../types/entities';
import { getDiaLote } from '../lib/date';

export interface PesajeStats {
  cantidadMachos: number;
  cantidadHembras: number;
  promedioMachos: number;
  promedioHembras: number;
  promedioGeneral: number;
  minimoMachos: number;
  maximoMachos: number;
  minimoHembras: number;
  maximoHembras: number;
  uniformidadMachos: number;
  uniformidadHembras: number;
}

export interface LoteTotals {
  muertosMachos: number;
  muertosHembras: number;
  muertosSinClasificar: number;
  sacrificadosMachos: number;
  sacrificadosHembras: number;
  vendidosMachos: number;
  vendidosHembras: number;
  consumoKg: number;
}

export function sumLoteTotals(registros: RegistroDiarioLote[], consumos: ConsumoAlimentoLote[] = []): LoteTotals {
  const totals = registros.reduce<LoteTotals>(
    (acc, registro) => ({
      muertosMachos: acc.muertosMachos + registro.MuertosMachos,
      muertosHembras: acc.muertosHembras + registro.MuertosHembras,
      muertosSinClasificar: acc.muertosSinClasificar + registro.MuertosSinClasificar,
      sacrificadosMachos: acc.sacrificadosMachos + registro.SacrificadosMachos,
      sacrificadosHembras: acc.sacrificadosHembras + registro.SacrificadosHembras,
      vendidosMachos: acc.vendidosMachos + registro.VendidosMachos,
      vendidosHembras: acc.vendidosHembras + registro.VendidosHembras,
      consumoKg: acc.consumoKg + registro.KgConsumidos,
    }),
    {
      muertosMachos: 0,
      muertosHembras: 0,
      muertosSinClasificar: 0,
      sacrificadosMachos: 0,
      sacrificadosHembras: 0,
      vendidosMachos: 0,
      vendidosHembras: 0,
      consumoKg: 0,
    },
  );

  if (totals.consumoKg > 0 || consumos.length === 0) return totals;
  return {
    ...totals,
    consumoKg: consumos.reduce((sum, consumo) => sum + consumo.KgConsumidos, 0),
  };
}

export function avesVivasMachos(lote: Lote, totals: LoteTotals): number {
  return Math.max(0, lote.CantidadInicialMachos - totals.muertosMachos - totals.vendidosMachos - totals.sacrificadosMachos);
}

export function avesVivasHembras(lote: Lote, totals: LoteTotals): number {
  return Math.max(0, lote.CantidadInicialHembras - totals.muertosHembras - totals.vendidosHembras - totals.sacrificadosHembras);
}

export function avesVivasTotal(lote: Lote, totals: LoteTotals): number {
  return avesVivasMachos(lote, totals) + avesVivasHembras(lote, totals);
}

export function mortalidadAcumulada(lote: Lote, totals: LoteTotals): number {
  if (lote.CantidadInicialTotal <= 0) return 0;
  return (totals.muertosMachos + totals.muertosHembras + totals.muertosSinClasificar) / lote.CantidadInicialTotal;
}

export function pesoVivoEstimadoKg(
  machosVivos: number,
  hembrasVivas: number,
  pesoPromedioMachoKg: number,
  pesoPromedioHembraKg: number,
): number {
  return machosVivos * pesoPromedioMachoKg + hembrasVivas * pesoPromedioHembraKg;
}

export function conversionAlimenticia(consumoAcumuladoKg: number, pesoVivoKg: number): number {
  if (pesoVivoKg <= 0) return 0;
  return consumoAcumuladoKg / pesoVivoKg;
}

export function gananciaDiaria(pesoActualGr: number, pesoAnteriorGr: number, diasEntrePesajes: number): number {
  if (diasEntrePesajes <= 0) return 0;
  return (pesoActualGr - pesoAnteriorGr) / diasEntrePesajes;
}

export function costoPorKgVendido(costoTotalLote: number, kgVendidos: number): number {
  if (kgVendidos <= 0) return 0;
  return costoTotalLote / kgVendidos;
}

export function utilidadBruta(ingresoTotal: number, costoTotal: number): number {
  return ingresoTotal - costoTotal;
}

export function margen(ingresoTotal: number, utilidad: number): number {
  if (ingresoTotal <= 0) return 0;
  return utilidad / ingresoTotal;
}

export function prediccionSalidaDias(pesoObjetivoGr: number, pesoActualGr: number, gananciaDiariaGr: number): number {
  if (gananciaDiariaGr <= 0) return 0;
  return Math.max(0, (pesoObjetivoGr - pesoActualGr) / gananciaDiariaGr);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function uniformity(values: number[], avg: number): number {
  if (values.length === 0 || avg <= 0) return 0;
  const min = avg * 0.9;
  const max = avg * 1.1;
  return values.filter((value) => value >= min && value <= max).length / values.length;
}

export function calculatePesajeStats(detalles: Pick<PesajeDetalle, 'Sexo' | 'PesoGramos'>[]): PesajeStats {
  const machos = detalles.filter((detalle) => detalle.Sexo === 'MACHO').map((detalle) => detalle.PesoGramos);
  const hembras = detalles.filter((detalle) => detalle.Sexo === 'HEMBRA').map((detalle) => detalle.PesoGramos);
  const todos = [...machos, ...hembras];
  const promedioMachos = average(machos);
  const promedioHembras = average(hembras);

  return {
    cantidadMachos: machos.length,
    cantidadHembras: hembras.length,
    promedioMachos,
    promedioHembras,
    promedioGeneral: average(todos),
    minimoMachos: machos.length > 0 ? Math.min(...machos) : 0,
    maximoMachos: machos.length > 0 ? Math.max(...machos) : 0,
    minimoHembras: hembras.length > 0 ? Math.min(...hembras) : 0,
    maximoHembras: hembras.length > 0 ? Math.max(...hembras) : 0,
    uniformidadMachos: uniformity(machos, promedioMachos),
    uniformidadHembras: uniformity(hembras, promedioHembras),
  };
}

export function latestPesajeForLote(pesajes: Pesaje[], loteId: string): Pesaje | undefined {
  return pesajes
    .filter((pesaje) => pesaje.LoteID === loteId)
    .sort((a, b) => b.Fecha.localeCompare(a.Fecha) || b.FechaHoraRegistro.localeCompare(a.FechaHoraRegistro))[0];
}

export function compareAgainstStandard(pesaje: Pesaje | undefined, curvas: CurvaEstandar[], lote: Lote): number {
  if (!pesaje) return 0;
  const curva = curvas.find(
    (item) => item.LineaGenetica === lote.LineaGenetica && item.Sexo === 'GENERAL' && item.DiaLote === pesaje.DiaLote,
  );
  return curva ? pesaje.PesoPromedioGeneral - curva.PesoEsperadoGr : 0;
}

export function buildLoteResumen(input: {
  lote: Lote;
  registros: RegistroDiarioLote[];
  consumos: ConsumoAlimentoLote[];
  pesajes: Pesaje[];
  loteGalpones: LoteGalpon[];
  galponNamesById: Map<string, string>;
  actividades: ActividadLote[];
  vacunas: VacunaLote[];
  syncQueue: SyncQueueItem[];
  today: string;
}): LoteResumen {
  const totals = sumLoteTotals(input.registros, input.consumos);
  const machos = avesVivasMachos(input.lote, totals);
  const hembras = avesVivasHembras(input.lote, totals);
  const latestPesaje = latestPesajeForLote(input.pesajes, input.lote.LoteID);
  const pesoMachoKg = (latestPesaje?.PesoPromedioMachos ?? 0) / 1000;
  const pesoHembraKg = (latestPesaje?.PesoPromedioHembras ?? 0) / 1000;
  const pesoEstimado = pesoVivoEstimadoKg(machos, hembras, pesoMachoKg, pesoHembraKg);
  const galpones = input.loteGalpones
    .filter((item) => item.LoteID === input.lote.LoteID && item.Estado === 'ACTIVO')
    .map((item) => input.galponNamesById.get(item.GalponID) ?? item.GalponID);

  return {
    LoteID: input.lote.LoteID,
    CodigoLote: input.lote.CodigoLote,
    DiaLote: getDiaLote(input.lote.FechaLlegada, input.today),
    Galpones: galpones,
    MachosVivos: machos,
    HembrasVivas: hembras,
    AvesVivasTotal: machos + hembras,
    MortalidadAcumulada: mortalidadAcumulada(input.lote, totals),
    ConsumoAcumuladoKg: totals.consumoKg,
    PesoPromedioMachoKg: pesoMachoKg,
    PesoPromedioHembraKg: pesoHembraKg,
    PesoPromedioGeneralKg: (latestPesaje?.PesoPromedioGeneral ?? 0) / 1000,
    ConversionAlimenticia: conversionAlimenticia(totals.consumoKg, pesoEstimado),
    PendientesHoy: input.actividades.filter(
      (actividad) =>
        actividad.LoteID === input.lote.LoteID &&
        actividad.FechaProgramada <= input.today &&
        (actividad.Estado === 'PENDIENTE' || actividad.Estado === 'VENCIDA'),
    ).length,
    VacunasPendientes: input.vacunas.filter(
      (vacuna) => vacuna.LoteID === input.lote.LoteID && vacuna.FechaProgramada <= input.today && vacuna.Estado === 'PENDIENTE',
    ).length,
    SyncPendiente: input.syncQueue.filter((item) => item.EstadoSync === 'PENDIENTE' || item.EstadoSync === 'ERROR').length,
  };
}

export function salidaPesoPromedio(salida: Pick<SalidaPollo, 'PesoTotalKg' | 'CantidadAves'>): number {
  if (salida.CantidadAves <= 0) return 0;
  return salida.PesoTotalKg / salida.CantidadAves;
}
