import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertBadge } from '../../components/AlertBadge';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { buildLoteResumen, gananciaDiaria, prediccionSalidaDias } from '../../services/calculationsService';
import { generarAlertasBasicas } from '../../services/alertsService';
import { generarReporteLotePDF } from '../../services/reportsService';
import { db } from '../../services/localDbService';
import { addDays, todayISO } from '../../lib/date';
import { fmtCurrency, fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type { Lote, LoteResumen, Usuario } from '../../types/entities';
import { AdminAdvancedModules } from './AdminAdvancedModules';
import { CrearLoteForm } from './CrearLoteForm';

interface AdminDashboardProps {
  user: Usuario;
  onToast: (message: string) => void;
}

export function AdminDashboard({ user, onToast }: AdminDashboardProps) {
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
  const tipos = useLiveQuery(() => db.tiposAlimento.toArray(), []);
  const salidas = useLiveQuery(() => db.salidasPollo.toArray(), []);
  const [selectedLoteId, setSelectedLoteId] = useState('');
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
      <section className="page-title page-title--admin">
        <div>
          <span>ADMIN</span>
          <h1>Dashboard POLLOS</h1>
        </div>
        <strong>{fmtCurrency(0)}</strong>
      </section>

      <section className="stats-grid stats-grid--wide">
        <StatCard label="Lotes activos" value={fmtNumber(activeSummaries.length)} />
        <StatCard label="Aves iniciales" value={fmtNumber(totals.avesIniciales)} />
        <StatCard label="Aves vivas" value={fmtNumber(totals.avesVivas)} />
        <StatCard label="Consumo acum." value={fmtKg(totals.consumo)} />
        <StatCard label="Actividades vencidas" value={fmtNumber(totals.pendientes)} tone={totals.pendientes > 0 ? 'warn' : 'good'} />
        <StatCard label="Vacunas pendientes" value={fmtNumber(totals.vacunas)} tone={totals.vacunas > 0 ? 'warn' : 'good'} />
      </section>

      <div className="admin-grid">
        <MobileCard title="Crear lote">
          <CrearLoteForm user={user} onSaved={onToast} />
        </MobileCard>

        <MobileCard title="Lotes">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Día</th>
                  <th>Aves vivas</th>
                  <th>Mortalidad</th>
                  <th>Consumo</th>
                  <th>Conversión</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => {
                  const lote = lotes?.find((item) => item.LoteID === summary.LoteID);
                  return (
                    <tr key={summary.LoteID}>
                      <td data-label="Lote">
                        <button className="text-button" type="button" onClick={() => setSelectedLoteId(summary.LoteID)}>
                          {summary.CodigoLote}
                        </button>
                      </td>
                      <td data-label="Día">{summary.DiaLote}</td>
                      <td data-label="Aves vivas">{fmtNumber(summary.AvesVivasTotal)}</td>
                      <td data-label="Mortalidad">{fmtPercent(summary.MortalidadAcumulada)}</td>
                      <td data-label="Consumo">{fmtKg(summary.ConsumoAcumuladoKg)}</td>
                      <td data-label="Conversión">{fmtNumber(summary.ConversionAlimenticia, 2)}</td>
                      <td data-label="Acción">
                        {lote && (
                          <button className="small-button" type="button" onClick={() => handleGeneratePdf(lote)}>
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
        </MobileCard>
      </div>

      {selectedLote && selectedSummary && (
        <div className="admin-grid">
          <MobileCard title={`Lote ${selectedLote.CodigoLote}`} subtitle="Resumen técnico y administrativo">
            <div className="stats-grid">
              <StatCard label="Machos vivos" value={fmtNumber(selectedSummary.MachosVivos)} />
              <StatCard label="Hembras vivas" value={fmtNumber(selectedSummary.HembrasVivas)} />
              <StatCard label="Peso general" value={fmtKg(selectedSummary.PesoPromedioGeneralKg, 3)} />
              <StatCard label="CA actual" value={fmtNumber(selectedSummary.ConversionAlimenticia, 2)} />
              <StatCard label="Costo acum." value={fmtCurrency(0)} />
              <StatCard label="Pend. admin" value={fmtNumber((salidas ?? []).filter((salida) => salida.EstadoAdministrativo !== 'COMPLETO').length)} tone="warn" />
            </div>
            <div className="section-actions">
              <button type="button" onClick={() => handleGenerateAlerts(selectedLote)}>
                Generar alertas
              </button>
              <button type="button" onClick={() => handleGeneratePdf(selectedLote)}>
                Reporte PDF
              </button>
            </div>
          </MobileCard>

          <MobileCard title="Predicción de salida">
            <div className="prediction-box">
              <label className="field">
                <span>Peso objetivo gr</span>
                <input type="number" value={pesoObjetivo} onChange={(event) => setPesoObjetivo(event.target.value)} />
              </label>
              <span>Peso actual: {fmtNumber(prediction.pesoActual)} g</span>
              <span>Ganancia reciente: {fmtNumber(prediction.gain, 1)} g/día</span>
              <strong>
                {fmtNumber(prediction.days, 1)} días · {prediction.date}
              </strong>
              <div className="scenario-row">
                {[35, 38, 42].map((day) => (
                  <span key={day}>Día {day}</span>
                ))}
              </div>
            </div>
          </MobileCard>
        </div>
      )}

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

      <div className="admin-grid">
        <MobileCard title="Inventario alimento">
          <div className="inventory-list">
            {inventario?.map((item) => {
              const tipo = tipos?.find((tipoItem) => tipoItem.TipoAlimentoID === item.TipoAlimentoID);
              return (
                <div key={item.InventarioID}>
                  <span>{tipo?.Nombre ?? item.TipoAlimentoID}</span>
                  <strong>
                    {fmtNumber(item.BultosDisponibles, 1)} bultos · {fmtKg(item.KgDisponibles)}
                  </strong>
                </div>
              );
            })}
          </div>
        </MobileCard>

        <MobileCard title="Alertas">
          <div className="stack">
            {alertas?.slice(0, 8).map((alerta) => (
              <article className="list-row" key={alerta.AlertaID}>
                <AlertBadge nivel={alerta.Nivel}>{alerta.Nivel}</AlertBadge>
                <div>
                  <strong>{alerta.TipoAlerta}</strong>
                  <span>{alerta.Mensaje}</span>
                </div>
              </article>
            ))}
          </div>
        </MobileCard>
      </div>

      <AdminAdvancedModules user={user} onToast={onToast} />
    </main>
  );
}
