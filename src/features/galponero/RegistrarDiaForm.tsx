import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarDays, ClipboardCheck, HeartPulse, Save, Scissors, Wheat } from 'lucide-react';
import { FormOptionalPanel } from '../../components/FormOptionalPanel';
import { registrarDia } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { getDiaLote, todayISO } from '../../lib/date';
import type { Lote, Usuario } from '../../types/entities';
import { FoodTypeSelector, getFeedTypeOptions } from './FeedTypeSelector';

interface RegistrarDiaFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
  onBack?: () => void;
}

const dailyShortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

export function RegistrarDiaForm({ lote, user, onSaved, onBack }: RegistrarDiaFormProps) {
  const tiposAlimento = useLiveQuery(() => db.tiposAlimento.toArray().then((items) => items.filter((item) => item.Activo)), []);
  const registrosLote = useLiveQuery(() => db.registroDiarioLote.where('LoteID').equals(lote.LoteID).toArray(), [lote.LoteID]);
  const salidasLote = useLiveQuery(() => db.salidasPollo.where('LoteID').equals(lote.LoteID).toArray(), [lote.LoteID]);
  const today = todayISO();
  const diaLote = getDiaLote(lote.FechaLlegada, today);
  const [tipoAlimentoId, setTipoAlimentoId] = useState('');
  const [bultos, setBultos] = useState('0');
  const [muertosM, setMuertosM] = useState('0');
  const [muertosH, setMuertosH] = useState('0');
  const [sacrificadosM, setSacrificadosM] = useState('0');
  const [sacrificadosH, setSacrificadosH] = useState('0');
  const [sacrificioActivo, setSacrificioActivo] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tipoOptions = useMemo(() => getFeedTypeOptions(tiposAlimento ?? []), [tiposAlimento]);
  const defaultTipo = tipoOptions[0]?.tipo.TipoAlimentoID ?? '';
  const latestTipoAlimentoId = useMemo(() => getLatestTipoAlimentoId(registrosLote ?? [], tipoOptions), [registrosLote, tipoOptions]);
  const currentTipoId = tipoAlimentoId || latestTipoAlimentoId || defaultTipo;
  const selectedTipo = tipoOptions.find((option) => option.tipo.TipoAlimentoID === currentTipoId)?.tipo;
  const todayRecord = (registrosLote ?? []).find((registro) => registro.Fecha === today);
  const sacrificeStorageKey = `pollos.sacrificioActivo.${lote.LoteID}`;
  const sacrificeCanStart = diaLote > 35;
  const sacrificeAlreadyStarted = useMemo(
    () =>
      (registrosLote ?? []).some((registro) => registro.SacrificadosMachos + registro.SacrificadosHembras > 0) ||
      (salidasLote ?? []).some((salida) => salida.TipoSalida === 'SACRIFICIO'),
    [registrosLote, salidasLote],
  );
  const kgConsumidos = Number(bultos || 0) * (selectedTipo?.KgPorBulto ?? 40);

  useEffect(() => {
    setTipoAlimentoId(latestTipoAlimentoId || defaultTipo);
  }, [defaultTipo, latestTipoAlimentoId, lote.LoteID]);

  useEffect(() => {
    const stored = window.localStorage.getItem(sacrificeStorageKey) === '1';
    setSacrificioActivo(sacrificeCanStart && (stored || sacrificeAlreadyStarted));
  }, [lote.LoteID, sacrificeAlreadyStarted, sacrificeCanStart, sacrificeStorageKey]);

  function handleActivateSacrifice() {
    if (!sacrificeCanStart) return;
    window.localStorage.setItem(sacrificeStorageKey, '1');
    setSacrificioActivo(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentTipoId || todayRecord || saving) return;
    setError('');
    setSaving(true);
    try {
      await registrarDia(
        {
          LoteID: lote.LoteID,
          Fecha: today,
          TipoAlimentoID: currentTipoId,
          BultosConsumidos: Number(bultos || 0),
          MuertosMachos: Number(muertosM || 0),
          MuertosHembras: Number(muertosH || 0),
          MuertosSinClasificar: 0,
          SacrificadosMachos: sacrificioActivo ? Number(sacrificadosM || 0) : 0,
          SacrificadosHembras: sacrificioActivo ? Number(sacrificadosH || 0) : 0,
          Observaciones: observacion,
        },
        user,
      );
      setBultos('0');
      setMuertosM('0');
      setMuertosH('0');
      setSacrificadosM('0');
      setSacrificadosH('0');
      setObservacion('');
      onSaved('Registro diario guardado en este dispositivo.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el registro diario.');
    } finally {
      setSaving(false);
    }
  }

  if (todayRecord) {
    return (
      <div className="daily-register-complete-layout">
        <DailyRegisterDateCard
          date={today}
          loteCode={lote.CodigoLote}
          diaLote={diaLote}
          status={todayRecord.EstadoSync === 'SINCRONIZADO' ? 'Guardado' : 'Por enviar'}
          onBack={onBack}
        />
        <div className="daily-register-complete" role="status">
          <strong>Registro diario completado</strong>
          <span>Este lote ya fue registrado hoy. No se descontará alimento ni se sumará mortalidad nuevamente.</span>
          <small>{todayRecord.EstadoSync === 'SINCRONIZADO' ? 'Guardado en Supabase' : 'Guardado y pendiente por enviar'}</small>
        </div>
      </div>
    );
  }

  return (
    <form className={`form-grid daily-register-form flow-form ${sacrificeCanStart ? 'daily-register-form--with-sacrifice' : ''}`} onSubmit={handleSubmit}>
      <DailyRegisterDateCard date={today} loteCode={lote.CodigoLote} diaLote={diaLote} status="Pendiente" onBack={onBack} />

      <section className="water-form-card daily-register-main-card">
        <header className="daily-register-main-card__header">
          <span className="daily-register-main-card__icon" aria-hidden="true">
            <ClipboardCheck size={42} />
          </span>
          <strong>REGISTRO DIARIO</strong>
        </header>

        <div className="daily-register-content-layout">
          <section className="daily-register-form__section daily-register-form__section--feed">
            <DailySectionTitle icon={<Wheat size={28} />} title="Alimentación" />
            <div className="form-grid">
              <FoodTypeSelector options={tipoOptions} selectedTipoId={currentTipoId} onSelect={setTipoAlimentoId} className="daily-register-food-selector" />
              <label className="field">
                <span>Bultos hoy</span>
                <input
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.25"
                  value={bultos}
                  onChange={(event) => setBultos(event.target.value)}
                />
                <small>{kgConsumidos.toFixed(1)} kg calculados</small>
              </label>
            </div>
          </section>

          <section className="daily-register-form__section daily-register-form__section--mortality">
            <DailySectionTitle icon={<HeartPulse size={28} />} title="Mortalidad" />
            <div className="count-button-grid">
              <CountButton label="Machos" value={muertosM} onChange={setMuertosM} />
              <CountButton label="Hembras" value={muertosH} onChange={setMuertosH} />
            </div>
          </section>

          {sacrificeCanStart && (
            <section className="daily-register-form__section daily-register-form__section--sacrifice">
              <DailySectionTitle icon={<Scissors size={28} />} title="Sacrificio" />
              {sacrificioActivo ? (
                <div className="count-button-grid">
                  <CountButton label="Machos" value={sacrificadosM} onChange={setSacrificadosM} />
                  <CountButton label="Hembras" value={sacrificadosH} onChange={setSacrificadosH} />
                </div>
              ) : (
                <button className="sacrifice-start-button" type="button" onClick={handleActivateSacrifice}>
                  Activar sacrificio para este lote
                </button>
              )}
            </section>
          )}
        </div>
      </section>

      <FormOptionalPanel label="Observacion" value={observacion}>
      <label className="field field--full field--nested">
        <span>Observación</span>
        <textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} rows={3} />
      </label>
      </FormOptionalPanel>
      {error && <p className="water-form-error daily-register-error" role="alert">{error}</p>}
      <button className="primary-action" disabled={saving || !currentTipoId}>
        <Save size={21} />
        <span>{saving ? 'Guardando...' : 'Guardar registro diario'}</span>
      </button>
    </form>
  );
}

