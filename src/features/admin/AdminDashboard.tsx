import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, ClipboardList, Home, Map as MapIcon, Package } from 'lucide-react';
import { AlertBadge } from '../../components/AlertBadge';
import { GalponMap } from '../../components/GalponMap';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { buildLoteResumen, gananciaDiaria, prediccionSalidaDias } from '../../services/calculationsService';
import { generarAlertasBasicas } from '../../services/alertsService';
import { generarReporteLotePDF } from '../../services/reportsService';
import { db } from '../../services/localDbService';
import { addDays, todayISO } from '../../lib/date';
import { fmtCurrency, fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type { Galpon, Lote, LoteResumen, Usuario } from '../../types/entities';
import type { MainView } from '../../types/navigation';
import { AdminAdvancedModules } from './AdminAdvancedModules';
import { CrearLoteForm } from './CrearLoteForm';

interface AdminDashboardProps {
  user: Usuario;
  activeView: MainView;
  onToast: (message: string) => void;
}

export function AdminDashboard({ user, activeView, onToast }: AdminDashboardProps) {
  const today = todayISO();
  const lotes = useLiveQuery(() => db.lotes.toArray(), []);
  const registros = useLiveQuery(() => db.registroDiarioLote.toArray(), []);
  const consumos = useLiveQuery(() => db.consumosAlimentoLote.toArray(), []);
  const pesajes = useLiveQuery(() => db.pesajes.toArray(), []);
  const loteGalpones = useLiveQuery(() => db.loteGalpones.toArray(), []);
  const galpones = useLiveQuery(() => db.galpones.toArray(), []);
  const actividades = useLiveQuery(() => db.actividadesLote.toArray(), []);
  const vacunas = useLiveQuery(() => db.vacunasLote.toArray(), []);
  const syncQueue = useLiveQuery(() => db.syncQueue.toArray(), []);
  const alertas = useLiveQuery(() => db.alertas.toArray(), []);
  const inventario = useLiveQuery(() => db.inventarioAlimento.toArray(), []);
  const inventarioMaterial = useLiveQuery(() => db.inventarioMaterial.toArray(), []);
  const movimientosMaterial = useLiveQuery(() => db.movimientosInventarioMaterial.toArray(), []);
  const entradasMaterial = useLiveQuery(() => db.entradasMaterial.toArray(), []);
  const tipos = useLiveQuery(() => db.tiposAlimento.toArray(), []);
  const salidas = useLiveQuery(() => db.salidasPollo.toArray(), []);
  const [selectedLoteId, setSelectedLoteId] = useState('');
  const [selectedGalponId, setSelectedGalponId] = useState('');
  const [pesoObjetivo, setPesoObjetivo] = useState('2500');

  const summaries = useMemo(() => {
    if (!lotes || !registros || !consumos || !pesajes || !loteGalpones || !galpones || !actividades || !vacunas || !syncQueue) return [];
    const galponNamesById = new Map(galpones.map((galpon) => [galpon.GalponID, galpon.NombreGalpon]));
    return lotes.map((lote) =>
      buildLoteResumen({
        lote,
        registros: registros.filter((registro) => registro.LoteID === lote.LoteID),
        consumos: consumos.filter((consumo) => consumo.LoteID === lote.LoteID),
        pesajes: pesajes.filter((pesaje) => pesaje.LoteID === lote.LoteID),
        loteGalpones: loteGalpones.filter((item) => item.LoteID === lote.LoteID),
        galponNamesById,
        actividades,
        vacunas,
        syncQueue,
        today,
      }),
    );
  }, [actividades, consumos, galpones, loteGalpones, lotes, pesajes, registros, syncQueue, today, vacunas]);

  const selectedLote = lotes?.find((lote) => lote.LoteID === (selectedLoteId || summaries[0]?.LoteID)) ?? lotes?.[0];
  const selectedSummary = summaries.find((summary) => summary.LoteID === selectedLote?.LoteID);
  const activeSummaries = summaries.filter((summary) => lotes?.find((lote) => lote.LoteID === summary.LoteID)?.EstadoLote === 'ACTIVO');
  const selectedGalpon = galpones?.find((galpon) => galpon.GalponID === selectedGalponId);
  const selectedGalponSummary = getSummaryForGalpon(selectedGalpon, loteGalpones ?? [], summaries);
  const totals = {
    avesIniciales: lotes?.reduce((sum, lote) => sum + lote.CantidadInicialTotal, 0) ?? 0,
    avesVivas: activeSummaries.reduce((sum, summary) => sum + summary.AvesVivasTotal, 0),
    consumo: activeSummaries.reduce((sum, summary) => sum + summary.ConsumoAcumuladoKg, 0),
    pendientes: activeSummaries.reduce((sum, summary) => sum + summary.PendientesHoy, 0),
    vacunas: activeSummaries.reduce((sum, summary) => sum + summary.VacunasPendientes, 0),
  };

  const chartData = useMemo(
    () =>
      registros
        ?.filter((registro) => !selectedLote || registro.LoteID === selectedLote.LoteID)
        .map((registro) => ({
          fecha: registro.Fecha.slice(5),
          consumo: registro.KgConsumidos,
          muertos: registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar,
        })) ?? [],
    [registros, selectedLote],
  );

  const pesoData = useMemo(
    () =>
      pesajes
        ?.filter((pesaje) => !selectedLote || pesaje.LoteID === selectedLote.LoteID)
        .map((pesaje) => ({
          dia: pesaje.DiaLote,
          macho: pesaje.PesoPromedioMachos,
          hembra: pesaje.PesoPromedioHembras,
          general: pesaje.PesoPromedioGeneral,
        })) ?? [],
    [pesajes, selectedLote],
  );

  const prediction = useMemo(() => {
    const lotePesajes = pesajes?.filter((pesaje) => pesaje.LoteID === selectedLote?.LoteID).sort((a, b) => a.DiaLote - b.DiaLote) ?? [];
    const current = lotePesajes.at(-1);
    const previous = lotePesajes.at(-2);
    const gain = current && previous ? gananciaDiaria(current.PesoPromedioGeneral, previous.PesoPromedioGeneral, current.DiaLote - previous.DiaLote) : 65;
    const days = current ? prediccionSalidaDias(Number(pesoObjetivo || 0), current.PesoPromedioGeneral, gain) : 0;
    return {
      pesoActual: current?.PesoPromedioGeneral ?? 0,
      gain,
      days,
      date: addDays(today, Math.ceil(days)),
    };
  }, [pesajes, pesoObjetivo, selectedLote?.LoteID, today]);

  async function handleGeneratePdf(lote: Lote) {
    const reporte = await generarReporteLotePDF(lote, user);
    window.open(reporte.URLArchivo, '_blank', 'noopener,noreferrer');
    onToast('Reporte PDF generado localmente.');
  }

  async function handleGenerateAlerts(lote: Lote) {
    const created = await generarAlertasBasicas(lote);
    onToast(`${created.length} alerta(s) nueva(s) generada(s).`);
  }

  return (
    <main className="page-shell">
      {activeView === 'inicio' && (
        <>
          <AdminTitle eyebrow="ADMIN" title="Inicio" icon={<Home size={34} />} />
          <section className="stats-grid stats-grid--wide">
            <StatCard label="Lotes activos" value={fmtNumber(activeSummaries.length)} />
            <StatCard label="Aves iniciales" value={fmtNumber(totals.avesIniciales)} />
            <StatCard label="Aves vivas" value={fmtNumber(totals.avesVivas)} />
            <StatCard label="Consumo acum." value={fmtKg(totals.consumo)} />
            <StatCard label="Actividades vencidas" value={fmtNumber(totals.pendientes)} tone={totals.pendientes > 0 ? 'warn' : 'good'} />
            <StatCard label="Vacunas pendientes" value={fmtNumber(totals.vacunas)} tone={totals.vacunas > 0 ? 'warn' : 'good'} />
          </section>

          <div className="admin-grid">
            {selectedLote && selectedSummary && (
              <MobileCard title={`Lote ${selectedLote.CodigoLote}`} subtitle="Resumen tecnico y administrativo">
                <SelectedLoteStats selectedSummary={selectedSummary} salidas={salidas ?? []} />
                <div className="section-actions">
                  <button type="button" onClick={() => handleGenerateAlerts(selectedLote)}>
                    Generar alertas
                  </button>
                  <button type="button" onClick={() => handleGeneratePdf(selectedLote)}>
                    Reporte PDF
                  </button>
                </div>
              </MobileCard>
            )}

            <MobileCard title="Alertas">
              <AlertList alertas={alertas ?? []} />
            </MobileCard>
          </div>
        </>
      )}

      {activeView === 'galpones' && (
        <>
          <AdminTitle eyebrow="MAPA" title="Galpones" icon={<MapIcon size={34} />} />
          <GalponMap
            galpones={galpones ?? []}
            loteGalpones={loteGalpones ?? []}
            lotes={lotes ?? []}
            summaries={summaries}
            selectedGalponId={selectedGalponId}
            onSelectGalpon={(galponId) => setSelectedGalponId(galponId)}
          />
          {selectedGalpon && (
            <MobileCard title={`Galpon ${selectedGalpon.NombreGalpon}`} subtitle={selectedGalponSummary?.CodigoLote ?? 'Sin lote activo'}>
              {selectedGalponSummary ? <LoteSummary summary={selectedGalponSummary} /> : <p className="empty-state">Galpon disponible para alistamiento.</p>}
            </MobileCard>
          )}
        </>
      )}

      {activeView === 'lotes' && (
        <>
          <AdminTitle eyebrow="PRODUCCION" title="Lotes" icon={<ClipboardList size={34} />} />
          <div className="admin-grid">
            <MobileCard title="Crear lote">
              <CrearLoteForm user={user} onSaved={onToast} />
            </MobileCard>
            <MobileCard title="Lotes">
              <LotesTable summaries={summaries} lotes={lotes ?? []} onSelect={setSelectedLoteId} onGeneratePdf={handleGeneratePdf} />
            </MobileCard>
          </div>

          {selectedLote && selectedSummary && (
            <div className="admin-grid">
              <MobileCard title={`Lote ${selectedLote.CodigoLote}`} subtitle="Resumen tecnico y administrativo">
                <SelectedLoteStats selectedSummary={selectedSummary} salidas={salidas ?? []} />
                <div className="section-actions">
                  <button type="button" onClick={() => handleGenerateAlerts(selectedLote)}>
                    Generar alertas
                  </button>
                  <button type="button" onClick={() => handleGeneratePdf(selectedLote)}>
                    Reporte PDF
                  </button>
                </div>
              </MobileCard>
              <PredictionCard prediction={prediction} pesoObjetivo={pesoObjetivo} onPesoObjetivoChange={setPesoObjetivo} />
            </div>
          )}
        </>
      )}

      {activeView === 'inventario' && (
        <>
          <AdminTitle eyebrow="ALIMENTO" title="Inventario" icon={<Package size={34} />} />
          <MobileCard title="Existencias">
            <InventoryList inventario={inventario ?? []} tipos={tipos ?? []} />
          </MobileCard>
          <MobileCard title="Auditoria materiales">
            <MaterialAuditList inventario={inventarioMaterial ?? []} movimientos={movimientosMaterial ?? []} entradas={entradasMaterial ?? []} />
          </MobileCard>
          <AdminAdvancedModules user={user} onToast={onToast} initialTab="inventario" visibleTabs={['inventario']} />
        </>
      )}

      {activeView === 'reportes' && (
        <>
          <AdminTitle eyebrow="REPORTES" title="Analisis" icon={<BarChart3 size={34} />} />
          <div className="chart-grid">
            <MobileCard title="Consumo y mortalidad diaria">
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="consumo" fill="#136f63" name="Kg" />
                    <Bar dataKey="muertos" fill="#d46a31" name="Muertos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </MobileCard>

            <MobileCard title="Curva real de peso">
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={pesoData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="macho" stroke="#1d4ed8" name="Macho" strokeWidth={2} />
                    <Line type="monotone" dataKey="hembra" stroke="#be185d" name="Hembra" strokeWidth={2} />
                    <Line type="monotone" dataKey="general" stroke="#136f63" name="General" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </MobileCard>
          </div>
          <AdminAdvancedModules user={user} onToast={onToast} />
        </>
      )}
    </main>
  );
}

function AdminTitle({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: ReactNode }) {
  return (
    <section className="page-title page-title--admin native-page-title">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {icon}
    </section>
  );
}

function SelectedLoteStats({ selectedSummary, salidas }: { selectedSummary: LoteResumen; salidas: Array<{ EstadoAdministrativo: string }> }) {
  return (
    <div className="stats-grid">
      <StatCard label="Machos vivos" value={fmtNumber(selectedSummary.MachosVivos)} />
      <StatCard label="Hembras vivas" value={fmtNumber(selectedSummary.HembrasVivas)} />
      <StatCard label="Peso general" value={fmtKg(selectedSummary.PesoPromedioGeneralKg, 3)} />
      <StatCard label="CA actual" value={fmtNumber(selectedSummary.ConversionAlimenticia, 2)} />
      <StatCard label="Costo acum." value={fmtCurrency(0)} />
      <StatCard label="Pend. admin" value={fmtNumber(salidas.filter((salida) => salida.EstadoAdministrativo !== 'COMPLETO').length)} tone="warn" />
    </div>
  );
}

function LotesTable({
  summaries,
  lotes,
  onSelect,
  onGeneratePdf,
}: {
  summaries: LoteResumen[];
  lotes: Lote[];
  onSelect: (loteId: string) => void;
  onGeneratePdf: (lote: Lote) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Lote</th>
            <th>Dia</th>
            <th>Aves vivas</th>
            <th>Mortalidad</th>
            <th>Consumo</th>
            <th>Conversion</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => {
            const lote = lotes.find((item) => item.LoteID === summary.LoteID);
            return (
              <tr key={summary.LoteID}>
                <td data-label="Lote">
                  <button className="text-button" type="button" onClick={() => onSelect(summary.LoteID)}>
                    {summary.CodigoLote}
                  </button>
                </td>
                <td data-label="Dia">{summary.DiaLote}</td>
                <td data-label="Aves vivas">{fmtNumber(summary.AvesVivasTotal)}</td>
                <td data-label="Mortalidad">{fmtPercent(summary.MortalidadAcumulada)}</td>
                <td data-label="Consumo">{fmtKg(summary.ConsumoAcumuladoKg)}</td>
                <td data-label="Conversion">{fmtNumber(summary.ConversionAlimenticia, 2)}</td>
                <td data-label="Accion">
                  {lote && (
                    <button className="small-button" type="button" onClick={() => onGeneratePdf(lote)}>
                      PDF
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PredictionCard({
  prediction,
  pesoObjetivo,
  onPesoObjetivoChange,
}: {
  prediction: { pesoActual: number; gain: number; days: number; date: string };
  pesoObjetivo: string;
  onPesoObjetivoChange: (value: string) => void;
}) {
  return (
    <MobileCard title="Prediccion de salida">
      <div className="prediction-box">
        <label className="field">
          <span>Peso objetivo gr</span>
          <input type="number" value={pesoObjetivo} onChange={(event) => onPesoObjetivoChange(event.target.value)} />
        </label>
        <span>Peso actual: {fmtNumber(prediction.pesoActual)} g</span>
        <span>Ganancia reciente: {fmtNumber(prediction.gain, 1)} g/dia</span>
        <strong>
          {fmtNumber(prediction.days, 1)} dias - {prediction.date}
        </strong>
        <div className="scenario-row">
          {[35, 38, 42].map((day) => (
            <span key={day}>Dia {day}</span>
          ))}
        </div>
      </div>
    </MobileCard>
  );
}

function AlertList({ alertas }: { alertas: Array<{ AlertaID: string; Nivel: 'INFORMATIVA' | 'MEDIA' | 'ALTA' | 'CRITICA'; TipoAlerta: string; Mensaje: string }> }) {
  if (alertas.length === 0) return <p className="empty-state">No hay alertas activas.</p>;

  return (
    <div className="stack">
      {alertas.slice(0, 8).map((alerta) => (
        <article className="list-row" key={alerta.AlertaID}>
          <AlertBadge nivel={alerta.Nivel}>{alerta.Nivel}</AlertBadge>
          <div>
            <strong>{alerta.TipoAlerta}</strong>
            <span>{alerta.Mensaje}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function InventoryList({
  inventario,
  tipos,
}: {
  inventario: Array<{ InventarioID: string; TipoAlimentoID: string; BultosDisponibles: number; KgDisponibles: number }>;
  tipos: Array<{ TipoAlimentoID: string; Nombre: string }>;
}) {
  if (inventario.length === 0) return <p className="empty-state">No hay inventario registrado.</p>;

  return (
    <div className="inventory-list">
      {inventario.map((item) => {
        const tipo = tipos.find((tipoItem) => tipoItem.TipoAlimentoID === item.TipoAlimentoID);
        return (
          <div key={item.InventarioID}>
            <span>{tipo?.Nombre ?? item.TipoAlimentoID}</span>
            <strong>
              {fmtNumber(item.BultosDisponibles, 1)} bultos - {fmtKg(item.KgDisponibles)}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function MaterialAuditList({
  inventario,
  movimientos,
  entradas,
}: {
  inventario: Array<{ InventarioMaterialID: string; TipoMaterial: string; CantidadDisponible: number; Unidad: string }>;
  movimientos: Array<{ MovimientoMaterialID: string; TipoMaterial: string; TipoMovimiento: string; Cantidad: number; Unidad: string; Fecha: string }>;
  entradas: Array<{ EntradaMaterialID: string; TipoMaterial: string; Cantidad: number; Unidad: string; Fecha: string }>;
}) {
  const tipos = ['CISCO', 'GAS'];

  if (inventario.length === 0 && movimientos.length === 0 && entradas.length === 0) {
    return <p className="empty-state">No hay entradas de cisco o gas registradas.</p>;
  }

  return (
    <div className="material-audit-list">
      {tipos.map((tipo) => {
        const saldo = inventario.find((item) => item.TipoMaterial === tipo);
        const entradasTipo = entradas.filter((entrada) => entrada.TipoMaterial === tipo);
        const movimientosTipo = movimientos.filter((movimiento) => movimiento.TipoMaterial === tipo);
        const totalEntradas = entradasTipo.reduce((sum, entrada) => sum + entrada.Cantidad, 0);
        const totalSalidas = movimientosTipo
          .filter((movimiento) => movimiento.TipoMovimiento !== 'ENTRADA_COMPRA')
          .reduce((sum, movimiento) => sum + movimiento.Cantidad, 0);
        return (
          <article key={tipo}>
            <header>
              <strong>{tipo === 'CISCO' ? 'Cisco' : 'Gas'}</strong>
              <span>
                {fmtNumber(saldo?.CantidadDisponible ?? Math.max(0, totalEntradas - totalSalidas), 1)} {saldo?.Unidad || (tipo === 'CISCO' ? 'PACAS' : 'CILINDROS')}
              </span>
            </header>
            <small>
              Entradas {fmtNumber(totalEntradas, 1)} - salidas/ajustes {fmtNumber(totalSalidas, 1)}
            </small>
          </article>
        );
      })}
    </div>
  );
}

function LoteSummary({ summary }: { summary: LoteResumen }) {
  return (
    <div className="lote-summary">
      <header>
        <div>
          <strong>{summary.CodigoLote}</strong>
          <span>Dia {summary.DiaLote}</span>
        </div>
        <small>{summary.Galpones.join(', ') || 'Sin galpon'}</small>
      </header>
      <div className="stats-grid">
        <StatCard label="Aves vivas" value={fmtNumber(summary.AvesVivasTotal)} />
        <StatCard label="Machos vivos" value={fmtNumber(summary.MachosVivos)} />
        <StatCard label="Hembras vivas" value={fmtNumber(summary.HembrasVivas)} />
        <StatCard label="Pendientes" value={fmtNumber(summary.PendientesHoy)} tone={summary.PendientesHoy > 0 ? 'warn' : 'good'} />
      </div>
    </div>
  );
}

function getSummaryForGalpon(
  galpon: Galpon | undefined,
  loteGalpones: Array<{ GalponID: string; LoteID: string; Estado: string }>,
  summaries: LoteResumen[],
): LoteResumen | undefined {
  if (!galpon) return undefined;
  const assignment = loteGalpones.find((item) => item.GalponID === galpon.GalponID && item.Estado === 'ACTIVO');
  return summaries.find((summary) => summary.LoteID === assignment?.LoteID);
}
