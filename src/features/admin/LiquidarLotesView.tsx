import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, FileText, Save } from 'lucide-react';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { salidaPesoPromedio } from '../../services/calculationsService';
import { db } from '../../services/localDbService';
import {
  guardarDatosLiquidacionLote,
  isLiquidationGeneratedCost,
  liquidarYCerrarLote,
  makeLiquidationCostId,
  type LiquidationDraftInput,
} from '../../services/loteLiquidationService';
import { generarReporteLiquidacionLotePDF } from '../../services/reportsService';
import { getDiaLote, todayISO } from '../../lib/date';
import { fmtCurrency, fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type {
  CierreLote,
  CostoLote,
  EntradaAlimento,
  EntradaMaterial,
  Lote,
  MaterialLote,
  RegistroDiarioLote,
  SalidaPollo,
  TipoAlimento,
  Usuario,
} from '../../types/entities';

type LiquidationBucket = 'pendientes' | 'sinFinalizar' | 'liquidados';
type MaterialKind = 'CISCO' | 'GAS';

interface LiquidarLotesViewProps {
  user: Usuario;
  onToast: (message: string) => void;
}

interface LoteStatusRow {
  lote: Lote;
  bucket: LiquidationBucket;
  statusLabel: string;
  cierre?: CierreLote;
  bultos: number;
  kgCanal: number;
  ingresos: number;
  costos: number;
  utilidad: number;
}

interface FeedUsageRow {
  tipoAlimentoId: string;
  nombre: string;
  bultos: number;
  kg: number;
  defaultPrice: number;
}

interface MaterialUsageRow {
  tipoMaterial: MaterialKind;
  label: string;
  cantidad: number;
  unidad: string;
  defaultPrice: number;
}

interface LiquidationFormState {
  fechaCierre: string;
  feedPrices: Record<string, string>;
  materialQuantities: Record<MaterialKind, string>;
  materialUnits: Record<MaterialKind, string>;
  materialPrices: Record<MaterialKind, string>;
  extraCosts: Record<string, string>;
  salidas: Record<string, {
    pesoCanalKg: string;
    precioKg: string;
    facturaVentaId: string;
    observaciones: string;
  }>;
}

const BUCKETS: Array<{ key: LiquidationBucket; label: string }> = [
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'sinFinalizar', label: 'Sin finalizar' },
  { key: 'liquidados', label: 'Liquidados' },
];

const MATERIAL_KINDS: MaterialKind[] = ['CISCO', 'GAS'];

const EXTRA_COSTS: Array<{ key: string; label: string; categoria: CostoLote['CategoriaCosto']; concepto: string }> = [
  { key: 'pollito', label: 'Pollito', categoria: 'POLLITO', concepto: 'Pollito' },
  { key: 'vacunas', label: 'Vacunas', categoria: 'VACUNA', concepto: 'Vacunas' },
  { key: 'medicamentos', label: 'Medicamentos', categoria: 'MEDICAMENTO', concepto: 'Medicamentos' },
  { key: 'transporte', label: 'Transporte', categoria: 'TRANSPORTE', concepto: 'Transporte' },
  { key: 'mano_obra', label: 'Mano obra', categoria: 'MANO_OBRA', concepto: 'Mano de obra' },
  { key: 'otros', label: 'Otros', categoria: 'OTRO', concepto: 'Otros costos' },
];

const EMPTY_FORM: LiquidationFormState = {
  fechaCierre: todayISO(),
  feedPrices: {},
  materialQuantities: { CISCO: '0', GAS: '0' },
  materialUnits: { CISCO: 'PACAS', GAS: 'CILINDROS' },
  materialPrices: { CISCO: '0', GAS: '0' },
  extraCosts: {},
  salidas: {},
};

