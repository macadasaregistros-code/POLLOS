import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  Dog,
  Droplets,
  Flame,
  NotebookPen,
  PackagePlus,
  Pill,
  Sprout,
  Syringe,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import {
  aplicarVacuna,
  registrarCapacitacion,
  registrarControlAgua,
  registrarEntradaAlimento,
  registrarEntradaMaterial,
  registrarMedicamento,
  registrarPerro,
  registrarPlaga,
} from '../../services/domainService';
import { db } from '../../services/localDbService';
import { addDays, todayISO } from '../../lib/date';
import { fileToDataUrl } from '../../lib/photo';
import { fmtNumber } from '../../lib/format';
import type { CompostajeCajon, ControlAgua, Lote, TipoAlimento, TipoMaterialInventario, TipoPlaga, Usuario } from '../../types/entities';

export type ActivityRecordKind = 'vacunacion' | 'agua' | 'plagas' | 'medicamento' | 'compostaje' | 'perros' | 'capacitacion';
export type EntryKind = 'alimento' | 'cisco' | 'gas';

interface RecordOption<TKind extends string> {
  kind: TKind;
  title: string;
  subtitle: string;
  eyebrow: string;
  image: string;
  icon: ReactNode;
  tone: string;
}

const activityOptions: Array<RecordOption<ActivityRecordKind>> = [
  {
    kind: 'vacunacion',
    title: 'Vacunacion',
    subtitle: 'Producto, laboratorio, lote, responsable y foto',
    eyebrow: 'Sanidad',
    image: '/chickens/day-15.png',
    icon: <Syringe size={28} />,
    tone: 'vaccine',
  },
  {
    kind: 'agua',
    title: 'Tratamiento de agua',
    subtitle: 'Dosificacion, pH, cloro y soporte visual',
    eyebrow: 'Agua',
    image: '/galpon-dashboard/shed-scene.svg',
    icon: <Droplets size={28} />,
    tone: 'water',
  },
  {
    kind: 'plagas',
    title: 'Control de plagas',
    subtitle: 'Roedores, mosca, producto y estaciones',
    eyebrow: 'Bioseguridad',
    image: '/galpon-dashboard/straw-texture.svg',
    icon: <Bug size={28} />,
    tone: 'pest',
  },
  {
    kind: 'medicamento',
    title: 'Medicamento',
    subtitle: 'Dosis, via, motivo, responsable y retiro',
    eyebrow: 'Veterinaria',
    image: '/chickens/day-22.png',
    icon: <Pill size={28} />,
    tone: 'medicine',
  },
  {
    kind: 'compostaje',
    title: 'Compostaje',
    subtitle: 'Cajon activo, tiempos y acumulado de mortalidad',
    eyebrow: 'Compostaje',
    image: '/galpon-dashboard/straw-texture.svg',
    icon: <Sprout size={28} />,
    tone: 'compost',
  },
  {
    kind: 'perros',
    title: 'Perros',
    subtitle: 'Rabia, desparasitacion, producto y foto',
    eyebrow: 'Bioseguridad',
    image: '/galpon-dashboard/shed-scene.svg',
    icon: <Dog size={28} />,
    tone: 'dogs',
  },
  {
    kind: 'capacitacion',
    title: 'Capacitaciones',
    subtitle: 'Tema, capacitador, firmas y asistentes',
    eyebrow: 'Equipo',
    image: '/galpon-dashboard/shed-scene.svg',
    icon: <Users size={28} />,
    tone: 'training',
  },
];

const entryOptions: Array<RecordOption<EntryKind>> = [
  {
    kind: 'alimento',
    title: 'Alimento',
    subtitle: 'Selecciona etapa y cantidad de bultos recibidos',
    eyebrow: 'Entrada',
    image: '/chickens/day-29.png',
    icon: <PackagePlus size={30} />,
    tone: 'food',
  },
  {
    kind: 'cisco',
    title: 'Cisco',
    subtitle: 'Pacas recibidas para cama y alistamiento',
    eyebrow: 'Entrada',
    image: '/galpon-dashboard/straw-texture.svg',
    icon: <Warehouse size={30} />,
    tone: 'cisco',
  },
  {
    kind: 'gas',
    title: 'Gas',
    subtitle: 'Cilindros disponibles para calentadoras',
    eyebrow: 'Entrada',
    image: '/galpon-dashboard/shed-scene.svg',
    icon: <Flame size={30} />,
    tone: 'gas',
  },
];

