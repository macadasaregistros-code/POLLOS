import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, RefreshCcw, Save } from 'lucide-react';
import { MobileCard } from '../../components/MobileCard';
import {
  guardarActividadProgramada,
  guardarPerroProgramacion,
  guardarPlanVacunalBase,
  regenerarProgramacionFutura,
} from '../../services/adminService';
import { getDogNextDate } from '../../services/agendaService';
import { db } from '../../services/localDbService';
import type { ActividadProgramada, Perro, PlanVacunalBase, Usuario } from '../../types/entities';

interface ProgramacionViewProps {
  user: Usuario;
  onToast: (message: string) => void;
}

const frequencyOptions: ActividadProgramada['TipoFrecuencia'][] = ['UNICA', 'DIARIA', 'CADA_3_DIAS', 'SEMANAL', 'SEGUN_DIA_LOTE'];

export function ProgramacionView({ user, onToast }: ProgramacionViewProps) {
  const actividades = useLiveQuery(() => db.actividadesProgramadas.toArray(), []) ?? [];
  const vacunas = useLiveQuery(() => db.planVacunalBase.toArray(), []) ?? [];
  const perros = useLiveQuery(() => db.perros.toArray(), []) ?? [];
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await regenerarProgramacionFutura(user);
      onToast(`${result.actividades} actividades y ${result.vacunas} vacunas futuras regeneradas.`);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <section className="programming-view">
      <MobileCard title="Programacion activa" subtitle="Reglas que la app usa para armar HOY">
        <div className="programming-summary">
          <span><strong>{actividades.filter((item) => item.Activa).length}</strong> actividades activas</span>
          <span><strong>{vacunas.filter((item) => item.Activa).length}</strong> vacunas base</span>
          <span><strong>{perros.filter((item) => item.Activo).length}</strong> perros activos</span>
        </div>
        <button className="primary-action primary-action--icon" type="button" onClick={handleRegenerate} disabled={regenerating}>
          <RefreshCcw size={18} />
          <span>{regenerating ? 'Regenerando...' : 'Regenerar futuro de lotes activos'}</span>
        </button>
      </MobileCard>

      <MobileCard title="Actividades por dia de lote">
        <NewActivityForm onToast={onToast} />
        <div className="programming-list">
          {actividades
            .slice()
            .sort((left, right) => left.Categoria.localeCompare(right.Categoria) || left.DiaLote - right.DiaLote)
            .map((actividad) => (
              <ActivityProgramRow key={actividad.ActividadProgramadaID} actividad={actividad} onToast={onToast} />
            ))}
        </div>
      </MobileCard>

      <MobileCard title="Plan vacunal base">
        <NewVaccineForm onToast={onToast} />
        <div className="programming-list programming-list--compact">
          {vacunas
            .slice()
            .sort((left, right) => left.DiaProgramado - right.DiaProgramado)
            .map((vacuna) => (
              <VaccineProgramRow key={vacuna.VacunaBaseID} vacuna={vacuna} onToast={onToast} />
            ))}
        </div>
      </MobileCard>

      <MobileCard title="Perros">
        <NewDogForm onToast={onToast} />
        <div className="programming-list programming-list--compact">
          {perros
            .slice()
            .sort((left, right) => left.NombrePerro.localeCompare(right.NombrePerro))
            .map((perro) => (
              <DogProgramRow key={perro.PerroID} perro={perro} onToast={onToast} />
            ))}
        </div>
      </MobileCard>
    </section>
  );
}

function NewActivityForm({ onToast }: { onToast: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="small-button programming-add-button" type="button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Nueva actividad
      </button>
    );
  }
  return (
    <ActivityProgramForm
      actividad={{
        ActividadProgramadaID: '',
        NombreActividad: '',
        Categoria: 'Manejo',
        TipoFrecuencia: 'SEGUN_DIA_LOTE',
        DiaLote: 1,
        HoraSugerida: '',
        AplicaDesdeDia: 1,
        AplicaHastaDia: 1,
        RequiereDato: false,
        RequiereFoto: false,
        Activa: true,
      }}
      onSaved={() => {
        setOpen(false);
        onToast('Actividad programada guardada.');
      }}
    />
  );
}

function ActivityProgramRow({ actividad, onToast }: { actividad: ActividadProgramada; onToast: (message: string) => void }) {
  return <ActivityProgramForm actividad={actividad} onSaved={() => onToast('Actividad programada guardada.')} />;
}

function ActivityProgramForm({ actividad, onSaved }: { actividad: ActividadProgramada; onSaved: () => void }) {
  const [draft, setDraft] = useState(actividad);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardarActividadProgramada(draft);
    onSaved();
  }

  return (
    <form className="programming-row programming-row--activity" onSubmit={handleSubmit}>
      <input aria-label="Nombre actividad" value={draft.NombreActividad} placeholder="Actividad" onChange={(event) => setDraft({ ...draft, NombreActividad: event.target.value })} required />
      <input aria-label="Categoria" value={draft.Categoria} placeholder="Categoria" onChange={(event) => setDraft({ ...draft, Categoria: event.target.value })} required />
      <select value={draft.TipoFrecuencia} onChange={(event) => setDraft({ ...draft, TipoFrecuencia: event.target.value as ActividadProgramada['TipoFrecuencia'] })}>
        {frequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <input aria-label="Dia lote" type="number" value={draft.DiaLote} onChange={(event) => setDraft({ ...draft, DiaLote: Number(event.target.value || 0) })} />
      <input aria-label="Desde dia" type="number" value={draft.AplicaDesdeDia} onChange={(event) => setDraft({ ...draft, AplicaDesdeDia: Number(event.target.value || 0) })} />
      <input aria-label="Hasta dia" type="number" value={draft.AplicaHastaDia} onChange={(event) => setDraft({ ...draft, AplicaHastaDia: Number(event.target.value || 0) })} />
      <input aria-label="Hora sugerida" value={draft.HoraSugerida} placeholder="Hora" onChange={(event) => setDraft({ ...draft, HoraSugerida: event.target.value })} />
      <label>
        <input type="checkbox" checked={draft.Activa} onChange={(event) => setDraft({ ...draft, Activa: event.target.checked })} />
        Activa
      </label>
      <button type="submit" aria-label="Guardar actividad">
        <Save size={17} />
      </button>
    </form>
  );
}

