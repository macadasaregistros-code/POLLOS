import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Bug,
  CalendarDays,
  Check,
  CheckCircle2,
  Crosshair,
  Dog,
  Droplets,
  Flame,
  FlaskConical,
  Info,
  MapPin,
  NotebookPen,
  PackagePlus,
  Pill,
  Save,
  Sprout,
  Syringe,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import { FormOptionalPanel } from '../../components/FormOptionalPanel';
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
import type { CompostajeCajon, ControlAgua, Lote, TipoAlimento, TipoMaterialInventario, Usuario } from '../../types/entities';

export type ActivityRecordKind = 'vacunacion' | 'agua' | 'plagas' | 'medicamento' | 'compostaje' | 'perros' | 'capacitacion';
export type EntryKind = 'alimento' | 'cisco' | 'gas';

interface RecordOption<TKind extends string> {
  kind: TKind;
  title: string;
  subtitle: string;
  eyebrow: string;
  icon: ReactNode;
  tone: string;
}

const activityOptions: Array<RecordOption<ActivityRecordKind>> = [
  {
    kind: 'vacunacion',
    title: 'Vacunacion',
    subtitle: 'Producto aplicado y soporte si aplica',
    eyebrow: 'Sanidad',
    icon: <Syringe size={28} />,
    tone: 'vaccine',
  },
  {
    kind: 'agua',
    title: 'Tratamiento de agua',
    subtitle: 'pH, cloro y accion tomada',
    eyebrow: 'Agua',
    icon: <Droplets size={28} />,
    tone: 'water',
  },
  {
    kind: 'plagas',
    title: 'Control de plagas',
    subtitle: 'Tipo, producto y estaciones',
    eyebrow: 'Bioseguridad',
    icon: <Bug size={28} />,
    tone: 'pest',
  },
  {
    kind: 'medicamento',
    title: 'Medicamento',
    subtitle: 'Producto, dosis y motivo',
    eyebrow: 'Veterinaria',
    icon: <Pill size={28} />,
    tone: 'medicine',
  },
  {
    kind: 'compostaje',
    title: 'Compostaje',
    subtitle: 'Cajon activo, tiempos y acumulado de mortalidad',
    eyebrow: 'Compostaje',
    icon: <Sprout size={28} />,
    tone: 'compost',
  },
  {
    kind: 'perros',
    title: 'Perros',
    subtitle: 'Rabia o desparasitacion',
    eyebrow: 'Bioseguridad',
    icon: <Dog size={28} />,
    tone: 'dogs',
  },
  {
    kind: 'capacitacion',
    title: 'Capacitaciones',
    subtitle: 'Tema y asistentes',
    eyebrow: 'Equipo',
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
    icon: <PackagePlus size={30} />,
    tone: 'food',
  },
  {
    kind: 'cisco',
    title: 'Cisco',
    subtitle: 'Pacas recibidas para cama y alistamiento',
    eyebrow: 'Entrada',
    icon: <Warehouse size={30} />,
    tone: 'cisco',
  },
  {
    kind: 'gas',
    title: 'Gas',
    subtitle: 'Cilindros disponibles para calentadoras',
    eyebrow: 'Entrada',
    icon: <Flame size={30} />,
    tone: 'gas',
  },
];