const foodOrder = ['preiniciador', 'iniciador', 'engorde'] as const;

interface ActivityRecordsProps {
  user: Usuario;
  activeKind?: ActivityRecordKind | '';
  onActiveKindChange?: (kind: ActivityRecordKind | '') => void;
  onSaved: (message: string) => void;
}

interface EntradaViewProps {
  user: Usuario;
  activeEntry?: EntryKind | '';
  onActiveEntryChange?: (entry: EntryKind | '') => void;
  onSaved: (message: string) => void;
}

export function GalponeroActivityRecords({ user, activeKind, onActiveKindChange, onSaved }: ActivityRecordsProps) {
  const [localActiveKind, setLocalActiveKind] = useState<ActivityRecordKind | ''>('');
  const resolvedActiveKind = activeKind ?? localActiveKind;
  const activeOption = activityOptions.find((option) => option.kind === resolvedActiveKind);

  function setActiveKind(nextKind: ActivityRecordKind | '') {
    if (onActiveKindChange) onActiveKindChange(nextKind);
    else setLocalActiveKind(nextKind);
  }

  if (resolvedActiveKind && activeOption) {
    return (
      <NativeRecordScreen option={activeOption} context="Registro" onBack={() => setActiveKind('')}>
        {resolvedActiveKind === 'vacunacion' && <VaccinationRecordForm user={user} onSaved={onSaved} />}
        {resolvedActiveKind === 'agua' && <WaterTreatmentForm user={user} onSaved={onSaved} />}
        {resolvedActiveKind === 'plagas' && <PestControlForm user={user} onSaved={onSaved} />}
        {resolvedActiveKind === 'medicamento' && <MedicationForm user={user} onSaved={onSaved} />}
        {resolvedActiveKind === 'compostaje' && <CompostingPanel />}
        {resolvedActiveKind === 'perros' && <DogRecordForm user={user} onSaved={onSaved} />}
        {resolvedActiveKind === 'capacitacion' && <TrainingForm user={user} onSaved={onSaved} />}
      </NativeRecordScreen>
    );
  }

  return (
    <section className="record-launch-grid" aria-label="Registros operativos">
      {activityOptions.map((option) => (
        <button key={option.kind} className={`record-launch-card record-launch-card--${option.tone}`} type="button" onClick={() => setActiveKind(option.kind)}>
          <span className="record-launch-card__image">
            <img src={option.image} alt="" loading="lazy" decoding="async" />
          </span>
          <span className="record-launch-card__icon">{option.icon}</span>
          <span className="record-launch-card__copy">
            <small>{option.eyebrow}</small>
            <strong>{option.title}</strong>
            <em>{option.subtitle}</em>
          </span>
        </button>
      ))}
      <ReminderPanel />
    </section>
  );
}

export function GalponeroEntradaView({ user, activeEntry, onActiveEntryChange, onSaved }: EntradaViewProps) {
  const [localActiveEntry, setLocalActiveEntry] = useState<EntryKind | ''>('');
  const resolvedActiveEntry = activeEntry ?? localActiveEntry;
  const activeOption = entryOptions.find((option) => option.kind === resolvedActiveEntry);

  function setActiveEntry(nextEntry: EntryKind | '') {
    if (onActiveEntryChange) onActiveEntryChange(nextEntry);
    else setLocalActiveEntry(nextEntry);
  }

  if (resolvedActiveEntry && activeOption) {
    return (
      <NativeRecordScreen option={activeOption} context="Entrada" onBack={() => setActiveEntry('')}>
        {resolvedActiveEntry === 'alimento' && <FoodEntryForm user={user} onSaved={onSaved} />}
        {resolvedActiveEntry === 'cisco' && <MaterialEntryForm type="CISCO" unit="PACAS" label="Pacas de cisco" user={user} onSaved={onSaved} />}
        {resolvedActiveEntry === 'gas' && <MaterialEntryForm type="GAS" unit="CILINDROS" label="Cilindros de gas" user={user} onSaved={onSaved} />}
      </NativeRecordScreen>
    );
  }

  return (
    <section className="entry-card-grid" aria-label="Entradas de material">
      {entryOptions.map((option) => (
        <button key={option.kind} className={`entry-option-card entry-option-card--${option.tone}`} type="button" onClick={() => setActiveEntry(option.kind)}>
          <span className="entry-option-card__image">
            <img src={option.image} alt="" loading="lazy" decoding="async" />
          </span>
          <span className="entry-option-card__icon">{option.icon}</span>
          <strong>{option.title}</strong>
          <small>{option.subtitle}</small>
        </button>
      ))}
    </section>
  );
}

