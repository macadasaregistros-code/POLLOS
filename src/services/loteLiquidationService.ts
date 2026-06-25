import { construirCierreLote } from './adminAnalyticsService';
import { db } from './localDbService';
import { enqueueSync } from './syncService';
import { createId } from '../lib/id';
import { getDiaLote, todayISO } from '../lib/date';
import type { CierreLote, CostoLote, Galpon, Lote, LoteGalpon, SalidaPollo, Usuario } from '../types/entities';

export const LIQUIDATION_COST_PREFIX = 'liq_';

export interface LiquidationFeedCostInput {
  tipoAlimentoId: string;
  nombre: string;
  bultos: number;
  kg: number;
  precioBulto: number;
}

export interface LiquidationMaterialCostInput {
  tipoMaterial: 'CISCO' | 'GAS';
  cantidad: number;
  unidad: string;
  precioUnitario: number;
}

export interface LiquidationExtraCostInput {
  key: string;
  categoria: CostoLote['CategoriaCosto'];
  concepto: string;
  valorTotal: number;
}

export interface LiquidationSalidaInput {
  salidaId: string;
  pesoCanalKg: number;
  precioKg: number;
  facturaVentaId: string;
  observaciones: string;
}

export interface LiquidationDraftInput {
  loteId: string;
  fechaCierre: string;
  feedCosts: LiquidationFeedCostInput[];
  materialCosts: LiquidationMaterialCostInput[];
  extraCosts: LiquidationExtraCostInput[];
  salidas: LiquidationSalidaInput[];
}

interface CostCandidate {
  id: string;
  row?: CostoLote;
}

export function makeLiquidationCostId(loteId: string, key: string): string {
  return `${LIQUIDATION_COST_PREFIX}${sanitizeCostKey(loteId)}_${sanitizeCostKey(key)}`;
}

export function isLiquidationGeneratedCost(costo: Pick<CostoLote, 'CostoID' | 'Observacion'>): boolean {
  return costo.CostoID.startsWith(LIQUIDATION_COST_PREFIX) || costo.Observacion.includes('Liquidacion lote');
}

export async function guardarDatosLiquidacionLote(input: LiquidationDraftInput, user: Usuario): Promise<void> {
  const lote = await db.lotes.get(input.loteId);
  if (!lote) throw new Error('Lote no encontrado.');

  const [existingCosts, currentSalidas] = await Promise.all([
    db.costosLote.where('LoteID').equals(input.loteId).toArray(),
    db.salidasPollo.where('LoteID').equals(input.loteId).toArray(),
  ]);
  const existingCostsById = new Map(existingCosts.map((costo) => [costo.CostoID, costo]));
  const salidasById = new Map(currentSalidas.map((salida) => [salida.SalidaID, salida]));
  const costCandidates = buildCostCandidates(input);
  const salidaUpdates = input.salidas
    .map((salidaInput) => {
      const current = salidasById.get(salidaInput.salidaId);
      if (!current) return undefined;
      const pesoCanalKg = normalizeNumber(salidaInput.pesoCanalKg);
      const precioKg = normalizeNumber(salidaInput.precioKg);
      const next: SalidaPollo = {
        ...current,
        PesoTotalKg: pesoCanalKg,
        PesoPromedioKg: current.CantidadAves > 0 ? pesoCanalKg / current.CantidadAves : 0,
        PrecioKg: precioKg,
        ValorTotal: pesoCanalKg * precioKg,
        FacturaVentaID: salidaInput.facturaVentaId.trim(),
        EstadoAdministrativo: getSalidaAdminState(current, pesoCanalKg, precioKg, salidaInput.facturaVentaId),
        Observaciones: salidaInput.observaciones.trim(),
        EstadoSync: 'PENDIENTE',
      };
      return next;
    })
    .filter((salida): salida is SalidaPollo => Boolean(salida));

  await db.transaction('rw', [db.costosLote, db.salidasPollo, db.syncQueue], async () => {
    for (const salida of salidaUpdates) {
      await db.salidasPollo.put(salida);
      await enqueueSync('SalidasPollo', salida.SalidaID, 'UPDATE', salida);
    }

    for (const candidate of costCandidates) {
      const existing = existingCostsById.get(candidate.id);
      if (candidate.row) {
        await db.costosLote.put(candidate.row);
        await enqueueSync('CostosLote', candidate.row.CostoID, existing ? 'UPDATE' : 'CREATE', candidate.row);
      } else if (existing) {
        await db.costosLote.delete(candidate.id);
        await enqueueSync('CostosLote', candidate.id, 'DELETE', existing);
      }
    }
  });
}