function NewVaccineForm({ onToast }: { onToast: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="small-button programming-add-button" type="button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Nueva vacuna
      </button>
    );
  }
  return (
    <VaccineProgramForm
      vacuna={{ VacunaBaseID: '', NombreVacuna: '', DiaProgramado: 1, ViaAplicacion: 'Agua de bebida', Activa: true }}
      onSaved={() => {
        setOpen(false);
        onToast('Vacuna base guardada.');
      }}
    />
  );
}

function VaccineProgramRow({ vacuna, onToast }: { vacuna: PlanVacunalBase; onToast: (message: string) => void }) {
  return <VaccineProgramForm vacuna={vacuna} onSaved={() => onToast('Vacuna base guardada.')} />;
}

function VaccineProgramForm({ vacuna, onSaved }: { vacuna: PlanVacunalBase; onSaved: () => void }) {
  const [draft, setDraft] = useState(vacuna);
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardarPlanVacunalBase(draft);
    onSaved();
  }
  return (
    <form className="programming-row programming-row--compact" onSubmit={handleSubmit}>
      <input aria-label="Nombre vacuna" value={draft.NombreVacuna} placeholder="Vacuna" onChange={(event) => setDraft({ ...draft, NombreVacuna: event.target.value })} required />
      <input aria-label="Dia programado" type="number" value={draft.DiaProgramado} onChange={(event) => setDraft({ ...draft, DiaProgramado: Number(event.target.value || 0) })} />
      <input aria-label="Via aplicacion" value={draft.ViaAplicacion} placeholder="Via" onChange={(event) => setDraft({ ...draft, ViaAplicacion: event.target.value })} />
      <label>
        <input type="checkbox" checked={draft.Activa} onChange={(event) => setDraft({ ...draft, Activa: event.target.checked })} />
        Activa
      </label>
      <button type="submit" aria-label="Guardar vacuna">
        <Save size={17} />
      </button>
    </form>
  );
}

function NewDogForm({ onToast }: { onToast: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="small-button programming-add-button" type="button" onClick={() => setOpen(true)}>
        <Plus size={16} />
        Nuevo perro
      </button>
    );
  }
  return (
    <DogProgramForm
      perro={{
        PerroID: '',
        NombrePerro: '',
        Activo: true,
        FechaUltimaRabia: '',
        FechaUltimaDesparasitacion: '',
        FrecuenciaRabiaDias: 365,
        FrecuenciaDesparasitacionDias: 90,
        Observaciones: '',
        EstadoSync: 'PENDIENTE',
      }}
      onSaved={() => {
        setOpen(false);
        onToast('Perro guardado.');
      }}
    />
  );
}

function DogProgramRow({ perro, onToast }: { perro: Perro; onToast: (message: string) => void }) {
  return <DogProgramForm perro={perro} onSaved={() => onToast('Perro guardado.')} />;
}

function DogProgramForm({ perro, onSaved }: { perro: Perro; onSaved: () => void }) {
  const [draft, setDraft] = useState(perro);
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await guardarPerroProgramacion(draft);
    onSaved();
  }
  return (
    <form className="programming-row programming-row--dog" onSubmit={handleSubmit}>
      <input aria-label="Nombre perro" value={draft.NombrePerro} placeholder="Nombre" onChange={(event) => setDraft({ ...draft, NombrePerro: event.target.value })} required />
      <input aria-label="Ultima rabia" type="date" value={draft.FechaUltimaRabia} onChange={(event) => setDraft({ ...draft, FechaUltimaRabia: event.target.value })} />
      <input aria-label="Frecuencia rabia" type="number" value={draft.FrecuenciaRabiaDias} onChange={(event) => setDraft({ ...draft, FrecuenciaRabiaDias: Number(event.target.value || 365) })} />
      <input aria-label="Ultima desparasitacion" type="date" value={draft.FechaUltimaDesparasitacion} onChange={(event) => setDraft({ ...draft, FechaUltimaDesparasitacion: event.target.value })} />
      <input aria-label="Frecuencia desparasitacion" type="number" value={draft.FrecuenciaDesparasitacionDias} onChange={(event) => setDraft({ ...draft, FrecuenciaDesparasitacionDias: Number(event.target.value || 90) })} />
      <span className="programming-row__next">Rabia {getDogNextDate(draft, 'RABIA') || 'hoy'} - Desp. {getDogNextDate(draft, 'DESPARASITACION') || 'hoy'}</span>
      <label>
        <input type="checkbox" checked={draft.Activo} onChange={(event) => setDraft({ ...draft, Activo: event.target.checked })} />
        Activo
      </label>
      <button type="submit" aria-label="Guardar perro">
        <Save size={17} />
      </button>
    </form>
  );
}