export function LiquidarLotesView({ user, onToast }: LiquidarLotesViewProps) {
  const today = todayISO();
  const lotes = useLiveQuery(() => db.lotes.toArray(), []) ?? [];
  const registros = useLiveQuery(() => db.registroDiarioLote.toArray(), []) ?? [];
  const tipos = useLiveQuery(() => db.tiposAlimento.toArray(), []) ?? [];
  const salidas = useLiveQuery(() => db.salidasPollo.toArray(), []) ?? [];
  const costos = useLiveQuery(() => db.costosLote.toArray(), []) ?? [];
  const cierres = useLiveQuery(() => db.cierreLote.toArray(), []) ?? [];
  const materiales = useLiveQuery(() => db.materialesLote.toArray(), []) ?? [];
  const entradasAlimento = useLiveQuery(() => db.entradasAlimento.toArray(), []) ?? [];
  const entradasMaterial = useLiveQuery(() => db.entradasMaterial.toArray(), []) ?? [];
  const [selectedBucket, setSelectedBucket] = useState<LiquidationBucket>('pendientes');
  const [selectedLoteId, setSelectedLoteId] = useState('');
  const [form, setForm] = useState<LiquidationFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(
    () => buildLoteStatusRows({ lotes, registros, salidas, costos, cierres, today }),
    [cierres, costos, lotes, registros, salidas, today],
  );
  const bucketRows = useMemo(() => rows.filter((row) => row.bucket === selectedBucket), [rows, selectedBucket]);
  const selectedRow = rows.find((row) => row.lote.LoteID === selectedLoteId) ?? bucketRows[0] ?? rows[0];
  const selectedLote = selectedRow?.lote;
  const selectedRegistros = useMemo(
    () => registros.filter((registro) => registro.LoteID === selectedLote?.LoteID),
    [registros, selectedLote?.LoteID],
  );
  const selectedSalidas = useMemo(
    () => salidas.filter((salida) => salida.LoteID === selectedLote?.LoteID).sort((left, right) => left.Fecha.localeCompare(right.Fecha)),
    [salidas, selectedLote?.LoteID],
  );
  const selectedCostos = useMemo(
    () => costos.filter((costo) => costo.LoteID === selectedLote?.LoteID),
    [costos, selectedLote?.LoteID],
  );
  const feedUsage = useMemo(
    () => buildFeedUsage(selectedLote?.LoteID ?? '', selectedRegistros, tipos, selectedCostos, entradasAlimento),
    [entradasAlimento, selectedCostos, selectedLote?.LoteID, selectedRegistros, tipos],
  );
  const materialUsage = useMemo(
    () => buildMaterialUsage(selectedLote?.LoteID ?? '', materiales, selectedCostos, entradasMaterial),
    [entradasMaterial, materiales, selectedCostos, selectedLote?.LoteID],
  );
  const formDefaults = useMemo(
    () => selectedLote
      ? buildFormDefaults(selectedLote, feedUsage, materialUsage, selectedSalidas, selectedCostos, today)
      : EMPTY_FORM,
    [feedUsage, materialUsage, selectedCostos, selectedLote, selectedSalidas, today],
  );
  const draftInput = useMemo(
    () => selectedLote ? buildDraftInput(selectedLote, form, feedUsage, materialUsage, selectedSalidas) : undefined,
    [feedUsage, form, materialUsage, selectedLote, selectedSalidas],
  );
  const preview = useMemo(
    () => draftInput ? buildLiquidationPreview(draftInput, selectedCostos, selectedRegistros, selectedSalidas, selectedLote?.CantidadInicialTotal ?? 0) : undefined,
    [draftInput, selectedCostos, selectedLote?.CantidadInicialTotal, selectedRegistros, selectedSalidas],
  );

  useEffect(() => {
    if (selectedLoteId && rows.some((row) => row.lote.LoteID === selectedLoteId)) return;
    setSelectedLoteId(bucketRows[0]?.lote.LoteID ?? rows[0]?.lote.LoteID ?? '');
  }, [bucketRows, rows, selectedLoteId]);

  useEffect(() => {
    setForm(formDefaults);
  }, [formDefaults]);

  function handleBucketChange(bucket: LiquidationBucket) {
    setSelectedBucket(bucket);
    const next = rows.find((row) => row.bucket === bucket) ?? rows[0];
    setSelectedLoteId(next?.lote.LoteID ?? '');
  }

  function updateFeedPrice(tipoAlimentoId: string, value: string) {
    setForm((current) => ({ ...current, feedPrices: { ...current.feedPrices, [tipoAlimentoId]: value } }));
  }

  function updateMaterial(tipoMaterial: MaterialKind, field: 'quantity' | 'unit' | 'price', value: string) {
    setForm((current) => {
      if (field === 'quantity') return { ...current, materialQuantities: { ...current.materialQuantities, [tipoMaterial]: value } };
      if (field === 'unit') return { ...current, materialUnits: { ...current.materialUnits, [tipoMaterial]: value } };
      return { ...current, materialPrices: { ...current.materialPrices, [tipoMaterial]: value } };
    });
  }

  function updateExtraCost(key: string, value: string) {
    setForm((current) => ({ ...current, extraCosts: { ...current.extraCosts, [key]: value } }));
  }

  function updateSalida(salidaId: string, field: keyof LiquidationFormState['salidas'][string], value: string) {
    setForm((current) => ({
      ...current,
      salidas: {
        ...current.salidas,
        [salidaId]: {
          ...(current.salidas[salidaId] ?? { pesoCanalKg: '0', precioKg: '0', facturaVentaId: '', observaciones: '' }),
          [field]: value,
        },
      },
    }));
  }

  async function handleSave(close: boolean) {
    if (!draftInput) return;
    setSaving(true);
    try {
      if (close) {
        await liquidarYCerrarLote(draftInput, user);
        onToast('Lote liquidado y cerrado.');
      } else {
        await guardarDatosLiquidacionLote(draftInput, user);
        onToast('Datos de liquidacion guardados.');
      }
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'No se pudo guardar la liquidacion.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReport() {
    if (!selectedLote || !draftInput) return;
    setSaving(true);
    try {
      await guardarDatosLiquidacionLote(draftInput, user);
      const reporte = await generarReporteLiquidacionLotePDF(selectedLote, user);
      window.open(reporte.URLArchivo, '_blank', 'noopener,noreferrer');
      onToast('Reporte de liquidacion generado.');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'No se pudo generar el reporte.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="liquidation-view">
      <section className="liquidation-buckets" role="group" aria-label="Estados de liquidacion">
        {BUCKETS.map((bucket) => {
          const count = rows.filter((row) => row.bucket === bucket.key).length;
          return (
            <button
              className={selectedBucket === bucket.key ? 'is-active' : ''}
              type="button"
              key={bucket.key}
              onClick={() => handleBucketChange(bucket.key)}
            >
              <span>{bucket.label}</span>
              <strong>{fmtNumber(count)}</strong>
            </button>
          );
        })}
      </section>

      <section className="liquidation-layout">
        <aside className="liquidation-lote-list" aria-label="Lotes">
          {(bucketRows.length ? bucketRows : rows).map((row) => (
            <button
              className={selectedRow?.lote.LoteID === row.lote.LoteID ? 'liquidation-lote-card is-active' : 'liquidation-lote-card'}
              type="button"
              key={row.lote.LoteID}
              onClick={() => setSelectedLoteId(row.lote.LoteID)}
            >
              <span>{row.statusLabel}</span>
              <strong>{row.lote.CodigoLote}</strong>
              <small>Dia {getDiaLote(row.lote.FechaLlegada, today)} - {row.lote.EstadoLote}</small>
              <em>{fmtCurrency(row.utilidad)}</em>
            </button>
          ))}
        </aside>

        {selectedLote && selectedRow && preview ? (
          <section className="liquidation-detail">
            <MobileCard className="liquidation-summary-card" title={`Lote ${selectedLote.CodigoLote}`} subtitle={selectedRow.statusLabel}>
              <section className="lote-history-identity" aria-label="Lote seleccionado">
                <div>
                  <span>Lote seleccionado</span>
                  <strong>{selectedLote.CodigoLote}</strong>
                </div>
                <div className="lote-history-identity__meta">
                  <span>Inicio {selectedLote.FechaLlegada}</span>
                  <span>Cierre {form.fechaCierre || today}</span>
                  <span>{selectedRow.cierre ? `Liquidado ${selectedRow.cierre.FechaCierre}` : selectedRow.statusLabel}</span>
                </div>
              </section>

              <section className="stats-grid stats-grid--wide liquidation-stats">
                <StatCard label="Aves iniciales" value={fmtNumber(selectedLote.CantidadInicialTotal)} />
                <StatCard label="Aves salida" value={fmtNumber(preview.avesSalida)} />
                <StatCard label="Muertos" value={`${fmtNumber(preview.muertos)} (${fmtPercent(preview.mortalidad)})`} />
                <StatCard label="Alimento" value={`${fmtNumber(preview.bultos, 1)} bultos`} />
                <StatCard label="Kg canal" value={fmtKg(preview.kgCanal)} />
                <StatCard label="Ingresos" value={fmtCurrency(preview.ingresos)} />
                <StatCard label="Costos" value={fmtCurrency(preview.costos)} />
                <StatCard label="Utilidad" value={fmtCurrency(preview.utilidad)} tone={preview.utilidad >= 0 ? 'good' : 'warn'} />
                <StatCard label="Conversion" value={fmtNumber(preview.conversion, 2)} />
              </section>
            </MobileCard>

            <section className="liquidation-panel">
              <header>
                <div>
                  <span>Costos</span>
                  <h2>Alimento por tipo</h2>
                </div>
                <strong>{fmtCurrency(preview.feedCost)}</strong>
              </header>
              <div className="liquidation-feed-grid">
                {feedUsage.map((item) => {
                  const price = toNumber(form.feedPrices[item.tipoAlimentoId]);
                  return (
                    <article key={item.tipoAlimentoId} className="liquidation-feed-row">
                      <div>
                        <strong>{item.nombre}</strong>
                        <span>{fmtNumber(item.bultos, 1)} bultos - {fmtKg(item.kg)}</span>
                      </div>
                      <label className="liquidation-input">
                        <span>Precio bulto</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={form.feedPrices[item.tipoAlimentoId] ?? '0'}
                          onChange={(event) => updateFeedPrice(item.tipoAlimentoId, event.target.value)}
                        />
                      </label>
                      <strong>{fmtCurrency(item.bultos * price)}</strong>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="liquidation-panel">
              <header>
                <div>
                  <span>Costos</span>
                  <h2>Cisco y gas</h2>
                </div>
                <strong>{fmtCurrency(preview.materialCost)}</strong>
              </header>
              <div className="liquidation-material-grid">
                {materialUsage.map((item) => (
                  <article key={item.tipoMaterial} className="liquidation-material-row">
                    <strong>{item.label}</strong>
                    <label className="liquidation-input">
                      <span>Cantidad</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={form.materialQuantities[item.tipoMaterial] ?? '0'}
                        onChange={(event) => updateMaterial(item.tipoMaterial, 'quantity', event.target.value)}
                      />
                    </label>
                    <label className="liquidation-input">
                      <span>Unidad</span>
                      <input
                        value={form.materialUnits[item.tipoMaterial] ?? item.unidad}
                        onChange={(event) => updateMaterial(item.tipoMaterial, 'unit', event.target.value)}
                      />
                    </label>
                    <label className="liquidation-input">
                      <span>Precio</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={form.materialPrices[item.tipoMaterial] ?? '0'}
                        onChange={(event) => updateMaterial(item.tipoMaterial, 'price', event.target.value)}
                      />
                    </label>
                    <strong>{fmtCurrency(toNumber(form.materialQuantities[item.tipoMaterial]) * toNumber(form.materialPrices[item.tipoMaterial]))}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="liquidation-panel">
              <header>
                <div>
                  <span>Matadero</span>
                  <h2>Salidas del lote</h2>
                </div>
                <strong>{fmtCurrency(preview.ingresos)}</strong>
              </header>
              {selectedSalidas.length ? (
                <div className="liquidation-output-list">
                  {selectedSalidas.map((salida) => {
                    const draft = form.salidas[salida.SalidaID] ?? { pesoCanalKg: '0', precioKg: '0', facturaVentaId: '', observaciones: '' };
                    const rowTotal = toNumber(draft.pesoCanalKg) * toNumber(draft.precioKg);
                    return (
                      <article key={salida.SalidaID} className="liquidation-output-row">
                        <div className="liquidation-output-row__main">
                          <strong>{salida.Fecha}</strong>
                          <span>{fmtNumber(salida.CantidadAves)} aves - {salida.Sexo} - {salida.TipoSalida}</span>
                          <small>Promedio {fmtKg(salidaPesoPromedio({ PesoTotalKg: toNumber(draft.pesoCanalKg), CantidadAves: salida.CantidadAves }), 3)}</small>
                        </div>
                        <label className="liquidation-input">
                          <span>Kg canal</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={draft.pesoCanalKg}
                            onChange={(event) => updateSalida(salida.SalidaID, 'pesoCanalKg', event.target.value)}
                          />
                        </label>
                        <label className="liquidation-input">
                          <span>Precio kg</span>
                          <input
                            type="number"
                            min="0"
                            inputMode="decimal"
                            value={draft.precioKg}
                            onChange={(event) => updateSalida(salida.SalidaID, 'precioKg', event.target.value)}
                          />
                        </label>
                        <label className="liquidation-input">
                          <span>Factura</span>
                          <input value={draft.facturaVentaId} onChange={(event) => updateSalida(salida.SalidaID, 'facturaVentaId', event.target.value)} />
                        </label>
                        <strong>{fmtCurrency(rowTotal)}</strong>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">Este lote todavia no tiene salidas a matadero.</p>
              )}
            </section>

            <section className="liquidation-panel">
              <header>
                <div>
                  <span>Costos</span>
                  <h2>Adicionales</h2>
                </div>
                <strong>{fmtCurrency(preview.extraCost)}</strong>
              </header>
              <div className="liquidation-extra-grid">
                {EXTRA_COSTS.map((item) => (
                  <label className="liquidation-input" key={item.key}>
                    <span>{item.label}</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={form.extraCosts[item.key] ?? '0'}
                      onChange={(event) => updateExtraCost(item.key, event.target.value)}
                    />
                  </label>
                ))}
              </div>
              {preview.existingOtherCost > 0 && <p className="liquidation-note">Costos ya guardados fuera de esta pestana: {fmtCurrency(preview.existingOtherCost)}</p>}
            </section>

            <section className="liquidation-actions">
              <label className="liquidation-input liquidation-date-input">
                <span>Fecha cierre</span>
                <input type="date" value={form.fechaCierre} onChange={(event) => setForm((current) => ({ ...current, fechaCierre: event.target.value }))} />
              </label>
              <button type="button" onClick={() => handleSave(false)} disabled={saving}>
                <Save size={18} />
                Guardar datos
              </button>
              <button className="primary-action" type="button" onClick={() => handleSave(true)} disabled={saving}>
                <CheckCircle2 size={19} />
                Liquidar y cerrar
              </button>
              <button type="button" onClick={handleReport} disabled={saving}>
                <FileText size={18} />
                Reporte
              </button>
            </section>

            <HojaManejoLiquidacion lote={selectedLote} registros={selectedRegistros} tipos={tipos} />
          </section>
        ) : (
          <MobileCard title="Liquidar lotes">
            <p className="empty-state">Todavia no hay lotes para liquidar.</p>
          </MobileCard>
        )}
      </section>
    </section>
  );
}

function buildLoteStatusRows(input: {
  lotes: Lote[];
  registros: RegistroDiarioLote[];
  salidas: SalidaPollo[];
  costos: CostoLote[];
  cierres: CierreLote[];
  today: string;
}): LoteStatusRow[] {
  const cierreByLote = new Map<string, CierreLote>();
  input.cierres
    .slice()
    .sort((left, right) => right.FechaCierre.localeCompare(left.FechaCierre))
    .forEach((cierre) => {
      if (!cierreByLote.has(cierre.LoteID)) cierreByLote.set(cierre.LoteID, cierre);
    });

  return input.lotes
    .map((lote) => {
      const cierre = cierreByLote.get(lote.LoteID);
      const loteRegistros = input.registros.filter((registro) => registro.LoteID === lote.LoteID);
      const loteSalidas = input.salidas.filter((salida) => salida.LoteID === lote.LoteID);
      const loteCostos = input.costos.filter((costo) => costo.LoteID === lote.LoteID);
      const bultos = loteRegistros.reduce((sum, registro) => sum + registro.BultosConsumidos, 0);
      const kgCanal = loteSalidas.reduce((sum, salida) => sum + salida.PesoTotalKg, 0);
      const ingresos = loteSalidas.reduce((sum, salida) => sum + salida.ValorTotal, 0);
      const costos = loteCostos.reduce((sum, costo) => sum + costo.ValorTotal, 0);
      const bucket: LiquidationBucket = cierre ? 'liquidados' : lote.EstadoLote === 'ACTIVO' ? 'sinFinalizar' : 'pendientes';
      return {
        lote,
        bucket,
        statusLabel: getBucketLabel(bucket),
        cierre,
        bultos,
        kgCanal,
        ingresos,
        costos,
        utilidad: ingresos - costos,
      };
    })
    .sort((left, right) => {
      const bucketOrder: Record<LiquidationBucket, number> = { pendientes: 0, sinFinalizar: 1, liquidados: 2 };
      return bucketOrder[left.bucket] - bucketOrder[right.bucket] || right.lote.FechaLlegada.localeCompare(left.lote.FechaLlegada);
    });
}

function buildFeedUsage(
  loteId: string,
  registros: RegistroDiarioLote[],
  tipos: TipoAlimento[],
  costos: CostoLote[],
  entradasAlimento: EntradaAlimento[],
): FeedUsageRow[] {
  if (!loteId) return [];
  const usageByType = new Map<string, { bultos: number; kg: number }>();
  for (const registro of registros) {
    const current = usageByType.get(registro.TipoAlimentoID) ?? { bultos: 0, kg: 0 };
    usageByType.set(registro.TipoAlimentoID, {
      bultos: current.bultos + registro.BultosConsumidos,
      kg: current.kg + registro.KgConsumidos,
    });
  }
  const tiposById = new Map(tipos.map((tipo) => [tipo.TipoAlimentoID, tipo]));
  const ids = usageByType.size ? [...usageByType.keys()] : tipos.filter((tipo) => tipo.Activo).map((tipo) => tipo.TipoAlimentoID);
  return ids
    .map((tipoAlimentoId) => {
      const tipo = tiposById.get(tipoAlimentoId);
      const usage = usageByType.get(tipoAlimentoId) ?? { bultos: 0, kg: 0 };
      const existingCost = costos.find((costo) => costo.CostoID === makeLiquidationCostId(loteId, `alimento_${tipoAlimentoId}`));
      return {
        tipoAlimentoId,
        nombre: tipo?.Nombre ?? tipoAlimentoId,
        bultos: usage.bultos,
        kg: usage.kg,
        defaultPrice: existingCost?.ValorUnitario ?? getLatestFoodPrice(tipoAlimentoId, entradasAlimento),
      };
    })
    .sort((left, right) => {
      const leftType = tiposById.get(left.tipoAlimentoId);
      const rightType = tiposById.get(right.tipoAlimentoId);
      return (leftType?.EtapaRecomendadaDesdeDia ?? 999) - (rightType?.EtapaRecomendadaDesdeDia ?? 999) || left.nombre.localeCompare(right.nombre);
    });
}

function buildMaterialUsage(
  loteId: string,
  materiales: MaterialLote[],
  costos: CostoLote[],
  entradasMaterial: EntradaMaterial[],
): MaterialUsageRow[] {
  return MATERIAL_KINDS.map((tipoMaterial) => {
    const loteMateriales = materiales.filter((material) => material.LoteID === loteId && material.TipoMaterial === tipoMaterial);
    const existingCost = costos.find((costo) => costo.CostoID === makeLiquidationCostId(loteId, `material_${tipoMaterial}`));
    const defaultUnit = tipoMaterial === 'CISCO' ? 'PACAS' : 'CILINDROS';
    return {
      tipoMaterial,
      label: tipoMaterial === 'CISCO' ? 'Cisco' : 'Gas',
      cantidad: existingCost?.Cantidad ?? loteMateriales.reduce((sum, material) => sum + material.Cantidad, 0),
      unidad: existingCost?.Unidad ?? loteMateriales.find((material) => material.Unidad)?.Unidad ?? defaultUnit,
      defaultPrice: existingCost?.ValorUnitario ?? getLatestMaterialPrice(tipoMaterial, entradasMaterial),
    };
  });
}

function buildFormDefaults(
  lote: Lote,
  feedUsage: FeedUsageRow[],
  materialUsage: MaterialUsageRow[],
  salidas: SalidaPollo[],
  costos: CostoLote[],
  today: string,
): LiquidationFormState {
  const feedPrices = Object.fromEntries(feedUsage.map((item) => [item.tipoAlimentoId, String(item.defaultPrice || 0)]));
  const materialQuantities = Object.fromEntries(materialUsage.map((item) => [item.tipoMaterial, String(item.cantidad || 0)])) as Record<MaterialKind, string>;
  const materialUnits = Object.fromEntries(materialUsage.map((item) => [item.tipoMaterial, item.unidad || (item.tipoMaterial === 'CISCO' ? 'PACAS' : 'CILINDROS')])) as Record<MaterialKind, string>;
  const materialPrices = Object.fromEntries(materialUsage.map((item) => [item.tipoMaterial, String(item.defaultPrice || 0)])) as Record<MaterialKind, string>;
  const extraCosts = Object.fromEntries(
    EXTRA_COSTS.map((item) => {
      const existing = costos.find((costo) => costo.CostoID === makeLiquidationCostId(lote.LoteID, `extra_${item.key}`));
      return [item.key, String(existing?.ValorTotal ?? 0)];
    }),
  );
  const salidaDefaults = Object.fromEntries(
    salidas.map((salida) => [
      salida.SalidaID,
      {
        pesoCanalKg: String(salida.PesoTotalKg || 0),
        precioKg: String(salida.PrecioKg || 0),
        facturaVentaId: salida.FacturaVentaID,
        observaciones: salida.Observaciones,
      },
    ]),
  );

  return {
    fechaCierre: lote.EstadoLote === 'ACTIVO' ? today : salidas.at(-1)?.Fecha ?? today,
    feedPrices,
    materialQuantities,
    materialUnits,
    materialPrices,
    extraCosts,
    salidas: salidaDefaults,
  };
}

function buildDraftInput(
  lote: Lote,
  form: LiquidationFormState,
  feedUsage: FeedUsageRow[],
  materialUsage: MaterialUsageRow[],
  salidas: SalidaPollo[],
): LiquidationDraftInput {
  return {
    loteId: lote.LoteID,
    fechaCierre: form.fechaCierre || todayISO(),
    feedCosts: feedUsage.map((item) => ({
      tipoAlimentoId: item.tipoAlimentoId,
      nombre: item.nombre,
      bultos: item.bultos,
      kg: item.kg,
      precioBulto: toNumber(form.feedPrices[item.tipoAlimentoId]),
    })),
    materialCosts: materialUsage.map((item) => ({
      tipoMaterial: item.tipoMaterial,
      cantidad: toNumber(form.materialQuantities[item.tipoMaterial]),
      unidad: form.materialUnits[item.tipoMaterial] || item.unidad,
      precioUnitario: toNumber(form.materialPrices[item.tipoMaterial]),
    })),
    extraCosts: EXTRA_COSTS.map((item) => ({
      key: item.key,
      categoria: item.categoria,
      concepto: item.concepto,
      valorTotal: toNumber(form.extraCosts[item.key]),
    })),
    salidas: salidas.map((salida) => {
      const draft = form.salidas[salida.SalidaID] ?? { pesoCanalKg: '0', precioKg: '0', facturaVentaId: '', observaciones: '' };
      return {
        salidaId: salida.SalidaID,
        pesoCanalKg: toNumber(draft.pesoCanalKg),
        precioKg: toNumber(draft.precioKg),
        facturaVentaId: draft.facturaVentaId,
        observaciones: draft.observaciones,
      };
    }),
  };
}

function buildLiquidationPreview(
  input: LiquidationDraftInput,
  costos: CostoLote[],
  registros: RegistroDiarioLote[],
  salidas: SalidaPollo[],
  cantidadInicial: number,
) {
  const feedCost = input.feedCosts.reduce((sum, item) => sum + item.bultos * item.precioBulto, 0);
  const materialCost = input.materialCosts.reduce((sum, item) => sum + item.cantidad * item.precioUnitario, 0);
  const extraCost = input.extraCosts.reduce((sum, item) => sum + item.valorTotal, 0);
  const existingOtherCost = costos.filter((costo) => !isLiquidationGeneratedCost(costo)).reduce((sum, costo) => sum + costo.ValorTotal, 0);
  const ingresos = input.salidas.reduce((sum, salida) => sum + salida.pesoCanalKg * salida.precioKg, 0);
  const kgCanal = input.salidas.reduce((sum, salida) => sum + salida.pesoCanalKg, 0);
  const avesSalida = salidas.reduce((sum, salida) => sum + salida.CantidadAves, 0);
  const muertos = registros.reduce((sum, registro) => sum + registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar, 0);
  const bultos = registros.reduce((sum, registro) => sum + registro.BultosConsumidos, 0);
  const consumoKg = registros.reduce((sum, registro) => sum + registro.KgConsumidos, 0);
  const costosTotal = feedCost + materialCost + extraCost + existingOtherCost;
  return {
    feedCost,
    materialCost,
    extraCost,
    existingOtherCost,
    ingresos,
    kgCanal,
    avesSalida,
    muertos,
    mortalidad: cantidadInicial > 0 ? muertos / cantidadInicial : 0,
    bultos,
    consumoKg,
    costos: costosTotal,
    utilidad: ingresos - costosTotal,
    conversion: kgCanal > 0 ? consumoKg / kgCanal : 0,
  };
}

function HojaManejoLiquidacion({ lote, registros, tipos }: { lote: Lote; registros: RegistroDiarioLote[]; tipos: TipoAlimento[] }) {
  const tiposById = new Map(tipos.map((tipo) => [tipo.TipoAlimentoID, tipo.Nombre]));
  const ordered = registros.slice().sort((left, right) => right.Fecha.localeCompare(left.Fecha));
  return (
    <MobileCard className="liquidation-history-card" title={`Hoja de manejo ${lote.CodigoLote}`} subtitle="Historial diario del lote seleccionado">
      {ordered.length ? (
        <div className="table-wrap lote-history-table">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Dia</th>
                <th>Alimento</th>
                <th>Bultos</th>
                <th>Muertos M/H</th>
                <th>Muertos total</th>
                <th>Sacrificio</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((registro, index) => {
                const muertosTotal = registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar;
                const muertosDetalle = registro.MuertosSinClasificar > 0
                  ? `${fmtNumber(registro.MuertosMachos)} M + ${fmtNumber(registro.MuertosHembras)} H + ${fmtNumber(registro.MuertosSinClasificar)} sin clasificar`
                  : `${fmtNumber(registro.MuertosMachos)} M + ${fmtNumber(registro.MuertosHembras)} H`;
                const sacrificio = registro.SacrificadosMachos + registro.SacrificadosHembras;
                return (
                  <tr key={registro.RegistroDiarioID} className={index === 0 ? 'is-selected' : ''}>
                    <td data-label="Fecha">{registro.Fecha}</td>
                    <td data-label="Dia">{registro.DiaLote}</td>
                    <td data-label="Alimento">{tiposById.get(registro.TipoAlimentoID) ?? registro.TipoAlimentoID}</td>
                    <td data-label="Bultos">{fmtNumber(registro.BultosConsumidos, 1)}</td>
                    <td data-label="Muertos M/H">{muertosDetalle}</td>
                    <td data-label="Muertos total">{fmtNumber(muertosTotal)}</td>
                    <td data-label="Sacrificio">{fmtNumber(sacrificio)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">Este lote todavia no tiene hoja de manejo.</p>
      )}
    </MobileCard>
  );
}

function getBucketLabel(bucket: LiquidationBucket): string {
  const match = BUCKETS.find((item) => item.key === bucket);
  return match?.label ?? bucket;
}

function getLatestFoodPrice(tipoAlimentoId: string, entradas: EntradaAlimento[]): number {
  return entradas
    .filter((entrada) => entrada.TipoAlimentoID === tipoAlimentoId && entrada.PrecioUnitario > 0)
    .sort((left, right) => right.Fecha.localeCompare(left.Fecha))[0]?.PrecioUnitario ?? 0;
}

function getLatestMaterialPrice(tipoMaterial: MaterialKind, entradas: EntradaMaterial[]): number {
  return entradas
    .filter((entrada) => entrada.TipoMaterial === tipoMaterial && entrada.PrecioUnitario > 0)
    .sort((left, right) => right.Fecha.localeCompare(left.Fecha))[0]?.PrecioUnitario ?? 0;
}

function toNumber(value: string | number | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