function NativeRecordScreen({
  option,
  context,
  onBack,
  children,
}: {
  option: RecordOption<ActivityRecordKind | EntryKind>;
  context: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <section className={`native-record-screen native-record-screen--${option.tone}`}>
      <header className="native-record-hero">
        <button className="native-back-button native-record-hero__back" type="button" aria-label={`Volver a ${context.toLowerCase()}`} onClick={onBack}>
          <ArrowLeft size={21} />
        </button>
        <div className="native-record-hero__copy">
          <span>{option.eyebrow}</span>
          <h2>{option.title}</h2>
          <p>{option.subtitle}</p>
        </div>
        <div className="native-record-hero__visual" aria-hidden="true">
          <img src={option.image} alt="" />
          <span>{option.icon}</span>
        </div>
      </header>
      <div className="record-form-surface">{children}</div>
    </section>
  );
}

function ReminderPanel() {
  return (
    <article className="reminder-panel">
      <header>
        <NotebookPen size={24} />
        <strong>Recordatorios</strong>
      </header>
      <div>
        <span>Diarios: fumigacion 4pm, pediluvios con creolina, purgar linea.</span>
        <span>Semanales: limpiar malla y telaranas, barrer bodegas, plagas.</span>
      </div>
    </article>
  );
}

function useLoteGalponSelection() {
  const lotes = useLiveQuery(() => db.lotes.where('EstadoLote').equals('ACTIVO').toArray(), []);
  const loteGalpones = useLiveQuery(() => db.loteGalpones.where('Estado').equals('ACTIVO').toArray(), []);
  const galpones = useLiveQuery(() => db.galpones.toArray(), []);
  const [loteId, setLoteId] = useState('');
  const [galponId, setGalponId] = useState('');
  const activeLotes = lotes ?? [];
  const activeAssignments = loteGalpones ?? [];
  const assignmentsForLote = useMemo(
    () => activeAssignments.filter((assignment) => assignment.LoteID === loteId),
    [activeAssignments, loteId],
  );
  const selectedLote = activeLotes.find((lote) => lote.LoteID === loteId);
  const selectedGalpon = galpones?.find((galpon) => galpon.GalponID === galponId);

  useEffect(() => {
    if (!loteId && activeLotes[0]) setLoteId(activeLotes[0].LoteID);
  }, [activeLotes, loteId]);

  useEffect(() => {
    if (!assignmentsForLote.some((assignment) => assignment.GalponID === galponId)) {
      setGalponId(assignmentsForLote[0]?.GalponID ?? '');
    }
  }, [assignmentsForLote, galponId]);

  return {
    lotes: activeLotes,
    galpones: galpones ?? [],
    loteGalpones: activeAssignments,
    loteId,
    setLoteId,
    galponId,
    setGalponId,
    assignmentsForLote,
    selectedLote,
    selectedGalpon,
  };
}