const foodOrder = ['preiniciador', 'iniciador', 'engorde'] as const;
const waterRecordStatus = 'EN PROCESO';
const phIdealValues = new Set(['6.0', '6.8']);
const chlorineIdealValue = '3.0';
const phOptions = [
  { value: '6.0', tone: 'ph-60' },
  { value: '6.8', tone: 'ph-68' },
  { value: '7.2', tone: 'ph-72' },
  { value: '7.6', tone: 'ph-76' },
  { value: '7.8', tone: 'ph-78' },
] as const;
const chlorineOptions = [
  { value: '0.3', tone: 'cl-03' },
  { value: '0.5', tone: 'cl-05' },
  { value: '1.0', tone: 'cl-10' },
  { value: '1.5', tone: 'cl-15' },
  { value: '3.0', tone: 'cl-30' },
] as const;
const flyDosageOptions = ['0 cc/bomba', '30 cc/bomba', '80 cc/bomba'] as const;
type FlyDosageOption = (typeof flyDosageOptions)[number];
const shortMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const rodentStationPoints = [
  { id: 1, x: 58.3, y: 65.0, label: 'Bodega superior' },
  { id: 2, x: 67.0, y: 76.3, label: 'Bodega lateral' },
  { id: 3, x: 50.2, y: 81.9, label: 'Casa y bodega' },
  { id: 4, x: 70.8, y: 71.5, label: 'Camino lateral' },
  { id: 5, x: 61.2, y: 91.2, label: 'Bodega inferior' },
  { id: 6, x: 32.2, y: 56.1, label: 'Galpon 1' },
  { id: 7, x: 55.0, y: 35.2, label: 'Galpon 2' },
  { id: 8, x: 69.3, y: 54.2, label: 'Galpon 3' },
] as const;

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
  const hasMultipleLotes = selection.lotes.length > 1;
  const hasMultipleGalpones = selection.assignmentsForLote.length > 1;
  const loteName = selection.selectedLote?.CodigoLote ?? 'Sin lote activo';
  const galponName = selection.selectedGalpon?.NombreGalpon ?? 'Sin galpon';

  if (!selection.lotes.length || !selection.assignmentsForLote.length) {
    return (
      <div className="form-context-stack field--full">
        <div className="form-context-card form-context-card--warning">
          <span>No hay lote y galpon activos</span>
          <strong>Activa un lote antes de guardar este registro.</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="form-context-stack field--full">
      <div className="form-context-card">
        <span>Registro para</span>
        <strong>{loteName} / {galponName}</strong>
        <small>{hasMultipleLotes || hasMultipleGalpones ? 'Cambia solo si vas a registrar otro destino.' : 'Seleccionado automaticamente.'}</small>
      </div>
      {(hasMultipleLotes || hasMultipleGalpones) && (
        <div className="form-context-selectors">
          {hasMultipleLotes && (
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
          )}
          {hasMultipleGalpones && (
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
          )}
        </div>
      )}
    </div>
  );
}

function GalponField({ galpones, galponId, onChange }: { galpones: Array<{ GalponID: string; NombreGalpon: string }>; galponId: string; onChange: (value: string) => void }) {
  const selected = galpones.find((galpon) => galpon.GalponID === galponId);

  if (galpones.length <= 1) {
    return (
      <div className="form-context-card field--full">
        <span>Galpon</span>
        <strong>{selected?.NombreGalpon ?? 'Sin galpon activo'}</strong>
        <small>Seleccionado automaticamente.</small>
      </div>
    );
  }

  return (
    <label className="field">
      <span>Galpon</span>
      <select value={galponId} onChange={(event) => onChange(event.target.value)} required>
        {galpones.map((galpon) => (
          <option key={galpon.GalponID} value={galpon.GalponID}>
            {galpon.NombreGalpon}
          </option>
        ))}
      </select>
    </label>
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
    <form className="form-grid flow-form" onSubmit={handleSubmit}>
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
      <ObservationField value={observaciones} onChange={setObservaciones} />
      <button className="primary-action">
        <Save size={21} />
        <span>Guardar entrada</span>
      </button>
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
    <form className="form-grid flow-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>{label}</span>
        <input type="number" min="0" step="1" inputMode="numeric" value={cantidad} onChange={(event) => setCantidad(event.target.value)} />
      </label>
      <ObservationField value={observaciones} onChange={setObservaciones} />
      <button className="primary-action">
        <Save size={21} />
        <span>Guardar entrada</span>
      </button>
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
    <form className="form-grid flow-form" onSubmit={handleSubmit}>
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
      <TextField label="Via de administracion" value={via} onChange={setVia} />
      <FormOptionalPanel label="Detalles del producto">
        <div className="form-grid form-grid--nested">
          <TextField label="Laboratorio" value={laboratorio} onChange={setLaboratorio} />
          <TextField label="Lote del producto" value={loteProducto} onChange={setLoteProducto} />
          <label className="field">
            <span>Fecha vencimiento</span>
            <input type="date" value={vencimiento} onChange={(event) => setVencimiento(event.target.value)} />
          </label>
          <TextField label="Cepa" value={cepa} onChange={setCepa} />
          <TextField label="Enfermedad" value={enfermedad} onChange={setEnfermedad} />
          <TextField label="Responsable" value={responsable} onChange={setResponsable} />
          <TextField label="Firma" value={firma} onChange={setFirma} />
        </div>
      </FormOptionalPanel>
      <PhotoField onChange={setFoto} />
      <ObservationField value={observacion} onChange={setObservacion} />
      <button className="primary-action">
        <Save size={21} />
        <span>Guardar vacunacion</span>
      </button>
    </form>
  );
}

function WaterTreatmentForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const selection = useLoteGalponSelection();
  const [fechaRegistro] = useState(() => todayISO());
  const [phSeleccionado, setPhSeleccionado] = useState('');
  const [cloroAdicionado, setCloroAdicionado] = useState('');
  const [cloroResidualSeleccionado, setCloroResidualSeleccionado] = useState('');
  const lugar: ControlAgua['LugarMedicion'] = 'LINEA';
  const accion = '';
  const foto = '';
  const observacion = '';
  const [error, setError] = useState('');
  const phCorrecto = phIdealValues.has(phSeleccionado);
  const cloroCorrecto = cloroResidualSeleccionado === chlorineIdealValue;

  useEffect(() => {
    if (!phCorrecto && cloroAdicionado) setCloroAdicionado('');
  }, [cloroAdicionado, phCorrecto]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fechaRegistro) {
      setError('La fecha de registro es obligatoria.');
      return;
    }
    if (!selection.loteId || !selection.galponId) {
      setError('Selecciona un lote y galpon activo antes de guardar.');
      return;
    }
    if (!phSeleccionado) {
      setError('Selecciona un valor de pH.');
      return;
    }
    if (!phCorrecto) {
      setError('El pH debe estar en rango ideal para adicionar cloro y guardar.');
      return;
    }
    if (!cloroAdicionado.trim()) {
      setError('Ingresa el cloro adicionado en gramos.');
      return;
    }
    if (!cloroResidualSeleccionado) {
      setError('Selecciona un valor de cloro residual.');
      return;
    }

    const phValue = Number(phSeleccionado);
    const cloroResidualValue = Number(cloroResidualSeleccionado);
    const cloroAdicionadoValue = Number(cloroAdicionado || 0);
    if (!Number.isInteger(cloroAdicionadoValue) || cloroAdicionadoValue < 0) {
      setError('El cloro adicionado debe ser un numero entero de gramos.');
      return;
    }

    setError('');
    await registrarControlAgua(
      {
        Fecha: fechaRegistro,
        fechaRegistro,
        estado: waterRecordStatus,
        LoteID: selection.loteId,
        GalponID: selection.galponId,
        DosificacionCloroGr: cloroAdicionadoValue,
        cloroAdicionadoGramos: cloroAdicionadoValue,
        VerificacionPH: phValue,
        phSeleccionado: phValue,
        phCorrecto,
        VerificacionCloro: cloroResidualValue,
        cloroResidualSeleccionado: cloroResidualValue,
        cloroCorrecto,
        LugarMedicion: lugar,
        AccionTomada: accion,
        Foto: foto,
        Observacion: observacion,
      },
      user,
    );
    setPhSeleccionado('');
    setCloroAdicionado('');
    setCloroResidualSeleccionado('');
    onSaved('Tratamiento de agua guardado offline.');
  }

  return (
    <form className="form-grid flow-form water-treatment-form" onSubmit={handleSubmit}>
      <section className="water-date-card" aria-label="Fecha y estado del registro">
        <span className="water-date-card__icon">
          <CalendarDays size={30} />
        </span>
        <div className="water-date-card__date">
          <span>Fecha de Registro</span>
          <strong>{formatWaterDate(fechaRegistro)}</strong>
        </div>
        <div className="water-date-card__status">
          <span>Estado</span>
          <strong>{waterRecordStatus}</strong>
        </div>
      </section>

      <section className="water-form-card">
        <WaterSectionTitle icon={<FlaskConical size={26} />} title="Verificacion de pH" />
        <WaterOptionGrid
          name="ph"
          options={phOptions}
          selectedValue={phSeleccionado}
          onSelect={(value) => {
            setPhSeleccionado(value);
            setError('');
          }}
        />
        <p className="water-range-note">Rango ideal: 6.0 - 6.8 pH</p>

        <div className="water-form-divider" />

        <div className="water-input-heading">
          <span>
            <Droplets size={24} />
            <strong>Cloro Adicionado</strong>
          </span>
          <em>(gramos)</em>
        </div>
        <label className={`water-amount-input ${!phCorrecto ? 'is-disabled' : ''}`}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            value={cloroAdicionado}
            disabled={!phCorrecto}
            onChange={(event) => setCloroAdicionado(toWholeGramInput(event.target.value))}
          />
          <span>g</span>
        </label>
        <p className="water-helper-text">
          <Info size={18} />
          <span>Ingrese la cantidad si el pH es correcto para asegurar la desinfeccion optima.</span>
        </p>

        <div className="water-form-divider" />

        <WaterSectionTitle icon={<CheckCircle2 size={26} />} title="Verificacion de Cloro" unit="(ppm)" />
        <WaterOptionGrid
          name="cloro"
          options={chlorineOptions}
          selectedValue={cloroResidualSeleccionado}
          onSelect={(value) => {
            setCloroResidualSeleccionado(value);
            setError('');
          }}
        />
        <p className="water-range-note">Rango ideal: 3 ppm</p>
      </section>

      {error && <p className="water-form-error" role="alert">{error}</p>}

      <button className="primary-action water-save-button">
        <Save size={24} />
        <span>Guardar Registro</span>
      </button>
    </form>
  );
}