export async function liquidarYCerrarLote(input: LiquidationDraftInput, user: Usuario): Promise<CierreLote> {
  await guardarDatosLiquidacionLote(input, user);

  const lote = await db.lotes.get(input.loteId);
  if (!lote) throw new Error('Lote no encontrado.');

  validateReadyToClose(input);

  const [registros, pesajes, costos, salidas, existingCierre, assignments, galpones] = await Promise.all([
    db.registroDiarioLote.where('LoteID').equals(input.loteId).toArray(),
    db.pesajes.where('LoteID').equals(input.loteId).toArray(),
    db.costosLote.where('LoteID').equals(input.loteId).toArray(),
    db.salidasPollo.where('LoteID').equals(input.loteId).toArray(),
    db.cierreLote.where('LoteID').equals(input.loteId).first(),
    db.loteGalpones.where('LoteID').equals(input.loteId).toArray(),
    db.galpones.toArray(),
  ]);
  const incompleteSales = salidas.filter((salida) => salida.TipoSalida === 'VENTA' && (salida.PesoTotalKg <= 0 || salida.PrecioKg <= 0 || salida.ValorTotal <= 0));
  if (incompleteSales.length > 0) {
    throw new Error(`Faltan peso en canal o precio en ${incompleteSales.length} salida(s) a matadero.`);
  }

  const closedLote: Lote = { ...lote, EstadoLote: 'CERRADO' };
  const cierre: CierreLote = {
    ...construirCierreLote({ lote: closedLote, registros, pesajes, costos, salidas }),
    CierreLoteID: existingCierre?.CierreLoteID ?? createId('cierre_lote'),
    FechaCierre: input.fechaCierre || todayISO(),
    EstadoCierre: 'LIQUIDADO',
  };
  const closingAssignments = buildClosingAssignments(assignments, cierre.FechaCierre, lote);
  const closingGalpones = buildClosingGalpones(galpones, closingAssignments);

  await db.transaction('rw', [db.lotes, db.loteGalpones, db.galpones, db.cierreLote, db.syncQueue], async () => {
    await db.lotes.put(closedLote);
    await enqueueSync('Lotes', closedLote.LoteID, 'UPDATE', closedLote);
    await db.cierreLote.put(cierre);
    await enqueueSync('CierreLote', cierre.CierreLoteID, existingCierre ? 'UPDATE' : 'CREATE', cierre);

    for (const assignment of closingAssignments) {
      await db.loteGalpones.put(assignment);
      await enqueueSync('LoteGalpones', assignment.LoteGalponID, 'UPDATE', assignment);
    }

    for (const galpon of closingGalpones) {
      await db.galpones.put(galpon);
      await enqueueSync('Galpones', galpon.GalponID, 'UPDATE', galpon);
    }
  });

  return cierre;
}

function buildCostCandidates(input: LiquidationDraftInput): CostCandidate[] {
  const fecha = input.fechaCierre || todayISO();
  const feedCandidates = input.feedCosts.map((item) => {
    const id = makeLiquidationCostId(input.loteId, `alimento_${item.tipoAlimentoId}`);
    const bultos = normalizeNumber(item.bultos);
    const precioBulto = normalizeNumber(item.precioBulto);
    const shouldSave = bultos > 0 || precioBulto > 0;
    return {
      id,
      row: shouldSave
        ? buildCostoRow({
          id,
          fecha,
          loteId: input.loteId,
          categoria: 'ALIMENTO',
          concepto: `Alimento ${item.nombre || item.tipoAlimentoId}`,
          cantidad: bultos,
          unidad: 'BULTOS',
          valorUnitario: precioBulto,
          observacion: `Liquidacion lote - ${normalizeNumber(item.kg)} kg consumidos`,
        })
        : undefined,
    };
  });

  const materialCandidates = input.materialCosts.map((item) => {
    const id = makeLiquidationCostId(input.loteId, `material_${item.tipoMaterial}`);
    const cantidad = normalizeNumber(item.cantidad);
    const precioUnitario = normalizeNumber(item.precioUnitario);
    const shouldSave = cantidad > 0 || precioUnitario > 0;
    return {
      id,
      row: shouldSave
        ? buildCostoRow({
          id,
          fecha,
          loteId: input.loteId,
          categoria: item.tipoMaterial,
          concepto: item.tipoMaterial === 'CISCO' ? 'Cisco' : 'Gas',
          cantidad,
          unidad: item.unidad || (item.tipoMaterial === 'CISCO' ? 'PACAS' : 'CILINDROS'),
          valorUnitario: precioUnitario,
          observacion: 'Liquidacion lote - material',
        })
        : undefined,
    };
  });

  const extraCandidates = input.extraCosts.map((item) => {
    const id = makeLiquidationCostId(input.loteId, `extra_${item.key}`);
    const valorTotal = normalizeNumber(item.valorTotal);
    const shouldSave = valorTotal > 0;
    return {
      id,
      row: shouldSave
        ? buildCostoRow({
          id,
          fecha,
          loteId: input.loteId,
          categoria: item.categoria,
          concepto: item.concepto,
          cantidad: 1,
          unidad: 'TOTAL',
          valorUnitario: valorTotal,
          observacion: 'Liquidacion lote - costo adicional',
        })
        : undefined,
    };
  });

  return [...feedCandidates, ...materialCandidates, ...extraCandidates];
}