function LoteGalponFields({ selection }: { selection: ReturnType<typeof useLoteGalponSelection> }) {
  return (
    <>
      <label className="field">
        <span>Lote</span>
        <select value={selection.loteId} onChange={(event) => selection.setLoteId(event.target.value)} required>
          {selection.lotes.map((lote) => (
            <option key={lote.LoteID} value={lote.LoteID}>
              {lote.CodigoLote}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Galpon</span>
        <select value={selection.galponId} onChange={(event) => selection.setGalponId(event.target.value)} required>
          {selection.assignmentsForLote.map((assignment) => {
            const galpon = selection.galpones.find((item) => item.GalponID === assignment.GalponID);
            return (
              <option key={assignment.LoteGalponID} value={assignment.GalponID}>
                {galpon?.NombreGalpon ?? assignment.GalponID}
              </option>
            );
          })}
        </select>
      </label>
    </>
  );
}

function FoodEntryForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const tipos = useLiveQuery(() => db.tiposAlimento.toArray().then((items) => items.filter((item) => item.Activo)), []);
  const [tipoId, setTipoId] = useState('');
  const [bultos, setBultos] = useState('0');
  const [observaciones, setObservaciones] = useState('');
  const tiposOrdenados = useMemo(() => orderFoodTypes(tipos ?? []), [tipos]);
  const selected = tiposOrdenados.find((tipo) => tipo.TipoAlimentoID === tipoId);

  useEffect(() => {
    if (!tipoId && tiposOrdenados[0]) setTipoId(tiposOrdenados[0].TipoAlimentoID);
  }, [tipoId, tiposOrdenados]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await registrarEntradaAlimento(
      {
        Fecha: todayISO(),
        TipoAlimentoID: selected.TipoAlimentoID,
        CantidadBultos: Number(bultos || 0),
        KgPorBulto: selected.KgPorBulto,
        ProveedorID: '',
        Observaciones: observaciones,
      },
      user,
    );
    setBultos('0');
    setObservaciones('');
    onSaved('Entrada de alimento guardada offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        <span>Tipo de alimento</span>
        <select value={tipoId} onChange={(event) => setTipoId(event.target.value)} required>
          {tiposOrdenados.map((tipo) => (
            <option key={tipo.TipoAlimentoID} value={tipo.TipoAlimentoID}>
              {tipo.Nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Bultos</span>
        <input type="number" min="0" step="0.25" inputMode="decimal" value={bultos} onChange={(event) => setBultos(event.target.value)} />
      </label>
      <label className="field field--full">
        <span>Observaciones</span>
        <textarea rows={3} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
      </label>
      <button className="primary-action">Guardar entrada</button>
    </form>
  );
}

function MaterialEntryForm({
  type,
  unit,
  label,
  user,
  onSaved,
}: {
  type: TipoMaterialInventario;
  unit: string;
  label: string;
  user: Usuario;
  onSaved: (message: string) => void;
}) {
  const [cantidad, setCantidad] = useState('0');
  const [observaciones, setObservaciones] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await registrarEntradaMaterial(
      {
        Fecha: todayISO(),
        TipoMaterial: type,
        Cantidad: Number(cantidad || 0),
        Unidad: unit,
        ProveedorID: '',
        Observaciones: observaciones,
      },
      user,
    );
    setCantidad('0');
    setObservaciones('');
    onSaved(`Entrada de ${type.toLowerCase()} guardada offline.`);
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field">
        <span>{label}</span>
        <input type="number" min="0" step="1" inputMode="numeric" value={cantidad} onChange={(event) => setCantidad(event.target.value)} />
      </label>
      <label className="field field--full">
        <span>Observaciones</span>
        <textarea rows={3} value={observaciones} onChange={(event) => setObservaciones(event.target.value)} />
      </label>
      <button className="primary-action">Guardar entrada</button>
    </form>
  );
}

function VaccinationRecordForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const vacunas = useLiveQuery(() => db.vacunasLote.toArray(), []);
  const lotes = useLiveQuery(() => db.lotes.toArray(), []);
  const [vacunaId, setVacunaId] = useState('');
  const [producto, setProducto] = useState('');
  const [laboratorio, setLaboratorio] = useState('');
  const [loteProducto, setLoteProducto] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [via, setVia] = useState('Agua de bebida');
  const [cepa, setCepa] = useState('');
  const [enfermedad, setEnfermedad] = useState('');
  const [responsable, setResponsable] = useState(user.Nombre);
  const [firma, setFirma] = useState('');
  const [foto, setFoto] = useState('');
  const [observacion, setObservacion] = useState('');
  const sortedVacunas = useMemo(
    () => (vacunas ?? []).slice().sort((left, right) => left.FechaProgramada.localeCompare(right.FechaProgramada)),
    [vacunas],
  );
  const selected = sortedVacunas.find((vacuna) => vacuna.VacunaLoteID === vacunaId);
  const lote = lotes?.find((item) => item.LoteID === selected?.LoteID);

  useEffect(() => {
    if (!vacunaId && sortedVacunas[0]) setVacunaId(sortedVacunas[0].VacunaLoteID);
  }, [sortedVacunas, vacunaId]);

  useEffect(() => {
    if (!selected) return;
    setProducto(selected.Producto || selected.NombreVacuna);
    setVia(selected.ViaAdministracion || 'Agua de bebida');
    setEnfermedad(selected.Enfermedad || selected.NombreVacuna);
  }, [selected?.VacunaLoteID]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await aplicarVacuna(selected.VacunaLoteID, user, {
      Producto: producto,
      Laboratorio: laboratorio,
      LoteProducto: loteProducto,
      FechaVencimientoProducto: vencimiento,
      ViaAdministracion: via,
      Cepa: cepa,
      Enfermedad: enfermedad,
      Responsable: responsable,
      FirmaResponsable: firma,
      Foto: foto,
      Observacion: observacion,
    });
    setLaboratorio('');
    setLoteProducto('');
    setVencimiento('');
    setCepa('');
    setFirma('');
    setFoto('');
    setObservacion('');
    onSaved('Vacunacion registrada offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field field--full">
        <span>Vacuna programada</span>
        <select value={vacunaId} onChange={(event) => setVacunaId(event.target.value)} required>
          {sortedVacunas.map((vacuna) => {
            const vacunaLote = lotes?.find((item) => item.LoteID === vacuna.LoteID);
            return (
              <option key={vacuna.VacunaLoteID} value={vacuna.VacunaLoteID}>
                {vacuna.NombreVacuna} - {vacunaLote?.CodigoLote ?? vacuna.LoteID} - {vacuna.Estado}
              </option>
            );
          })}
        </select>
      </label>
      <ReadOnlyContext lote={lote} label={`Edad programada ${selected?.EdadDias || selected?.DiaProgramado || 0} dias`} />
      <TextField label="Producto" value={producto} onChange={setProducto} required />
      <TextField label="Laboratorio" value={laboratorio} onChange={setLaboratorio} />
      <TextField label="Lote del producto" value={loteProducto} onChange={setLoteProducto} />
      <label className="field">
        <span>Fecha vencimiento</span>
        <input type="date" value={vencimiento} onChange={(event) => setVencimiento(event.target.value)} />
      </label>
      <TextField label="Via de administracion" value={via} onChange={setVia} />
      <TextField label="Cepa" value={cepa} onChange={setCepa} />
      <TextField label="Enfermedad" value={enfermedad} onChange={setEnfermedad} />
      <TextField label="Responsable" value={responsable} onChange={setResponsable} />
      <TextField label="Firma" value={firma} onChange={setFirma} />
      <PhotoField onChange={setFoto} />
      <ObservationField value={observacion} onChange={setObservacion} />
      <button className="primary-action">Guardar vacunacion</button>
    </form>
  );
}

function WaterTreatmentForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const selection = useLoteGalponSelection();
  const [dosificacion, setDosificacion] = useState('');
  const [ph, setPh] = useState('7.0');
  const [cloro, setCloro] = useState('');
  const [lugar, setLugar] = useState<ControlAgua['LugarMedicion']>('LINEA');
  const [accion, setAccion] = useState('');
  const [foto, setFoto] = useState('');
  const [observacion, setObservacion] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selection.loteId || !selection.galponId) return;
    await registrarControlAgua(
      {
        Fecha: todayISO(),
        LoteID: selection.loteId,
        GalponID: selection.galponId,
        DosificacionCloroGr: Number(dosificacion || 0),
        VerificacionPH: Number(ph || 0),
        VerificacionCloro: Number(cloro || 0),
        LugarMedicion: lugar,
        AccionTomada: accion,
        Foto: foto,
        Observacion: observacion,
      },
      user,
    );
    setDosificacion('');
    setCloro('');
    setAccion('');
    setFoto('');
    setObservacion('');
    onSaved('Tratamiento de agua guardado offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <LoteGalponFields selection={selection} />
      <label className="field">
        <span>Lugar</span>
        <select value={lugar} onChange={(event) => setLugar(event.target.value as ControlAgua['LugarMedicion'])}>
          <option value="TANQUE">Tanque</option>
          <option value="LINEA">Linea</option>
          <option value="NIPPLE">Nipple</option>
        </select>
      </label>
      <NumberField label="Dosificacion cloro (gr)" value={dosificacion} onChange={setDosificacion} step="0.1" />
      <NumberField label="Verificacion pH" value={ph} onChange={setPh} step="0.1" />
      <NumberField label="Verificacion cloro" value={cloro} onChange={setCloro} step="0.1" />
      <TextField className="field--full" label="Accion tomada" value={accion} onChange={setAccion} />
      <PhotoField onChange={setFoto} />
      <ObservationField value={observacion} onChange={setObservacion} />
      <button className="primary-action">Guardar agua</button>
    </form>
  );
}

function PestControlForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const galpones = useLiveQuery(() => db.galpones.toArray(), []);
  const [tipo, setTipo] = useState<TipoPlaga>('ROEDORES');
  const [galponId, setGalponId] = useState('');
  const [producto, setProducto] = useState('Veneno para roedores');
  const [dosificacion, setDosificacion] = useState('');
  const [estaciones, setEstaciones] = useState('');
  const [foto, setFoto] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (!galponId && galpones?.[0]) setGalponId(galpones[0].GalponID);
  }, [galponId, galpones]);

  useEffect(() => {
    setProducto(tipo === 'ROEDORES' ? 'Veneno para roedores' : 'Cipermetrina');
  }, [tipo]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await registrarPlaga(
      {
        Fecha: todayISO(),
        TipoPlaga: tipo,
        GalponID: galponId,
        Producto: producto,
        Dosificacion: dosificacion,
        EstacionesVeneno: tipo === 'ROEDORES' ? Number(estaciones || 0) : 0,
        Foto: foto,
        Observaciones: observaciones,
      },
      user,
    );
    setDosificacion('');
    setEstaciones('');
    setFoto('');
    setObservaciones('');
    onSaved('Control de plagas guardado offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label className="field field--full">
        <span>Tipo</span>
        <div className="segmented-control">
          <button type="button" className={tipo === 'ROEDORES' ? 'is-active' : ''} onClick={() => setTipo('ROEDORES')}>
            Roedores
          </button>
          <button type="button" className={tipo === 'MOSCA' ? 'is-active' : ''} onClick={() => setTipo('MOSCA')}>
            Mosca
          </button>
        </div>
      </label>
      <label className="field">
        <span>Galpon</span>
        <select value={galponId} onChange={(event) => setGalponId(event.target.value)} required>
          {galpones?.map((galpon) => (
            <option key={galpon.GalponID} value={galpon.GalponID}>
              {galpon.NombreGalpon}
            </option>
          ))}
        </select>
      </label>
      <TextField label="Producto" value={producto} onChange={setProducto} />
      <TextField label="Dosificacion" value={dosificacion} onChange={setDosificacion} />
      {tipo === 'ROEDORES' && <NumberField label="Estaciones con veneno" value={estaciones} onChange={setEstaciones} step="1" />}
      <PhotoField onChange={setFoto} />
      <ObservationField value={observaciones} onChange={setObservaciones} />
      <button className="primary-action">Guardar plagas</button>
    </form>
  );
}

function MedicationForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const selection = useLoteGalponSelection();
  const [producto, setProducto] = useState('');
  const [dosis, setDosis] = useState('');
  const [via, setVia] = useState('Agua de bebida');
  const [motivo, setMotivo] = useState('');
  const [responsable, setResponsable] = useState(user.Nombre);
  const [retiro, setRetiro] = useState('0');
  const [foto, setFoto] = useState('');
  const [observaciones, setObservaciones] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selection.loteId || !selection.galponId) return;
    await registrarMedicamento(
      {
        Fecha: todayISO(),
        LoteID: selection.loteId,
        GalponID: selection.galponId,
        Producto: producto,
        Dosis: dosis,
        ViaAdministracion: via,
        Motivo: motivo,
        Responsable: responsable,
        PeriodoRetiroDias: Number(retiro || 0),
        Foto: foto,
        Observaciones: observaciones,
      },
      user,
    );
    setProducto('');
    setDosis('');
    setMotivo('');
    setRetiro('0');
    setFoto('');
    setObservaciones('');
    onSaved('Medicamento guardado offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <LoteGalponFields selection={selection} />
      <TextField label="Producto" value={producto} onChange={setProducto} required />
      <TextField label="Dosis" value={dosis} onChange={setDosis} />
      <TextField label="Via" value={via} onChange={setVia} />
      <TextField className="field--full" label="Motivo" value={motivo} onChange={setMotivo} />
      <TextField label="Responsable" value={responsable} onChange={setResponsable} />
      <NumberField label="Retiro si aplica (dias)" value={retiro} onChange={setRetiro} step="1" />
      <PhotoField onChange={setFoto} />
      <ObservationField value={observaciones} onChange={setObservaciones} />
      <button className="primary-action">Guardar medicamento</button>
    </form>
  );
}

