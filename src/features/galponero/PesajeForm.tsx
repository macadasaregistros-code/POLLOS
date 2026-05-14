import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PesoInput } from '../../components/PesoInput';
import { calculatePesajeStats, compareAgainstStandard } from '../../services/calculationsService';
import { registrarPesaje } from '../../services/domainService';
import { db } from '../../services/localDbService';
import { getDiaLote, getSemanaLote, todayISO } from '../../lib/date';
import { fmtKg, fmtNumber, fmtPercent } from '../../lib/format';
import type { Lote, Usuario } from '../../types/entities';

interface PesajeFormProps {
  lote: Lote;
  user: Usuario;
  onSaved: (message: string) => void;
}

export function PesajeForm({ lote, user, onSaved }: PesajeFormProps) {
  const curvas = useLiveQuery(() => db.curvasEstandar.toArray(), []);
  const [pesosMachos, setPesosMachos] = useState<number[]>([]);
  const [pesosHembras, setPesosHembras] = useState<number[]>([]);
  const [pesoActual, setPesoActual] = useState('');
  const [lastPesajeId, setLastPesajeId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const diaActual = getDiaLote(lote.FechaLlegada, todayISO());

  const currentSexo = pesosMachos.length < 50 ? 'MACHO' : 'HEMBRA';
  const currentIndex = currentSexo === 'MACHO' ? pesosMachos.length + 1 : pesosHembras.length + 1;
  const complete = pesosMachos.length === 50 && pesosHembras.length === 50;
  const stats = useMemo(
    () =>
      calculatePesajeStats([
        ...pesosMachos.map((PesoGramos) => ({ Sexo: 'MACHO' as const, PesoGramos })),
        ...pesosHembras.map((PesoGramos) => ({ Sexo: 'HEMBRA' as const, PesoGramos })),
      ]),
    [pesosMachos, pesosHembras],
  );

  async function saveCurrent() {
    const parsed = Number(pesoActual);
    if (!Number.isFinite(parsed) || parsed <= 0 || complete) return;
    const nextMachos = currentSexo === 'MACHO' ? [...pesosMachos, parsed] : pesosMachos;
    const nextHembras = currentSexo === 'HEMBRA' ? [...pesosHembras, parsed] : pesosHembras;
    setPesosMachos(nextMachos);
    setPesosHembras(nextHembras);
    setPesoActual('');

    if (nextMachos.length === 50 && nextHembras.length === 50) {
      setSaving(true);
      try {
        const pesaje = await registrarPesaje(
          {
            LoteID: lote.LoteID,
            Fecha: todayISO(),
            pesosMachos: nextMachos,
            pesosHembras: nextHembras,
          },
          user,
        );
        setLastPesajeId(pesaje.PesajeID);
        onSaved('Pesaje completo guardado offline.');
      } finally {
        setSaving(false);
      }
    }
  }

  const diff = lastPesajeId
    ? compareAgainstStandard(
        {
          PesajeID: lastPesajeId,
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
        },
        curvas ?? [],
        lote,
      )
    : 0;

  return (
    <div className="stack">
      <div className="progress-row">
        <span>Machos {pesosMachos.length}/50</span>
        <span>Hembras {pesosHembras.length}/50</span>
      </div>
      {!complete ? (
        <PesoInput
          label={`${currentSexo === 'MACHO' ? 'Macho' : 'Hembra'} ${currentIndex} de 50`}
          value={pesoActual}
          onChange={setPesoActual}
          onSave={saveCurrent}
          disabled={saving}
        />
      ) : (
        <div className="summary-box">
          <strong>Resumen del pesaje</strong>
          <span>Promedio machos: {fmtKg(stats.promedioMachos / 1000, 3)}</span>
          <span>Promedio hembras: {fmtKg(stats.promedioHembras / 1000, 3)}</span>
          <span>Promedio general: {fmtKg(stats.promedioGeneral / 1000, 3)}</span>
          <span>Uniformidad machos: {fmtPercent(stats.uniformidadMachos)}</span>
          <span>Uniformidad hembras: {fmtPercent(stats.uniformidadHembras)}</span>
          <span>Diferencia contra estándar: {fmtNumber(diff, 0)} g</span>
          <button
            type="button"
            onClick={() => {
              setPesosMachos([]);
              setPesosHembras([]);
              setLastPesajeId('');
            }}
          >
            Iniciar otro pesaje
          </button>
        </div>
      )}
    </div>
  );
}
