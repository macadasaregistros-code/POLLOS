import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BarChart3, CalendarClock, ChevronDown, ClipboardList, FileText, Flame, Home, Map as MapIcon, Package, PackagePlus, Save, Truck, Warehouse } from 'lucide-react';
import { AlertBadge } from '../../components/AlertBadge';
import { buildGalponDashboardModel, GalponMap, GalponPremiumDashboardCard, getMaxGalponCapacity } from '../../components/GalponMap';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { buildLoteResumen, gananciaDiaria, prediccionSalidaDias } from '../../services/calculationsService';
import { getMissingDailyRegisterDates } from '../../services/dailyRegisterService';
import { generarAlertasBasicas } from '../../services/alertsService';
import { generarReporteLotePDF } from '../../services/reportsService';
import { db } from '../../services/localDbService';
import { getProgramacionActivityCategory, programacionCategories, type ProgramacionCategoryKey } from '../../services/programmingCatalogService';
import { enqueueSync } from '../../services/syncService';
import { addDays, diffDays, getDiaLote, todayISO } from '../../lib/date';
import { fmtCurrency, fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type { ActividadLote, ActividadProgramada, EntradaAlimento, EntradaMaterial, EstadoSync, Galpon, Lote, LoteResumen, RegistroDiarioLote, TipoAlimento, Usuario } from '../../types/entities';
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
  const actividadesProgramadas = useLiveQuery(() => db.actividadesProgramadas.toArray(), []);
  const vacunas = useLiveQuery(() => db.vacunasLote.toArray(), []);
  const syncQueue = useLiveQuery(() => db.syncQueue.toArray(), []);
  const alertas = useLiveQuery(() => db.alertas.toArray(), []);
  const inventario = useLiveQuery(() => db.inventarioAlimento.toArray(), []);
  const inventarioMaterial = useLiveQuery(() => db.inventarioMaterial.toArray(), []);
  const movimientosMaterial = useLiveQuery(() => db.movimientosInventarioMaterial.toArray(), []);
  const entradasAlimento = useLiveQuery(() => db.entradasAlimento.toArray(), []);
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
      registrosDiarios: registros ?? [],
      maxCapacity: getMaxGalponCapacity(galpones ?? []),
      today,
    });
  }, [galpones, loteGalpones, lotes, registros, selectedGalpon, summaries, today]);
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
            actividadesProgramadas={actividadesProgramadas ?? []}
            lotes={lotes ?? []}
            galpones={galpones ?? []}
            today={today}
            onToast={onToast}
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
            registrosDiarios={registros ?? []}
            today={today}
            selectedGalponId={selectedGalponId}
            onSelectGalpon={(galponId) => setSelectedGalponId(galponId)}
          />
          {selectedGalponDashboard && (
            <section className="admin-galpon-detail">
              <GalponPremiumDashboardCard
                data={selectedGalponDashboard.data}
                empty={selectedGalponDashboard.empty}
                vacating={selectedGalponDashboard.vacating}
                staleData={selectedGalponDashboard.staleData}
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
              <LotesTable
                summaries={summaries}
                lotes={lotes ?? []}
                selectedLoteId={selectedLote?.LoteID ?? ''}
                onSelect={setSelectedLoteId}
                onGeneratePdf={handleGeneratePdf}
              />
            </MobileCard>
          </div>

          {selectedLote && selectedSummary && (
            <>
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
            </>
          )}
        </>
      )}

      {activeView === 'hojasManejo' && (
        <>
          <AdminTitle eyebrow="REGISTROS" title="Hojas de manejo" icon={<FileText size={34} />} />
          <HojasManejoView
            lotes={lotes ?? []}
            selectedLote={selectedLote}
            selectedLoteId={selectedLote?.LoteID ?? ''}
            onSelectLote={setSelectedLoteId}
            registros={registros ?? []}
            tipos={tipos ?? []}
            today={today}
          />
        </>
      )}

      {activeView === 'entradas' && (
        <>
          <AdminTitle eyebrow="GALPONERO" title="Entradas" icon={<Truck size={34} />} />
          <EntradasHistoryView
            entradasAlimento={entradasAlimento ?? []}
            entradasMaterial={entradasMaterial ?? []}
            tipos={tipos ?? []}
            today={today}
          />
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
  tone: ProgramacionCategoryKey;
  lote: string;
  diaLote: number;
  galpon: string;
  note: string;
  actividad: ActividadLote;
}

type ActivityHistoryFilterKey = ProgramacionCategoryKey | 'all';

function ActivityHistoryView({
  actividades,
  actividadesProgramadas,
  lotes,
  galpones,
  today,
  onToast,
}: {
  actividades: ActividadLote[];
  actividadesProgramadas: ActividadProgramada[];
  lotes: Lote[];
  galpones: Galpon[];
  today: string;
  onToast: (message: string) => void;
}) {
  const [selectedCategory, setSelectedCategory] = useState<ActivityHistoryFilterKey>('all');
  const history = useMemo(() => buildActivityHistory({ actividades, actividadesProgramadas, lotes, galpones }), [actividades, actividadesProgramadas, galpones, lotes]);
  const categoryCounts = useMemo(() => getActivityHistoryCategoryCounts(history), [history]);
  const filteredHistory = useMemo(
    () => selectedCategory === 'all' ? history : history.filter((item) => item.tone === selectedCategory),
    [history, selectedCategory],
  );
  const groups = useMemo(() => groupActivityHistoryByDate(filteredHistory), [filteredHistory]);
  const last7Start = addDays(today, -6);
  const todayCount = filteredHistory.filter((item) => item.date === today).length;
  const last7Count = filteredHistory.filter((item) => item.date >= last7Start).length;
  const loteCount = new Set(filteredHistory.map((item) => item.lote)).size;
  const selectedCategoryLabel = programacionCategories.find((category) => category.key === selectedCategory)?.label ?? 'esta categoria';

  return (
    <section className="activity-history-view">
      <section className="stats-grid stats-grid--wide activity-history-stats">
        <StatCard label="Hechas hoy" value={fmtNumber(todayCount)} tone={todayCount > 0 ? 'good' : 'neutral'} />
        <StatCard label="Ultimos 7 dias" value={fmtNumber(last7Count)} />
        <StatCard label="Lotes con actividad" value={fmtNumber(loteCount)} />
      </section>

      <section className="activity-history-filter" role="group" aria-label="Filtrar actividades hechas por categoria">
        <button
          className={`activity-history-filter__button activity-history-filter__button--all ${selectedCategory === 'all' ? 'is-active' : ''}`}
          type="button"
          aria-pressed={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
        >
          <span>Todas</span>
          <b>{fmtNumber(history.length)}</b>
        </button>
        {programacionCategories.map((category) => {
          const count = categoryCounts.get(category.key) ?? 0;
          return (
            <button
              className={`activity-history-filter__button activity-history-filter__button--${category.key} ${selectedCategory === category.key ? 'is-active' : ''}`}
              type="button"
              key={category.key}
              aria-pressed={selectedCategory === category.key}
              onClick={() => setSelectedCategory(category.key)}
            >
              <span>{category.label}</span>
              <b>{fmtNumber(count)}</b>
            </button>
          );
        })}
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
                  </div>
                  {group.items.map((item) => (
                    <ActivityHistoryRow
                      key={item.id}
                      item={item}
                      lotes={lotes}
                      galpones={galpones}
                      onSaved={() => onToast('Actividad actualizada.')}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            {history.length ? `No hay actividades realizadas para ${selectedCategoryLabel}.` : 'Todavia no hay actividades marcadas como realizadas.'}
          </p>
        )}
      </MobileCard>
    </section>
  );
}

function getActivityHistoryCategoryCounts(history: ActivityHistoryItem[]): Map<ProgramacionCategoryKey, number> {
  const counts = new Map<ProgramacionCategoryKey, number>(programacionCategories.map((category) => [category.key, 0]));
  for (const item of history) {
    counts.set(item.tone, (counts.get(item.tone) ?? 0) + 1);
  }
  return counts;
}

function buildActivityHistory({
  actividades,
  actividadesProgramadas,
  lotes,
  galpones,
}: {
  actividades: ActividadLote[];
  actividadesProgramadas: ActividadProgramada[];
  lotes: Lote[];
  galpones: Galpon[];
}): ActivityHistoryItem[] {
  const lotesById = new Map(lotes.map((lote) => [lote.LoteID, lote]));
  const galponesById = new Map(galpones.map((galpon) => [galpon.GalponID, galpon]));

  return actividades
    .filter((actividad) => actividad.Estado === 'REALIZADA')
    .map((actividad) => {
      const realizedAt = actividad.FechaRealizada || `${actividad.FechaProgramada}T00:00:00`;
      const date = actividad.FechaRealizada ? actividad.FechaRealizada.slice(0, 10) : actividad.FechaProgramada;
      const lote = lotesById.get(actividad.LoteID);
      const galpon = galponesById.get(actividad.GalponID);
      return {
        id: actividad.ActividadLoteID,
        date,
        time: formatActivityTime(actividad.FechaRealizada),
        timestamp: getTimestamp(realizedAt),
        name: actividad.NombreActividad,
        category: actividad.Categoria || 'Actividad',
        tone: getProgramacionActivityCategory(actividad, actividadesProgramadas),
        lote: lote ? `Lote ${lote.CodigoLote}` : 'Lote sin dato',
        diaLote: actividad.DiaLote,
        galpon: galpon ? `Galpon ${galpon.NombreGalpon}` : 'Galpon sin dato',
        note: actividad.Observacion.trim(),
        actividad,
      };
    })
    .sort((left, right) => right.timestamp - left.timestamp || left.name.localeCompare(right.name));
}

function ActivityHistoryRow({
  item,
  lotes,
  galpones,
  onSaved,
}: {
  item: ActivityHistoryItem;
  lotes: Lote[];
  galpones: Galpon[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details className={`activity-history-row activity-history-row--${item.tone}`} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="activity-history-row__time">{item.time}</span>
        <div className="activity-history-row__activity">
          <strong>{item.name}</strong>
          <span className="activity-history-row__category">{item.category}</span>
        </div>
        <span className="activity-history-row__lote">{item.lote} - Dia {item.diaLote}</span>
        <span className="activity-history-row__galpon">{item.galpon}</span>
        <ChevronDown className="activity-history-row__chevron" size={17} aria-hidden="true" />
        {item.note && <small className="activity-history-row__note">{item.note}</small>}
      </summary>
      <ActivityHistoryEditForm
        actividad={item.actividad}
        lotes={lotes}
        galpones={galpones}
        onSaved={() => {
          setOpen(false);
          onSaved();
        }}
      />
    </details>
  );
}

function ActivityHistoryEditForm({
  actividad,
  lotes,
  galpones,
  onSaved,
}: {
  actividad: ActividadLote;
  lotes: Lote[];
  galpones: Galpon[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(() => createActivityEditDraft(actividad));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveActivityEdit(actividad.ActividadLoteID, draft, lotes);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function moveDate(days: number) {
    setDraft((current) => ({ ...current, date: addDays(current.date, days) }));
  }

  return (
    <form className="activity-history-edit-form" onSubmit={handleSubmit}>
      <div className="activity-history-edit-form__quick">
        <button type="button" onClick={() => moveDate(-1)}>Dia anterior</button>
        <button type="button" onClick={() => moveDate(1)}>Dia siguiente</button>
      </div>
      <label className="programming-field programming-field--wide">
        <span>Actividad</span>
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
      </label>
      <label className="programming-field">
        <span>Categoria</span>
        <input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required />
      </label>
      <label className="programming-field">
        <span>Fecha</span>
        <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required />
      </label>
      <label className="programming-field">
        <span>Hora</span>
        <input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
      </label>
      <label className="programming-field">
        <span>Lote</span>
        <select value={draft.loteId} onChange={(event) => setDraft({ ...draft, loteId: event.target.value })}>
          <option value="">Sin lote</option>
          {lotes.map((lote) => (
            <option key={lote.LoteID} value={lote.LoteID}>{lote.CodigoLote}</option>
          ))}
        </select>
      </label>
      <label className="programming-field">
        <span>Galpon</span>
        <select value={draft.galponId} onChange={(event) => setDraft({ ...draft, galponId: event.target.value })}>
          <option value="">Sin galpon</option>
          {galpones.map((galpon) => (
            <option key={galpon.GalponID} value={galpon.GalponID}>{galpon.NombreGalpon}</option>
          ))}
        </select>
      </label>
      <label className="programming-field activity-history-edit-form__note">
        <span>Nota</span>
        <textarea rows={2} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
      </label>
      <button className="activity-history-edit-form__save" type="submit" disabled={saving}>
        <Save size={17} />
        <span>{saving ? 'Guardando...' : 'Guardar'}</span>
      </button>
    </form>
  );
}

interface ActivityEditDraft {
  name: string;
  category: string;
  date: string;
  time: string;
  loteId: string;
  galponId: string;
  note: string;
}

function createActivityEditDraft(actividad: ActividadLote): ActivityEditDraft {
  const dateTime = getActivityEditDateTime(actividad);
  return {
    name: actividad.NombreActividad,
    category: actividad.Categoria,
    date: dateTime.date,
    time: dateTime.time,
    loteId: actividad.LoteID,
    galponId: actividad.GalponID,
    note: actividad.Observacion,
  };
}

function getActivityEditDateTime(actividad: ActividadLote): { date: string; time: string } {
  if (!actividad.FechaRealizada) return { date: actividad.FechaProgramada, time: '' };
  const date = new Date(actividad.FechaRealizada);
  if (!Number.isFinite(date.getTime())) {
    return {
      date: actividad.FechaRealizada.slice(0, 10) || actividad.FechaProgramada,
      time: actividad.FechaRealizada.slice(11, 16),
    };
  }
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

async function saveActivityEdit(activityId: string, draft: ActivityEditDraft, lotes: Lote[]): Promise<void> {
  const actividad = await db.actividadesLote.get(activityId);
  if (!actividad) throw new Error('Actividad no encontrada.');
  const date = draft.date || actividad.FechaProgramada;
  const time = draft.time || '00:00';
  const lote = lotes.find((item) => item.LoteID === draft.loteId);
  const patch: Partial<ActividadLote> = {
    NombreActividad: draft.name.trim(),
    Categoria: draft.category.trim(),
    FechaProgramada: date,
    FechaRealizada: `${date}T${time}:00.000`,
    LoteID: draft.loteId,
    GalponID: draft.galponId,
    DiaLote: lote ? getDiaLote(lote.FechaLlegada, date) : actividad.DiaLote,
    Observacion: draft.note.trim(),
    EstadoSync: 'PENDIENTE',
  };

  await db.transaction('rw', [db.actividadesLote, db.syncQueue], async () => {
    await db.actividadesLote.update(activityId, patch);
    await enqueueSync('ActividadesLote', activityId, 'UPDATE', { ...actividad, ...patch });
  });
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
  selectedLoteId,
  onSelect,
  onGeneratePdf,
}: {
  summaries: LoteResumen[];
  lotes: Lote[];
  selectedLoteId: string;
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
              <tr className={selectedLoteId === summary.LoteID ? 'is-selected' : ''} key={summary.LoteID}>
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

function HojasManejoView({
  lotes,
  selectedLote,
  selectedLoteId,
  onSelectLote,
  registros,
  tipos,
  today,
}: {
  lotes: Lote[];
  selectedLote?: Lote;
  selectedLoteId: string;
  onSelectLote: (loteId: string) => void;
  registros: RegistroDiarioLote[];
  tipos: TipoAlimento[];
  today: string;
}) {
  return (
    <section className="hojas-manejo-view">
      <section className="hojas-manejo-filter" aria-label="Filtrar hojas de manejo por lote">
        <div className="hojas-manejo-filter__heading">
          <span>Filtrar por lote</span>
          <strong>{selectedLote ? `Lote ${selectedLote.CodigoLote}` : 'Sin lote seleccionado'}</strong>
        </div>
        <div className="hojas-manejo-filter__list" role="list">
          {lotes.map((lote) => (
            <button
              className={selectedLoteId === lote.LoteID ? 'is-active' : ''}
              type="button"
              key={lote.LoteID}
              onClick={() => onSelectLote(lote.LoteID)}
              aria-pressed={selectedLoteId === lote.LoteID}
            >
              <span>{lote.CodigoLote}</span>
              <small>{lote.EstadoLote}</small>
            </button>
          ))}
        </div>
      </section>

      {selectedLote ? (
        <LoteDailyHistoryView lote={selectedLote} registros={registros} tipos={tipos} today={today} />
      ) : (
        <MobileCard title="Historial de hojas de manejo" subtitle="Registros diarios">
          <p className="empty-state">Todavia no hay lotes para consultar.</p>
        </MobileCard>
      )}
    </section>
  );
}

function LoteDailyHistoryView({
  lote,
  registros,
  tipos,
  today,
}: {
  lote: Lote;
  registros: RegistroDiarioLote[];
  tipos: TipoAlimento[];
  today: string;
}) {
  const loteRecordsAsc = useMemo(
    () => registros.filter((registro) => registro.LoteID === lote.LoteID).sort((left, right) => left.Fecha.localeCompare(right.Fecha)),
    [lote.LoteID, registros],
  );
  const loteRecordsDesc = useMemo(() => [...loteRecordsAsc].reverse(), [loteRecordsAsc]);
  const tiposById = useMemo(() => new Map(tipos.map((tipo) => [tipo.TipoAlimentoID, tipo.Nombre])), [tipos]);
  const historyEndDate = lote.EstadoLote === 'ACTIVO' ? today : loteRecordsAsc.at(-1)?.Fecha ?? lote.FechaLlegada;
  const missingDates = useMemo(
    () => getMissingDailyRegisterDates(lote.FechaLlegada, historyEndDate, loteRecordsAsc),
    [historyEndDate, lote.FechaLlegada, loteRecordsAsc],
  );
  const expectedDays = historyEndDate >= lote.FechaLlegada ? diffDays(lote.FechaLlegada, historyEndDate) + 1 : 0;
  const totals = loteRecordsAsc.reduce(
    (acc, registro) => ({
      bultos: acc.bultos + registro.BultosConsumidos,
      muertos: acc.muertos + registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar,
      sacrificados: acc.sacrificados + registro.SacrificadosMachos + registro.SacrificadosHembras,
    }),
    { bultos: 0, muertos: 0, sacrificados: 0 },
  );
  const latestDate = loteRecordsAsc.at(-1)?.Fecha ?? 'Sin registros';

  return (
    <MobileCard className="lote-history-card" title={`Historial lote ${lote.CodigoLote}`} subtitle="Registros diarios">
      <section className="lote-history-identity" aria-label="Lote seleccionado">
        <div>
          <span>Lote seleccionado</span>
          <strong>{lote.CodigoLote}</strong>
        </div>
        <div className="lote-history-identity__meta">
          <span>Estado {lote.EstadoLote}</span>
          <span>Inicio {lote.FechaLlegada}</span>
          <span>Corte {historyEndDate}</span>
        </div>
      </section>

      <section className="stats-grid stats-grid--wide lote-history-stats">
        <StatCard label="Ultima fecha" value={latestDate} />
        <StatCard label="Registrados" value={`${fmtNumber(loteRecordsAsc.length)} / ${fmtNumber(expectedDays)}`} tone={missingDates.length ? 'warn' : 'good'} />
        <StatCard label="Fechas faltantes" value={fmtNumber(missingDates.length)} tone={missingDates.length ? 'warn' : 'good'} />
        <StatCard label="Alimento acum." value={`${fmtNumber(totals.bultos, 1)} bultos`} />
        <StatCard label="Muertos total" value={fmtNumber(totals.muertos)} />
        <StatCard label="Sacrificio" value={fmtNumber(totals.sacrificados)} />
      </section>

      {missingDates.length > 0 && (
        <div className="lote-history-alert" role="alert">
          <strong>Faltan fechas por registrar</strong>
          <span>{missingDates.slice(0, 10).join(', ')}{missingDates.length > 10 ? ` y ${missingDates.length - 10} mas` : ''}</span>
        </div>
      )}

      {loteRecordsDesc.length ? (
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
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {loteRecordsDesc.map((registro) => {
                const muertosTotal = registro.MuertosMachos + registro.MuertosHembras + registro.MuertosSinClasificar;
                const muertosDetalle = registro.MuertosSinClasificar > 0
                  ? `${fmtNumber(registro.MuertosMachos)} M + ${fmtNumber(registro.MuertosHembras)} H + ${fmtNumber(registro.MuertosSinClasificar)} sin clasificar`
                  : `${fmtNumber(registro.MuertosMachos)} M + ${fmtNumber(registro.MuertosHembras)} H`;
                const sacrificados = registro.SacrificadosMachos + registro.SacrificadosHembras;
                return (
                  <tr key={registro.RegistroDiarioID}>
                    <td data-label="Fecha">{registro.Fecha}</td>
                    <td data-label="Dia">{registro.DiaLote}</td>
                    <td data-label="Alimento">{tiposById.get(registro.TipoAlimentoID) ?? registro.TipoAlimentoID}</td>
                    <td data-label="Bultos">{fmtNumber(registro.BultosConsumidos, 1)}</td>
                    <td data-label="Muertos M/H">{muertosDetalle}</td>
                    <td data-label="Muertos total">{fmtNumber(muertosTotal)}</td>
                    <td data-label="Sacrificio">{fmtNumber(sacrificados)}</td>
                    <td data-label="Sync">
                      <span className={`activity-history-sync activity-history-sync--${registro.EstadoSync.toLowerCase()}`}>{getSyncLabel(registro.EstadoSync)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">Este lote todavia no tiene registros diarios.</p>
      )}
    </MobileCard>
  );
}

type EntryHistoryKind = 'alimento' | 'cisco' | 'gas';

interface EntryHistoryItem {
  id: string;
  kind: EntryHistoryKind;
  date: string;
  timestamp: number;
  typeLabel: string;
  name: string;
  quantity: number;
  unit: string;
  note: string;
}

function EntradasHistoryView({
  entradasAlimento,
  entradasMaterial,
  tipos,
  today,
}: {
  entradasAlimento: EntradaAlimento[];
  entradasMaterial: EntradaMaterial[];
  tipos: TipoAlimento[];
  today: string;
}) {
  const history = useMemo(
    () => buildEntryHistory({ entradasAlimento, entradasMaterial, tipos }),
    [entradasAlimento, entradasMaterial, tipos],
  );
  const totals = useMemo(() => getEntryHistoryTotals(history), [history]);

  return (
    <section className="entry-history-view">
      <section className="stats-grid stats-grid--wide entry-history-stats">
        <StatCard label="Entradas" value={fmtNumber(history.length)} />
        <StatCard label="Alimento" value={`${fmtNumber(totals.alimento, 1)} bultos`} />
        <StatCard label="Cisco" value={`${fmtNumber(totals.cisco, 1)} pacas`} />
        <StatCard label="Gas" value={`${fmtNumber(totals.gas, 1)} cilindros`} />
      </section>

      <MobileCard title="Historial de entradas" subtitle="Alimento, cisco y gas ordenados por fecha">
        {history.length ? (
          <div className="entry-history-list">
            {history.map((item) => (
              <article className={`entry-history-row entry-history-row--${item.kind}`} key={item.id}>
                <span className="entry-history-row__image" aria-label={item.typeLabel}>
                  {getEntryHistoryIcon(item.kind)}
                </span>
                <div className="entry-history-row__main">
                  <span className="entry-history-row__date">
                    {item.date} - {formatActivityDate(item.date, today)}
                  </span>
                  <strong>{item.name}</strong>
                  <small>{item.typeLabel}</small>
                  {item.note && <em>{item.note}</em>}
                </div>
                <div className="entry-history-row__quantity" aria-label="Cantidad">
                  <strong>{fmtNumber(item.quantity, 1)}</strong>
                  <span>{item.unit}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavia no hay entradas registradas por Galponero.</p>
        )}
      </MobileCard>
    </section>
  );
}

function buildEntryHistory({
  entradasAlimento,
  entradasMaterial,
  tipos,
}: {
  entradasAlimento: EntradaAlimento[];
  entradasMaterial: EntradaMaterial[];
  tipos: TipoAlimento[];
}): EntryHistoryItem[] {
  const tiposById = new Map(tipos.map((tipo) => [tipo.TipoAlimentoID, tipo.Nombre]));
  const foodEntries: EntryHistoryItem[] = entradasAlimento.map((entrada) => ({
    id: entrada.EntradaAlimentoID,
    kind: 'alimento',
    date: entrada.Fecha,
    timestamp: getTimestamp(`${entrada.Fecha}T12:00:00`),
    typeLabel: 'Alimento',
    name: tiposById.get(entrada.TipoAlimentoID) ?? 'Alimento sin tipo',
    quantity: entrada.CantidadBultos,
    unit: 'bultos',
    note: entrada.Observaciones.trim(),
  }));
  const materialEntries: EntryHistoryItem[] = entradasMaterial.map((entrada) => {
    const kind: EntryHistoryKind = entrada.TipoMaterial === 'GAS' ? 'gas' : 'cisco';
    return {
      id: entrada.EntradaMaterialID,
      kind,
      date: entrada.Fecha,
      timestamp: getTimestamp(entrada.FechaHoraRegistro || `${entrada.Fecha}T12:00:00`),
      typeLabel: getEntryHistoryLabel(kind),
      name: getEntryHistoryLabel(kind),
      quantity: entrada.Cantidad,
      unit: getEntryHistoryUnit(entrada.Unidad, kind),
      note: entrada.Observaciones.trim(),
    };
  });

  return [...foodEntries, ...materialEntries].sort((left, right) => right.timestamp - left.timestamp || left.name.localeCompare(right.name));
}

function getEntryHistoryTotals(history: EntryHistoryItem[]): Record<EntryHistoryKind, number> {
  return history.reduce(
    (acc, item) => {
      acc[item.kind] += item.quantity;
      return acc;
    },
    { alimento: 0, cisco: 0, gas: 0 },
  );
}

function getEntryHistoryLabel(kind: EntryHistoryKind): string {
  const labels: Record<EntryHistoryKind, string> = {
    alimento: 'Alimento',
    cisco: 'Cisco',
    gas: 'Gas',
  };
  return labels[kind];
}

function getEntryHistoryUnit(unit: string, kind: EntryHistoryKind): string {
  if (unit) return unit.toLowerCase();
  if (kind === 'cisco') return 'pacas';
  if (kind === 'gas') return 'cilindros';
  return 'bultos';
}

function getEntryHistoryIcon(kind: EntryHistoryKind): ReactNode {
  if (kind === 'alimento') return <PackagePlus size={28} />;
  if (kind === 'cisco') return <Warehouse size={28} />;
  return <Flame size={28} />;
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