function CompostingPanel() {
  const cajones = useLiveQuery(() => db.compostajeCajones.toArray(), []);
  const registros = useLiveQuery(() => db.compostajeRegistros.toArray(), []);
  const active = (cajones ?? []).find((cajon) => cajon.Estado === 'ACTIVO') ?? (cajones ?? []).at(-1);
  const totalRegistros = (registros ?? []).filter((registro) => registro.CajonID === active?.CajonID);

  if (!active) {
    return (
      <article className="compost-empty">
        <Sprout size={34} />
        <strong>Sin cajon activo</strong>
        <span>El primer registro de mortalidad diaria creara el cajon automaticamente.</span>
      </article>
    );
  }

  return (
    <div className="compost-panel">
      <CompostCard cajon={active} totalRegistros={totalRegistros.length} />
      <div className="compost-recent-list">
        {totalRegistros.slice(-5).reverse().map((registro) => (
          <article key={registro.RegistroCompostajeID}>
            <strong>{registro.Fecha}</strong>
            <span>{fmtNumber(registro.TotalAves)} aves agregadas</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function CompostCard({ cajon, totalRegistros }: { cajon: CompostajeCajon; totalRegistros: number }) {
  const today = todayISO();
  const steps = [
    { label: 'Inicio', date: cajon.FechaInicio },
    { label: 'Fin llenado', date: cajon.FechaFinLlenado },
    { label: 'Volteo', date: cajon.FechaVolteo },
    { label: 'Retiro', date: cajon.FechaRetiro },
  ];

  return (
    <article className="compost-card">
      <header>
        <span>
          <Sprout size={28} />
        </span>
        <div>
          <strong>{cajon.CodigoCajon}</strong>
          <small>{fmtNumber(cajon.AvesAcumuladas)} aves acumuladas - {fmtNumber(totalRegistros)} registros</small>
        </div>
      </header>
      <div className="compost-timeline">
        {steps.map((step) => (
          <span key={step.label} className={step.date <= today ? 'is-due' : ''}>
            <CheckCircle2 size={18} />
            <strong>{step.label}</strong>
            <small>{step.date}</small>
          </span>
        ))}
      </div>
    </article>
  );
}

function DogRecordForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'RABIA' | 'DESPARASITACION'>('RABIA');
  const [producto, setProducto] = useState('');
  const [laboratorio, setLaboratorio] = useState('');
  const [loteProducto, setLoteProducto] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [responsable, setResponsable] = useState(user.Nombre);
  const [firma, setFirma] = useState('');
  const [foto, setFoto] = useState('');
  const [observaciones, setObservaciones] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await registrarPerro(
      {
        Fecha: todayISO(),
        NombrePerro: nombre,
        TipoRegistro: tipo,
        Producto: producto,
        Laboratorio: laboratorio,
        LoteProducto: loteProducto,
        FechaVencimiento: vencimiento,
        Responsable: responsable,
        FirmaResponsable: firma,
        Foto: foto,
        Observaciones: observaciones,
      },
      user,
    );
    setNombre('');
    setProducto('');
    setLaboratorio('');
    setLoteProducto('');
    setVencimiento('');
    setFirma('');
    setFoto('');
    setObservaciones('');
    onSaved('Registro de perros guardado offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <TextField label="Nombre" value={nombre} onChange={setNombre} required />
      <label className="field">
        <span>Tipo</span>
        <select value={tipo} onChange={(event) => setTipo(event.target.value as 'RABIA' | 'DESPARASITACION')}>
          <option value="RABIA">Rabia</option>
          <option value="DESPARASITACION">Desparasitacion</option>
        </select>
      </label>
      <TextField label="Producto" value={producto} onChange={setProducto} />
      <TextField label="Laboratorio" value={laboratorio} onChange={setLaboratorio} />
      <TextField label="Lote producto" value={loteProducto} onChange={setLoteProducto} />
      <label className="field">
        <span>Fecha vencimiento</span>
        <input type="date" value={vencimiento} onChange={(event) => setVencimiento(event.target.value)} />
      </label>
      <TextField label="Responsable" value={responsable} onChange={setResponsable} />
      <TextField label="Firma" value={firma} onChange={setFirma} />
      <PhotoField onChange={setFoto} />
      <ObservationField value={observaciones} onChange={setObservaciones} />
      <button className="primary-action">Guardar registro</button>
    </form>
  );
}

function TrainingForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const [tema, setTema] = useState('');
  const [capacitador, setCapacitador] = useState('');
  const [firmaCapacitador, setFirmaCapacitador] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [asistentes, setAsistentes] = useState([{ Nombre: '', Firma: '' }]);

  function updateAssistant(index: number, key: 'Nombre' | 'Firma', value: string) {
    setAsistentes((current) => current.map((assistant, assistantIndex) => (assistantIndex === index ? { ...assistant, [key]: value } : assistant)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await registrarCapacitacion(
      {
        Fecha: todayISO(),
        Tema: tema,
        Capacitador: capacitador,
        FirmaCapacitador: firmaCapacitador,
        Observaciones: observaciones,
        Asistentes: asistentes,
      },
      user,
    );
    setTema('');
    setCapacitador('');
    setFirmaCapacitador('');
    setObservaciones('');
    setAsistentes([{ Nombre: '', Firma: '' }]);
    onSaved('Capacitacion guardada offline.');
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <TextField className="field--full" label="Tema" value={tema} onChange={setTema} required />
      <TextField label="Capacitador" value={capacitador} onChange={setCapacitador} />
      <TextField label="Firma capacitador" value={firmaCapacitador} onChange={setFirmaCapacitador} />
      <div className="field field--full">
        <span>Asistentes</span>
        <div className="assistant-list">
          {asistentes.map((asistente, index) => (
            <div key={index} className="assistant-row">
              <input placeholder="Nombre" value={asistente.Nombre} onChange={(event) => updateAssistant(index, 'Nombre', event.target.value)} />
              <input placeholder="Firma" value={asistente.Firma} onChange={(event) => updateAssistant(index, 'Firma', event.target.value)} />
            </div>
          ))}
        </div>
        <button className="small-button" type="button" onClick={() => setAsistentes((current) => [...current, { Nombre: '', Firma: '' }])}>
          Agregar asistente
        </button>
      </div>
      <ObservationField value={observaciones} onChange={setObservaciones} />
      <button className="primary-action">Guardar capacitacion</button>
    </form>
  );
}

function ReadOnlyContext({ lote, label }: { lote?: Lote; label: string }) {
  return (
    <div className="form-context-pill field--full">
      <span>{lote?.CodigoLote ?? 'Lote sin seleccionar'}</span>
      <strong>{label}</strong>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  step: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" min="0" step={step} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function PhotoField({ onChange }: { onChange: (value: string) => void }) {
  async function handleFile(file?: File | null) {
    onChange(await fileToDataUrl(file));
  }

  return (
    <label className="field field--full">
      <span>Foto opcional</span>
      <input type="file" accept="image/*" capture="environment" onChange={(event) => void handleFile(event.target.files?.[0])} />
    </label>
  );
}

function ObservationField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field field--full">
      <span>Observaciones</span>
      <textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function normalizeFoodName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getFoodOrderIndex(tipo: TipoAlimento): number {
  const normalized = normalizeFoodName(tipo.Nombre);
  const index = foodOrder.findIndex((name) => normalized.includes(name));
  return index >= 0 ? index : Number.POSITIVE_INFINITY;
}

function orderFoodTypes(tipos: TipoAlimento[]): TipoAlimento[] {
  const ordered = tipos
    .filter((tipo) => getFoodOrderIndex(tipo) !== Number.POSITIVE_INFINITY)
    .sort((left, right) => getFoodOrderIndex(left) - getFoodOrderIndex(right));
  return ordered.length > 0 ? ordered : tipos;
}
