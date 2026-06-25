import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save, Trash2 } from 'lucide-react';
import { calculatePesajeStats, compareAgainstStandard } from '../../services/calculationsService';
import { registrarPesaje } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { getDiaLote, getSemanaLote, todayISO } from '../../lib/date';
import { fmtNumber, fmtPercent } from '../../lib/format';
import type { Lote, Pesaje, PesajeDetalle, Usuario } from '../../types/entities';

interface PesajeFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void | Promise<void>;
}

type PesajeSexo = PesajeDetalle['Sexo'];

interface PesoDraft {
  id: string;
  Sexo: PesajeSexo;
  PesoGramos: number;
}

export function PesajeForm({ lote, user, onSaved }: PesajeFormProps) {
  const curvas = useLiveQuery(() => db.curvasEstandar.toArray(), []);
  const [pesos, setPesos] = useState<PesoDraft[]>([]);
  const [sexo, setSexo] = useState<PesajeSexo>('MACHO');
  const [pesoActual, setPesoActual] = useState('');
  const [lastPesajeId, setLastPesajeId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const diaActual = getDiaLote(lote.FechaLlegada, todayISO());
  const stats = useMemo(
    () => calculatePesajeStats(pesos.map((peso) => ({ Sexo: peso.Sexo, PesoGramos: peso.PesoGramos }))),
    [pesos],
  );
  const totalAves = stats.cantidadMachos + stats.cantidadHembras;
  const draftPesaje = useMemo<Pesaje | undefined>(() => {
    if (!totalAves) return undefined;
    return {
      PesajeID: lastPesajeId || 'pesaje_borrador',
      Fecha: todayISO(),
      LoteID: lote.LoteID,
      DiaLote: diaActual,
      SemanaLote: getSemanaLote(diaActual),
      CantidadMachosPesados: stats.cantidadMachos,
      CantidadHembrasPesadas: stats.cantidadHembras,
      PesoPromedioMachos: stats.promedioMachos,
      PesoPromedioHembras: stats.promedioHembras,
      PesoPromedioGeneral: stats.promedioGeneral,
      PesoMinimoMachos: stats.minimoMachos,
      PesoMaximoMachos: stats.maximoMachos,
      PesoMinimoHembras: stats.minimoHembras,
      PesoMaximoHembras: stats.maximoHembras,
      UniformidadMachos: stats.uniformidadMachos,
      UniformidadHembras: stats.uniformidadHembras,
      RegistradoPor: user.UsuarioID,
      FechaHoraRegistro: '',
      EstadoSync: 'PENDIENTE',
    };
  }, [diaActual, lastPesajeId, lote.LoteID, stats, totalAves, user.UsuarioID]);
  const diff = draftPesaje ? compareAgainstStandard(draftPesaje, curvas ?? [], lote) : 0;
  const recentWeights = pesos.slice(-8).reverse();

  function addCurrentWeight() {
    const parsed = Number(pesoActual);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Ingresa un peso valido en gramos.');
      return;
    }
    setPesos((current) => [
      ...current,
      {
        id: `${Date.now()}_${current.length}`,
        Sexo: sexo,
        PesoGramos: parsed,
      },
    ]);
    setPesoActual('');
    setError('');
    setLastPesajeId('');
  }

  function removeLastWeight() {
    setPesos((current) => current.slice(0, -1));
    setLastPesajeId('');
  }

  function removeWeight(id: string) {
    setPesos((current) => current.filter((peso) => peso.id !== id));
    setLastPesajeId('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedPendingWeight = Number(pesoActual);
    if (pesoActual && (!Number.isFinite(parsedPendingWeight) || parsedPendingWeight <= 0)) {
      setError('Ingresa un peso valido en gramos.');
      return;
    }
    const pesosToSave = pesoActual
      ? [...pesos, { id: `${Date.now()}_${pesos.length}`, Sexo: sexo, PesoGramos: parsedPendingWeight }]
      : pesos;

    if (!pesosToSave.length) {
      setError('Agrega al menos un peso antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      setPesos(pesosToSave);
      setPesoActual('');
      const pesaje = await registrarPesaje(
        {
          LoteID: lote.LoteID,
          Fecha: todayISO(),
          pesosMachos: pesosToSave.filter((peso) => peso.Sexo === 'MACHO').map((peso) => peso.PesoGramos),
          pesosHembras: pesosToSave.filter((peso) => peso.Sexo === 'HEMBRA').map((peso) => peso.PesoGramos),
        },
        user,
      );
      setLastPesajeId(pesaje.PesajeID);
      setError('');
      await onSaved('Pesaje guardado en este dispositivo.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el pesaje.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="pesaje-form" onSubmit={handleSubmit}>
      <section className="pesaje-entry-card">
        <div className="pesaje-sex-toggle" role="radiogroup" aria-label="Sexo del pollo">
          {(['MACHO', 'HEMBRA'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={sexo === option ? 'is-selected' : ''}
              aria-pressed={sexo === option}
              onClick={() => setSexo(option)}
            >
              {option === 'MACHO' ? 'Macho' : 'Hembra'}
            </button>
          ))}
        </div>
        <label className="field pesaje-weight-field">
          <span>Peso en gramos</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={pesoActual}
            autoFocus
            onChange={(event) => setPesoActual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCurrentWeight();
              }
            }}
          />
        </label>
        <button className="secondary-action" type="button" onClick={addCurrentWeight} disabled={saving || Number(pesoActual) <= 0}>
          Guardar pollo
        </button>
      </section>

      <section className="pesaje-summary-grid" aria-label="Resumen del pesaje">
        <div>
          <span>Machos</span>
          <strong>{fmtNumber(stats.cantidadMachos)}</strong>
        </div>
        <div>
          <span>Hembras</span>
          <strong>{fmtNumber(stats.cantidadHembras)}</strong>
        </div>
        <div>
          <span>Prom. general</span>
          <strong>{fmtNumber(stats.promedioGeneral, 0)} g</strong>
        </div>
        <div>
          <span>Contra estandar</span>
          <strong>{fmtNumber(diff, 0)} g</strong>
        </div>
      </section>

      <section className="pesaje-detail-card" aria-label="Detalle de pesos">
        <header>
          <strong>{fmtNumber(totalAves)} pollos anotados</strong>
          <button type="button" onClick={removeLastWeight} disabled={!totalAves || saving}>
            <Trash2 size={17} />
            <span>Borrar ultimo</span>
          </button>
        </header>
        {recentWeights.length > 0 ? (
          <div className="pesaje-weight-list">
            {recentWeights.map((peso, index) => (
              <div key={peso.id}>
                <span>{peso.Sexo === 'MACHO' ? 'Macho' : 'Hembra'} {totalAves - index}</span>
                <strong>{fmtNumber(peso.PesoGramos, 0)} g</strong>
                <button type="button" aria-label="Eliminar peso" onClick={() => removeWeight(peso.id)} disabled={saving}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">Anota el primer pollo para ver el resumen.</p>
        )}
      </section>

      {totalAves > 0 && (
        <section className="summary-box pesaje-stats-box">
          <strong>Resumen</strong>
          <span>Promedio machos: {fmtNumber(stats.promedioMachos, 0)} g</span>
          <span>Promedio hembras: {fmtNumber(stats.promedioHembras, 0)} g</span>
          <span>Uniformidad machos: {fmtPercent(stats.uniformidadMachos)}</span>
          <span>Uniformidad hembras: {fmtPercent(stats.uniformidadHembras)}</span>
        </section>
      )}

      {error && <p className="form-error">{error}</p>}

      <button className="primary-action" type="submit" disabled={saving || !totalAves}>
        <Save size={21} />
        <span>{saving ? 'Guardando...' : 'Guardar pesaje'}</span>
      </button>
    </form>
  );
}
