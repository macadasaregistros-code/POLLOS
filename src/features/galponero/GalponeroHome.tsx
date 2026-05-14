import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, ClipboardCheck, Droplets, Scale, ShieldAlert, ShoppingCart, Syringe, Truck, Wheat } from 'lucide-react';
import { GalponMap } from '../../components/GalponMap';
import { MobileCard } from '../../components/MobileCard';
import { StatCard } from '../../components/StatCard';
import { buildLoteResumen } from '../../services/calculationsService';
import { db } from '../../services/localDbService';
import { todayISO } from '../../lib/date';
import { fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type { Lote, LoteResumen, Usuario } from '../../types/entities';
import { RegistrarDiaForm } from './RegistrarDiaForm';
import { PesajeForm } from './PesajeForm';
import { ActividadesHoy } from './ActividadesHoy';
import { VacunasView } from './VacunasView';
import { EntradaAlimentoForm } from './EntradaAlimentoForm';
import { SalidaForm } from './SalidaForm';
import { AguaForm } from './AguaForm';
import { EventoSanitarioForm } from './EventoSanitarioForm';

type GalponeroAction = 'dia' | 'actividades' | 'pesaje' | 'vacunas' | 'entrada' | 'salida' | 'agua' | 'evento';

interface GalponeroHomeProps {
  user: Usuario;
  onToast: (message: string) => void;
}

const actionMeta: Record<GalponeroAction, { label: string; icon: ReactNode }> = {
  dia: { label: 'Registrar día', icon: <ClipboardCheck size={22} /> },
  actividades: { label: 'Actividades de hoy', icon: <Activity size={22} /> },
  pesaje: { label: 'Pesaje', icon: <Scale size={22} /> },
  vacunas: { label: 'Vacunas', icon: <Syringe size={22} /> },
  entrada: { label: 'Entrada alimento', icon: <Truck size={22} /> },
  salida: { label: 'Venta / salida', icon: <ShoppingCart size={22} /> },
  agua: { label: 'Agua', icon: <Droplets size={22} /> },
  evento: { label: 'Evento sanitario', icon: <ShieldAlert size={22} /> },
};

export function GalponeroHome({ user, onToast }: GalponeroHomeProps) {
  const today = todayISO();
  const lotes = useLiveQuery(() => db.lotes.where('EstadoLote').equals('ACTIVO').toArray(), []);
  const registros = useLiveQuery(() => db.registroDiarioLote.toArray(), []);
  const consumos = useLiveQuery(() => db.consumosAlimentoLote.toArray(), []);
  const pesajes = useLiveQuery(() => db.pesajes.toArray(), []);
  const loteGalpones = useLiveQuery(() => db.loteGalpones.toArray(), []);
  const galpones = useLiveQuery(() => db.galpones.toArray(), []);
  const actividades = useLiveQuery(() => db.actividadesLote.toArray(), []);
  const vacunas = useLiveQuery(() => db.vacunasLote.toArray(), []);
  const syncQueue = useLiveQuery(() => db.syncQueue.toArray(), []);
  const inventario = useLiveQuery(() => db.inventarioAlimento.toArray(), []);
  const tipos = useLiveQuery(() => db.tiposAlimento.toArray(), []);
  const [selectedLoteId, setSelectedLoteId] = useState<string>('');
  const [activeAction, setActiveAction] = useState<GalponeroAction>('dia');

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

  const selectedSummary = summaries.find((summary) => summary.LoteID === (selectedLoteId || summaries[0]?.LoteID)) ?? summaries[0];
  const selectedLote = lotes?.find((lote) => lote.LoteID === selectedSummary?.LoteID);

  return (
    <main className="page-shell page-shell--mobile">
      <section className="page-title">
        <div>
          <span>GALPONERO</span>
          <h1>POLLOS</h1>
        </div>
        <Wheat size={34} />
      </section>

      <GalponMap
        galpones={galpones ?? []}
        loteGalpones={loteGalpones ?? []}
        lotes={lotes ?? []}
        summaries={summaries}
        selectedLoteId={selectedSummary?.LoteID}
        onSelectLote={setSelectedLoteId}
      />

      {selectedSummary && (
        <MobileCard className="selected-lote-card">
          <LoteSummary summary={selectedSummary} />
        </MobileCard>
      )}

      {selectedLote && selectedSummary && (
        <>
          <section className="quick-actions">
            {(Object.keys(actionMeta) as GalponeroAction[]).map((action) => (
              <button
                key={action}
                className={activeAction === action ? 'is-active' : ''}
                type="button"
                onClick={() => setActiveAction(action)}
              >
                {actionMeta[action].icon}
                <span>{actionMeta[action].label}</span>
              </button>
            ))}
          </section>

          <MobileCard title={actionMeta[activeAction].label} subtitle={selectedLote.CodigoLote}>
            {activeAction === 'dia' && <RegistrarDiaForm lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'actividades' && <ActividadesHoy lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'pesaje' && <PesajeForm lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'vacunas' && <VacunasView lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'entrada' && <EntradaAlimentoForm user={user} onSaved={onToast} />}
            {activeAction === 'salida' && <SalidaForm lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'agua' && <AguaForm lote={selectedLote} user={user} onSaved={onToast} />}
            {activeAction === 'evento' && <EventoSanitarioForm lote={selectedLote} user={user} onSaved={onToast} />}
          </MobileCard>
        </>
      )}

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
    </main>
  );
}

function LoteSummary({ summary }: { summary: LoteResumen }) {
  return (
    <div className="lote-summary">
      <header>
        <div>
          <strong>{summary.CodigoLote}</strong>
          <span>Día {summary.DiaLote}</span>
        </div>
        <small>{summary.Galpones.join(', ') || 'Sin galpón'}</small>
      </header>
      <div className="stats-grid">
        <StatCard label="Machos vivos" value={fmtNumber(summary.MachosVivos)} />
        <StatCard label="Hembras vivas" value={fmtNumber(summary.HembrasVivas)} />
        <StatCard label="Pendientes" value={fmtNumber(summary.PendientesHoy)} tone={summary.PendientesHoy > 0 ? 'warn' : 'good'} />
        <StatCard label="Sync" value={fmtNumber(summary.SyncPendiente)} tone={summary.SyncPendiente > 0 ? 'warn' : 'good'} />
      </div>
      <div className="mini-metrics">
        <span>Mortalidad {fmtPercent(summary.MortalidadAcumulada)}</span>
        <span>Consumo {fmtKg(summary.ConsumoAcumuladoKg)}</span>
        <span>Peso {fmtKg(summary.PesoPromedioGeneralKg, 2)}</span>
        <span>CA {fmtNumber(summary.ConversionAlimenticia, 2)}</span>
      </div>
    </div>
  );
}
