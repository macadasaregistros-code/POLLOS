import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BarChart3, CalendarClock, ClipboardList, Home, Map as MapIcon, Package } from 'lucide-react';
import { AlertBadge } from '../../components/AlertBadge';
import { buildGalponDashboardModel, GalponMap, GalponPremiumDashboardCard, getMaxGalponCapacity } from '../../components/GalponMap';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { buildLoteResumen, gananciaDiaria, prediccionSalidaDias } from '../../services/calculationsService';
import { generarAlertasBasicas } from '../../services/alertsService';
import { generarReporteLotePDF } from '../../services/reportsService';
import { db } from '../../services/localDbService';
import { addDays, todayISO } from '../../lib/date';
import { fmtCurrency, fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type { ActividadLote, EstadoSync, Galpon, Lote, LoteResumen, Usuario } from '../../types/entities';
import type { MainView } from '../../types/navigation';
import { AdminAdvancedModules } from './AdminAdvancedModules';
import { CrearLoteForm } from './CrearLoteForm';
import { ProgramacionView } from './ProgramacionView';

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
  const usuarios = useLiveQuery(() => db.usuarios.toArray(), []);
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
  const selectedGalponDashboard = useMemo(() => {
    if (!selectedGalpon) return undefined;
    return buildGalponDashboardModel({
      galpon: selectedGalpon,
      loteGalpones: loteGalpones ?? [],
      lotesById: new Map((lotes ?? []).map((lote) => [lote.LoteID, lote])),
      summariesByLoteId: new Map(summaries.map((summary) => [summary.LoteID, summary])),
      maxCapacity: getMaxGalponCapacity(galpones ?? []),
    });
  }, [galpones, loteGalpones, lotes, selectedGalpon, summaries]);
  const selectedGalponSummary = selectedGalponDashboard?.summary;
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

      {activeView === 'actividades' && (
        <>
          <AdminTitle eyebrow="OPERACION" title="Actividades" icon={<Activity size={34} />} />
          <ActivityHistoryView
            actividades={actividades ?? []}
            lotes={lotes ?? []}
            galpones={galpones ?? []}
            usuarios={usuarios ?? []}
            today={today}
          />
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
          {selectedGalponDashboard && (
            <section className="admin-galpon-detail">
              <GalponPremiumDashboardCard
                data={selectedGalponDashboard.data}
                empty={selectedGalponDashboard.empty}
                vacating={selectedGalponDashboard.vacating}
                emptyState={selectedGalponDashboard.emptyState}
                capacityRatio={selectedGalponDashboard.capacityRatio}
              />
              <MobileCard title={`Galpon ${selectedGalpon?.NombreGalpon ?? selectedGalponDashboard.data.galpon}`} subtitle={selectedGalponSummary?.CodigoLote ?? 'Sin lote activo'}>
                {selectedGalponSummary ? <LoteSummary summary={selectedGalponSummary} /> : <p className="empty-state">Galpon disponible para alistamiento.</p>}
              </MobileCard>
            </section>
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

      {activeView === 'programacion' && (
        <>
          <AdminTitle eyebrow="AGENDA" title="Programacion" icon={<CalendarClock size={34} />} />
          <ProgramacionView user={user} onToast={onToast} />
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

interface ActivityHistoryItem {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  name: string;
  category: string;
  lote: string;
  diaLote: number;
  galpon: string;
  user: string;
  sync: EstadoSync;
  note: string;
}

function ActivityHistoryView({
  actividades,
  lotes,
  galpones,
  usuarios,
  today,
}: {
  actividades: ActividadLote[];
  lotes: Lote[];
  galpones: Galpon[];
  usuarios: Usuario[];
  today: string;
}) {
  const history = useMemo(() => buildActivityHistory({ actividades, lotes, galpones, usuarios }), [actividades, galpones, lotes, usuarios]);
  const groups = useMemo(() => groupActivityHistoryByDate(history), [history]);
  const last7Start = addDays(today, -6);
  const todayCount = history.filter((item) => item.date === today).length;
  const last7Count = history.filter((item) => item.date >= last7Start).length;
  const loteCount = new Set(history.map((item) => item.lote)).size;
  const localCount = history.filter((item) => item.sync === 'PENDIENTE' || item.sync === 'ERROR' || item.sync === 'REQUIERE_REVISION').length;

  return (
    <section className="activity-history-view">
      <section className="stats-grid stats-grid--wide activity-history-stats">
        <StatCard label="Hechas hoy" value={fmtNumber(todayCount)} tone={todayCount > 0 ? 'good' : 'neutral'} />
        <StatCard label="Ultimos 7 dias" value={fmtNumber(last7Count)} />
        <StatCard label="Lotes con actividad" value={fmtNumber(loteCount)} />
        <StatCard label="Guardadas local" value={fmtNumber(localCount)} tone={localCount > 0 ? 'warn' : 'good'} />
      </section>

      <MobileCard title="Actividades realizadas" subtitle="Ordenadas por fecha descendente">
        {groups.length ? (
          <div className="activity-history-list">
            {groups.map((group) => (
              <section className="activity-date-group" key={group.date}>
                <header>
                  <div>
                    <strong>{formatActivityDate(group.date, today)}</strong>
                    <span>{group.date}</span>
                  </div>
                  <b>{fmtNumber(group.items.length)}</b>
                </header>
                <div className="activity-history-table">
                  <div className="activity-history-table__header" aria-hidden="true">
                    <span>Hora</span>
                    <span>Actividad</span>
                    <span>Lote</span>
                    <span>Galpon</span>
                    <span>Responsable</span>
                    <span>Sync</span>
                  </div>
                  {group.items.map((item) => (
                    <article className="activity-history-row" key={item.id}>
                      <span className="activity-history-row__time">{item.time}</span>
                      <div className="activity-history-row__activity">
                        <strong>{item.name}</strong>
                        <span>{item.category}</span>
                      </div>
                      <span className="activity-history-row__lote">{item.lote} - Dia {item.diaLote}</span>
                      <span className="activity-history-row__galpon">{item.galpon}</span>
                      <span className="activity-history-row__user">{item.user}</span>
                      <span className={`activity-history-sync activity-history-sync--${item.sync.toLowerCase()}`}>{getSyncLabel(item.sync)}</span>
                      {item.note && <small className="activity-history-row__note">{item.note}</small>}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay actividades marcadas como realizadas.</p>
        )}
      </MobileCard>
    </section>
  );
}

function buildActivityHistory({
  actividades,
  lotes,
  galpones,
  usuarios,
}: {
  actividades: ActividadLote[];
  lotes: Lote[];
  galpones: Galpon[];
  usuarios: Usuario[];
}): ActivityHistoryItem[] {
  const lotesById = new Map(lotes.map((lote) => [lote.LoteID, lote]));
  const galponesById = new Map(galpones.map((galpon) => [galpon.GalponID, galpon]));
  const usuariosById = new Map(usuarios.map((usuario) => [usuario.UsuarioID, usuario]));

  return actividades
    .filter((actividad) => actividad.Estado === 'REALIZADA')
    .map((actividad) => {
      const realizedAt = actividad.FechaRealizada || `${actividad.FechaProgramada}T00:00:00`;
      const date = actividad.FechaRealizada ? actividad.FechaRealizada.slice(0, 10) : actividad.FechaProgramada;
      const lote = lotesById.get(actividad.LoteID);
      const galpon = galponesById.get(actividad.GalponID);
      const usuario = usuariosById.get(actividad.RealizadaPor);
      return {
        id: actividad.ActividadLoteID,
        date,
        time: formatActivityTime(actividad.FechaRealizada),
        timestamp: getTimestamp(realizedAt),
        name: actividad.NombreActividad,
        category: actividad.Categoria || 'Actividad',
        lote: lote ? `Lote ${lote.CodigoLote}` : 'Lote sin dato',
        diaLote: actividad.DiaLote,
        galpon: galpon ? `Galpon ${galpon.NombreGalpon}` : 'Galpon sin dato',
        user: usuario?.Nombre || actividad.RealizadaPor || 'Sin responsable',
        sync: actividad.EstadoSync,
        note: actividad.Observacion.trim(),
      };
    })
    .sort((left, right) => right.timestamp - left.timestamp || left.name.localeCompare(right.name));
}

function groupActivityHistoryByDate(history: ActivityHistoryItem[]): Array<{ date: string; items: ActivityHistoryItem[] }> {
  const groups = new Map<string, ActivityHistoryItem[]>();
  for (const item of history) {
    const current = groups.get(item.date) ?? [];
    current.push(item);
    groups.set(item.date, current);
  }
  return Array.from(groups, ([date, items]) => ({ date, items }));
}

function getTimestamp(dateTimeISO: string): number {
  const timestamp = new Date(dateTimeISO).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatActivityTime(dateTimeISO: string): string {
  if (!dateTimeISO) return 'Sin hora';
  const date = new Date(dateTimeISO);
  if (!Number.isFinite(date.getTime())) return 'Sin hora';
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatActivityDate(dateISO: string, today: string): string {
  const date = new Date(`${dateISO}T12:00:00`);
  const formatted = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: '2-digit', month: 'short' }).format(date)
    : dateISO;
  return dateISO === today ? `Hoy - ${formatted}` : formatted;
}

function getSyncLabel(sync: EstadoSync): string {
  const labels: Record<EstadoSync, string> = {
    PENDIENTE: 'Local',
    SINCRONIZADO: 'Enviado',
    ERROR: 'Error',
    REQUIERE_REVISION: 'Revision',
  };
  return labels[sync];
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