function WaterSectionTitle({ icon, title, unit }: { icon: ReactNode; title: string; unit?: string }) {
  return (
    <header className="water-section-title">
      <span>
        {icon}
        <strong>{title}</strong>
      </span>
      {unit && <em>{unit}</em>}
    </header>
  );
}

function WaterOptionGrid({
  name,
  options,
  selectedValue,
  onSelect,
}: {
  name: string;
  options: ReadonlyArray<{ value: string; tone: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="water-option-grid" role="radiogroup" aria-label={name}>
      {options.map((option) => {
        const selected = selectedValue === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`water-test-option water-test-option--${option.tone} ${selected ? 'is-selected' : ''}`}
            onClick={() => onSelect(option.value)}
          >
            <strong>{option.value}</strong>
            {selected && (
              <span className="water-test-option__check" aria-hidden="true">
                <Check size={18} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function formatWaterDate(dateISO: string): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  return `${day} ${shortMonths[month - 1] ?? ''} ${year}`;
}

function toWholeGramInput(value: string): string {
  return value.split(/[.,]/)[0].replace(/\D/g, '');
}

function PestControlForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const galpones = useLiveQuery(() => db.galpones.toArray(), []);
  const [fechaRegistro] = useState(() => todayISO());
  const [galponId, setGalponId] = useState('');
  const [selectedStationIds, setSelectedStationIds] = useState<number[]>([]);
  const [selectedFlyDosage, setSelectedFlyDosage] = useState<FlyDosageOption>('30 cc/bomba');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!galponId && galpones?.[0]) setGalponId(galpones[0].GalponID);
  }, [galponId, galpones]);

  function toggleStation(stationId: number) {
    if ('vibrate' in navigator) navigator.vibrate(16);
    setError('');
    setSelectedStationIds((current) => {
      const selected = current.includes(stationId);
      const next = selected ? current.filter((id) => id !== stationId) : [...current, stationId];
      return next.sort((left, right) => left - right);
    });
  }

  function selectFlyDosage(value: FlyDosageOption) {
    if ('vibrate' in navigator) navigator.vibrate(12);
    setSelectedFlyDosage(value);
    setError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!galponId) {
      setError('Selecciona un galpon activo antes de guardar.');
      return;
    }

    if (selectedStationIds.length === 0 && !selectedFlyDosage) {
      setError('Selecciona estaciones o una dosificacion de mosca.');
      return;
    }

    if (selectedStationIds.length > 0) {
      await registrarPlaga(
        {
          Fecha: fechaRegistro,
          TipoPlaga: 'ROEDORES',
          GalponID: galponId,
          Producto: 'Veneno para roedores',
          Dosificacion: '',
          EstacionesVeneno: selectedStationIds.length,
          EstacionesVenenoDetalle: selectedStationIds.join(','),
          Foto: '',
          Observaciones: '',
        },
        user,
      );
    }

    if (selectedFlyDosage) {
      await registrarPlaga(
        {
          Fecha: fechaRegistro,
          TipoPlaga: 'MOSCA',
          GalponID: galponId,
          Producto: 'Cipermetrina',
          Dosificacion: selectedFlyDosage,
          EstacionesVeneno: 0,
          EstacionesVenenoDetalle: '',
          Foto: '',
          Observaciones: '',
        },
        user,
      );
    }

    setSelectedStationIds([]);
    setSelectedFlyDosage('30 cc/bomba');
    setError('');
    onSaved('Control de plagas guardado offline.');
  }

  return (
    <form className="form-grid flow-form pest-control-form" onSubmit={handleSubmit}>
      <section className="water-date-card" aria-label="Fecha y estado del registro">
        <span className="water-date-card__icon">
          <CalendarDays size={30} />
        </span>
        <div className="water-date-card__date">
          <span>Fecha de Registro</span>
          <strong>{formatWaterDate(fechaRegistro)}</strong>
        </div>
        <div className="water-date-card__status">
          <span>Estado</span>
          <strong>{waterRecordStatus}</strong>
        </div>
      </section>

      <section className="water-form-card pest-section-card pest-section-card--rodents">
        <WaterSectionTitle icon={<Crosshair size={30} />} title="ROEDORES" />
        <div className="pest-map-heading">
          <MapPin size={20} />
          <strong>Mapa de Roedores</strong>
        </div>
        <RodentStationMap selectedStationIds={selectedStationIds} onToggleStation={toggleStation} />
      </section>

      <section className="water-form-card pest-section-card pest-section-card--flies">
        <WaterSectionTitle icon={<Bug size={30} />} title="MOSCA" />
        <div className="water-input-heading pest-dosage-heading">
          <span>
            <FlaskConical size={24} />
            <strong>Dosificacion de Cipermetrina</strong>
          </span>
        </div>
        <FlyDosageSelector selectedValue={selectedFlyDosage} onSelect={selectFlyDosage} />
      </section>

      {error && (
        <p className="water-form-error pest-form-error" role="alert">
          {error}
        </p>
      )}

      <button className="primary-action pest-save-button">
        <Save size={24} />
        <span>Guardar Registro</span>
      </button>
    </form>
  );
}

function RodentStationMap({ selectedStationIds, onToggleStation }: { selectedStationIds: number[]; onToggleStation: (stationId: number) => void }) {
  const selectedSet = new Set(selectedStationIds);
  const selectedLabel = selectedStationIds.length > 0 ? selectedStationIds.join(', ') : 'Ninguna';

  return (
    <div className="rodent-station-panel" aria-label="Estaciones de control de roedores">
      <div className="rodent-station-map" role="group" aria-label="Mapa de estaciones de control">
        <img src="/pest-control/rodent-stations-map.png" alt="" loading="lazy" decoding="async" />
        {rodentStationPoints.map((station) => {
          const selected = selectedSet.has(station.id);
          return (
            <button
              key={station.id}
              type="button"
              className={`rodent-station-marker ${selected ? 'is-selected' : ''}`}
              style={{ left: `${station.x}%`, top: `${station.y}%` }}
              aria-pressed={selected}
              aria-label={`Estacion ${station.id}: ${station.label}`}
              onClick={() => onToggleStation(station.id)}
            >
              {station.id}
            </button>
          );
        })}
      </div>
      <div className="rodent-station-summary">
        <strong>{selectedStationIds.length} seleccionada(s)</strong>
        <span>{selectedLabel}</span>
      </div>
    </div>
  );
}

function FlyDosageSelector({
  selectedValue,
  onSelect,
}: {
  selectedValue: FlyDosageOption;
  onSelect: (value: FlyDosageOption) => void;
}) {
  return (
    <div className="pest-dosage-grid" role="radiogroup" aria-label="Dosificacion de Cipermetrina">
      {flyDosageOptions.map((option) => {
        const selected = selectedValue === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`pest-dosage-option ${selected ? 'is-selected' : ''}`}
            onClick={() => onSelect(option)}
          >
            <strong>{option}</strong>
            {selected && (
              <span className="pest-dosage-option__check" aria-hidden="true">
                <Check size={18} />
              </span>
            )}
          </button>
        );
      })}
    </div>
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
    <form className="form-grid flow-form" onSubmit={handleSubmit}>
      <LoteGalponFields selection={selection} />
      <TextField label="Producto" value={producto} onChange={setProducto} required />
      <TextField label="Dosis" value={dosis} onChange={setDosis} />
      <TextField className="field--full" label="Motivo" value={motivo} onChange={setMotivo} />
      <FormOptionalPanel label="Aplicacion y retiro" value={via !== 'Agua de bebida' || responsable !== user.Nombre || retiro !== '0' ? '1' : ''}>
        <div className="form-grid form-grid--nested">
          <TextField label="Via" value={via} onChange={setVia} />
          <TextField label="Responsable" value={responsable} onChange={setResponsable} />
          <NumberField label="Retiro si aplica (dias)" value={retiro} onChange={setRetiro} step="1" />
        </div>
      </FormOptionalPanel>
      <PhotoField onChange={setFoto} />
      <ObservationField value={observaciones} onChange={setObservaciones} />
      <button className="primary-action">
        <Save size={21} />
        <span>Guardar medicamento</span>
      </button>
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
    <form className="form-grid flow-form" onSubmit={handleSubmit}>
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
      <button className="primary-action">
        <Save size={21} />
        <span>Guardar registro</span>
      </button>
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
    <form className="form-grid flow-form" onSubmit={handleSubmit}>
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
      <button className="primary-action">
        <Save size={21} />
        <span>Guardar capacitacion</span>
      </button>
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