function CountButton({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const current = Number(value || 0);

  function setNext(nextValue: number) {
    onChange(String(Math.max(0, nextValue)));
  }

  return (
    <div className="count-button">
      <span>{label}</span>
      <div>
        <button type="button" aria-label={`Restar ${label}`} onClick={() => setNext(current - 1)}>
          -
        </button>
        <input inputMode="numeric" type="number" min="0" value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" aria-label={`Sumar ${label}`} onClick={() => setNext(current + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

function DailySectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <header className="daily-register-section-title">
      <span aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
    </header>
  );
}

function DailyRegisterDateCard({
  date,
  loteCode,
  diaLote,
  status,
  onBack,
}: {
  date: string;
  loteCode: string;
  diaLote: number;
  status: string;
  onBack?: () => void;
}) {
  return (
    <section className={`water-date-card daily-register-date-card ${onBack ? 'daily-register-date-card--with-back' : ''}`} aria-label="Fecha y estado del registro">
      {onBack && (
        <button className="daily-register-back-button" type="button" aria-label="Volver a hoy" onClick={onBack}>
          <ArrowLeft size={24} />
        </button>
      )}
      <span className="water-date-card__icon">
        <CalendarDays size={30} />
      </span>
      <div className="water-date-card__date">
        <span>Fecha de Registro</span>
        <strong>{formatDailyDate(date)}</strong>
        <small>{loteCode} · Dia {diaLote}</small>
      </div>
      <div className="water-date-card__status">
        <span>Estado</span>
        <strong>{status}</strong>
      </div>
    </section>
  );
}

function formatDailyDate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  return `${day} ${dailyShortMonths[month - 1] ?? ''} ${year}`;
}

function getLatestTipoAlimentoId(
  registros: Array<{ Fecha: string; FechaHoraRegistro: string; TipoAlimentoID: string }>,
  tipoOptions: ReturnType<typeof getFeedTypeOptions>,
): string {
  const validIds = new Set(tipoOptions.map((option) => option.tipo.TipoAlimentoID));
  return (
    registros
      .filter((registro) => validIds.has(registro.TipoAlimentoID))
      .sort((left, right) => right.Fecha.localeCompare(left.Fecha) || right.FechaHoraRegistro.localeCompare(left.FechaHoraRegistro))[0]
      ?.TipoAlimentoID ?? ''
  );
}