function buildCostoRow(input: {
  id: string;
  fecha: string;
  loteId: string;
  categoria: CostoLote['CategoriaCosto'];
  concepto: string;
  cantidad: number;
  unidad: string;
  valorUnitario: number;
  observacion: string;
}): CostoLote {
  const cantidad = normalizeNumber(input.cantidad);
  const valorUnitario = normalizeNumber(input.valorUnitario);
  return {
    CostoID: input.id,
    Fecha: input.fecha,
    LoteID: input.loteId,
    CategoriaCosto: input.categoria,
    Concepto: input.concepto,
    Cantidad: cantidad,
    Unidad: input.unidad,
    ValorUnitario: valorUnitario,
    ValorTotal: cantidad * valorUnitario,
    ProveedorID: '',
    FacturaID: '',
    Estado: valorUnitario > 0 ? 'COMPLETO' : 'PENDIENTE_PRECIO',
    Observacion: input.observacion,
  };
}

function getSalidaAdminState(salida: SalidaPollo, pesoCanalKg: number, precioKg: number, facturaVentaId: string): SalidaPollo['EstadoAdministrativo'] {
  if (salida.TipoSalida !== 'VENTA') return 'COMPLETO';
  if (pesoCanalKg <= 0 || precioKg <= 0) return 'PENDIENTE_PRECIO';
  return facturaVentaId.trim() ? 'COMPLETO' : 'PENDIENTE_FACTURA';
}

function validateReadyToClose(input: LiquidationDraftInput): void {
  const missingFoodPrices = input.feedCosts.filter((item) => normalizeNumber(item.bultos) > 0 && normalizeNumber(item.precioBulto) <= 0);
  if (missingFoodPrices.length > 0) {
    throw new Error(`Falta precio de alimento para ${missingFoodPrices.map((item) => item.nombre || item.tipoAlimentoId).join(', ')}.`);
  }

  const missingMaterialPrices = input.materialCosts.filter((item) => normalizeNumber(item.cantidad) > 0 && normalizeNumber(item.precioUnitario) <= 0);
  if (missingMaterialPrices.length > 0) {
    throw new Error(`Falta precio de ${missingMaterialPrices.map((item) => item.tipoMaterial.toLowerCase()).join(', ')}.`);
  }
}

function buildClosingAssignments(assignments: LoteGalpon[], fechaCierre: string, lote: Lote): LoteGalpon[] {
  return assignments
    .filter((assignment) => assignment.Estado !== 'CERRADO')
    .map((assignment) => ({
      ...assignment,
      FechaFin: fechaCierre,
      DiaFin: getDiaLote(lote.FechaLlegada, fechaCierre),
      Estado: 'CERRADO' as const,
    }));
}

function buildClosingGalpones(galpones: Galpon[], closingAssignments: LoteGalpon[]): Galpon[] {
  const galponIds = new Set(closingAssignments.map((assignment) => assignment.GalponID));
  return galpones
    .filter((galpon) => galponIds.has(galpon.GalponID))
    .map((galpon) => ({
      ...galpon,
      EstadoActual: 'LIMPIEZA' as const,
    }));
}

function normalizeNumber(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function sanitizeCostKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 90) || 'item';
}
