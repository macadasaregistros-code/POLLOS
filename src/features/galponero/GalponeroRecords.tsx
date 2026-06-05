import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  Bug,
  Camera,
  CalendarDays,
  Check,
  CheckCircle2,
  Crosshair,
  Dog,
  Droplets,
  Eraser,
  Flame,
  FlaskConical,
  GraduationCap,
  Info,
  MapPin,
  NotebookPen,
  PackagePlus,
  PawPrint,
  PenLine,
  Pill,
  Save,
  ShieldCheck,
  Sprout,
  SquarePlus,
  Syringe,
  Trash2,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import {
  aplicarVacuna,
  actualizarActividad,
  registrarCapacitacion,
  registrarControlAgua,
  registrarEntradaAlimento,
  registrarEntradaMaterial,
  registrarMedicamento,
  registrarPerro,
  registrarPlaga,
} from '../../services/domainService';
import { db } from '../../services/localDbService';
import type { AgendaRecordContext } from '../../services/agendaService';
import { getDiaLote, todayISO } from '../../lib/date';
import { fileToDataUrl } from '../../lib/photo';
import { fmtNumber } from '../../lib/format';
import { avesVivasTotal, sumLoteTotals } from '../../services/calculationsService';
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
    subtitle: 'Roedores, mosca y estaciones',
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
const vaccinationRecordStatus = 'EN PROCESO';
const medicationRecordStatus = 'EN PROCESO';
const dogRecordStatus = 'EN PROCESO';
const trainingRecordStatus = 'EN PROCESO';
const vaccinationViaAplicacion = 'Agua de bebida';
const vaccinationProductCatalog = [
  { nombreProducto: 'Newcastle', enfermedad: 'Newcastle', cepa: 'Según producto' },
  { nombreProducto: 'Gumboro', enfermedad: 'Gumboro', cepa: 'Según producto' },
] as const;
const veterinaryDoctors = ['Esteban Salazar', 'Leidy Murillo'] as const;
type VeterinaryDoctor = (typeof veterinaryDoctors)[number];
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
const dogTypeOptions = [
  { value: 'RABIA', label: 'Rabia', icon: <PawPrint size={30} /> },
  { value: 'DESPARASITACION', label: 'Desparasitacion', icon: <ShieldCheck size={30} /> },
] as const;
type DogRecordType = (typeof dogTypeOptions)[number]['value'];
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
  recordContext?: AgendaRecordContext;
  onActiveKindChange?: (kind: ActivityRecordKind | '') => void;
  onSaved: (message: string) => void;
}

interface EntradaViewProps {
  user: Usuario;
  activeEntry?: EntryKind | '';
  onActiveEntryChange?: (entry: EntryKind | '') => void;
  onSaved: (message: string) => void;
}

export function GalponeroActivityRecords({ user, activeKind, recordContext, onActiveKindChange, onSaved }: ActivityRecordsProps) {
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
        {resolvedActiveKind === 'vacunacion' && <VaccinationRecordForm user={user} context={recordContext} onSaved={onSaved} />}
        {resolvedActiveKind === 'agua' && <WaterTreatmentForm user={user} context={recordContext} onSaved={onSaved} />}
        {resolvedActiveKind === 'plagas' && <PestControlForm user={user} context={recordContext} onSaved={onSaved} />}
        {resolvedActiveKind === 'medicamento' && <MedicationForm user={user} onSaved={onSaved} />}
        {resolvedActiveKind === 'compostaje' && <CompostingPanel />}
        {resolvedActiveKind === 'perros' && <DogRecordForm user={user} context={recordContext} onSaved={onSaved} />}
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

async function completeLinkedActivities(context: AgendaRecordContext | undefined, user: Usuario): Promise<void> {
  const activityIds = context?.activityIds ?? [];
  if (!activityIds.length) return;
  await Promise.all(activityIds.map((activityId) => actualizarActividad(activityId, 'REALIZADA', user)));
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
  const showHero = context !== 'Registro';

  return (
    <section className={`native-record-screen native-record-screen--${option.tone} ${showHero ? '' : 'native-record-screen--no-hero'}`}>
      {showHero && (
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
      )}
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

function VaccinationRecordForm({ user, context, onSaved }: { user: Usuario; context?: AgendaRecordContext; onSaved: (message: string) => void }) {
  const vacunas = useLiveQuery(() => db.vacunasLote.toArray(), []);
  const lotes = useLiveQuery(() => db.lotes.toArray(), []);
  const registrosDiarios = useLiveQuery(() => db.registroDiarioLote.toArray(), []);
  const [fechaRegistro] = useState(() => todayISO());
  const [nombreProducto, setNombreProducto] = useState('');
  const [loteId, setLoteId] = useState('');
  const [loteProducto, setLoteProducto] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [medicoVeterinario, setMedicoVeterinario] = useState<VeterinaryDoctor | ''>('');
  const [foto, setFoto] = useState('');
  const [error, setError] = useState('');
  const sortedVacunas = useMemo(
    () => (vacunas ?? []).slice().sort((left, right) => left.FechaProgramada.localeCompare(right.FechaProgramada)),
    [vacunas],
  );
  const contextVacuna = useMemo(
    () => sortedVacunas.find((vacuna) => vacuna.VacunaLoteID === context?.vacunaId),
    [context?.vacunaId, sortedVacunas],
  );
  const lotesById = useMemo(() => new Map((lotes ?? []).map((loteItem) => [loteItem.LoteID, loteItem])), [lotes]);
  const selectedProductInfo = vaccinationProductCatalog.find((product) => product.nombreProducto === nombreProducto);
  const productVacunas = useMemo(
    () =>
      nombreProducto
        ? sortedVacunas.filter((vacuna) => vacuna.Estado !== 'APLICADA' && matchesVaccinationProduct(vacuna, nombreProducto))
        : [],
    [nombreProducto, sortedVacunas],
  );
  const loteOptions = useMemo(() => {
    const seen = new Set<string>();
    return productVacunas.reduce<Lote[]>((options, vacuna) => {
      const optionLote = lotesById.get(vacuna.LoteID);
      if (optionLote && !seen.has(optionLote.LoteID)) {
        seen.add(optionLote.LoteID);
        options.push(optionLote);
      }
      return options;
    }, []);
  }, [lotesById, productVacunas]);
  const selected = contextVacuna && contextVacuna.Estado !== 'APLICADA' ? contextVacuna : productVacunas.find((vacuna) => vacuna.LoteID === loteId) ?? productVacunas[0];
  const lote = selected ? lotesById.get(selected.LoteID) : undefined;
  const registrosLote = useMemo(
    () => (registrosDiarios ?? []).filter((registro) => registro.LoteID === lote?.LoteID),
    [lote?.LoteID, registrosDiarios],
  );
  const loteTotals = useMemo(() => sumLoteTotals(registrosLote), [registrosLote]);
  const enfermedad = selected?.Enfermedad || selectedProductInfo?.enfermedad || '';
  const cepa = selected?.Cepa || selectedProductInfo?.cepa || (selected ? 'Segun producto' : '');
  const edadAvesDias = lote ? getDiaLote(lote.FechaLlegada, fechaRegistro) : selected?.EdadDias || selected?.DiaProgramado || 0;
  const numeroAnimalesVacunados = lote ? avesVivasTotal(lote, loteTotals) : selected?.NumeroAves || 0;

  useEffect(() => {
    if (contextVacuna) {
      const catalogProduct = vaccinationProductCatalog.find((product) => matchesVaccinationProduct(contextVacuna, product.nombreProducto));
      setNombreProducto(catalogProduct?.nombreProducto ?? contextVacuna.NombreVacuna);
      setLoteId(contextVacuna.LoteID);
      return;
    }
    if (!nombreProducto) {
      if (loteId) setLoteId('');
      return;
    }
    if (loteId && productVacunas.some((vacuna) => vacuna.LoteID === loteId)) return;
    setLoteId(productVacunas[0]?.LoteID ?? '');
  }, [contextVacuna, loteId, nombreProducto, productVacunas]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fechaRegistro) {
      setError('La fecha de registro es obligatoria.');
      return;
    }
    if (!nombreProducto) {
      setError('Selecciona un producto.');
      return;
    }
    if (!selected || !lote) {
      setError('No hay una vacuna programada pendiente para ese producto y lote.');
      return;
    }
    if (!enfermedad || !cepa) {
      setError('La informacion automatica del producto esta incompleta.');
      return;
    }
    if (!loteProducto.trim()) {
      setError('Ingresa el numero de lote del producto.');
      return;
    }
    if (!vencimiento) {
      setError('Selecciona la fecha de vencimiento.');
      return;
    }
    if (!medicoVeterinario) {
      setError('Selecciona el medico veterinario.');
      return;
    }

    await aplicarVacuna(selected.VacunaLoteID, user, {
      Producto: nombreProducto,
      Laboratorio: '',
      LoteProducto: loteProducto.trim(),
      FechaVencimientoProducto: vencimiento,
      ViaAdministracion: vaccinationViaAplicacion,
      Cepa: cepa,
      Enfermedad: enfermedad,
      NumeroAves: numeroAnimalesVacunados,
      EdadDias: edadAvesDias,
      Responsable: medicoVeterinario,
      FirmaResponsable: '',
      Foto: foto,
      Observacion: '',
    });
    await completeLinkedActivities(context, user);
    setLoteProducto('');
    setVencimiento('');
    setMedicoVeterinario('');
    setFoto('');
    setError('');
    onSaved('Vacunación registrada offline.');
  }

  return (
    <form className="form-grid flow-form vaccination-record-form" onSubmit={handleSubmit}>
      <section className="water-date-card vaccination-date-card" aria-label="Fecha y estado del registro">
        <span className="water-date-card__icon">
          <CalendarDays size={30} />
        </span>
        <div className="water-date-card__date">
          <span>Fecha de Registro</span>
          <strong>{formatWaterDate(fechaRegistro)}</strong>
        </div>
        <div className="water-date-card__status">
          <span>Estado</span>
          <strong>{vaccinationRecordStatus}</strong>
        </div>
      </section>

      <section className="water-form-card vaccination-main-card">
        <header className="vaccination-main-card__header">
          <span className="vaccination-main-card__icon" aria-hidden="true">
            <Syringe size={44} />
          </span>
          <strong>VACUNACIÓN</strong>
        </header>

        <VaccinationStepTitle number={1} title="Nombre del Producto" />
        <div className="vaccination-option-grid" role="radiogroup" aria-label="Nombre del Producto">
          {vaccinationProductCatalog.map((product) => (
            <VaccinationOptionTile
              key={product.nombreProducto}
              label={product.nombreProducto}
              selected={nombreProducto === product.nombreProducto}
              onSelect={() => {
                setNombreProducto(product.nombreProducto);
                setError('');
              }}
            />
          ))}
        </div>
        <p className="vaccination-helper-text">Seleccione el producto</p>

        <div className="water-form-divider" />

        <VaccinationStepTitle number={2} title="Información del producto" detail="(automática)" />
        <div className="vaccination-field-grid">
          <VaccinationReadOnlyField label="Enfermedad" value={enfermedad || 'Seleccione producto'} helper="Se selecciona automáticamente" />
          <VaccinationReadOnlyField label="Cepa" value={cepa || 'Seleccione producto'} helper="Se selecciona automáticamente" />
        </div>

        <div className="water-form-divider" />

        <VaccinationStepTitle number={3} title="Información manual" />
        <div className="vaccination-field-grid vaccination-field-grid--manual">
          <label className="vaccination-field">
            <span>Número de lote producto</span>
            <input
              value={loteProducto}
              placeholder="Ingrese el lote"
              required
              onChange={(event) => {
                setLoteProducto(event.target.value);
                setError('');
              }}
            />
          </label>
          <label className="vaccination-field">
            <span>Fecha de vencimiento</span>
            <input
              type="date"
              value={vencimiento}
              required
              aria-label="Seleccionar fecha"
              onChange={(event) => {
                setVencimiento(event.target.value);
                setError('');
              }}
            />
          </label>
          <VaccinationReadOnlyField label="Vía de Aplicación" value={vaccinationViaAplicacion} />
        </div>

        {nombreProducto && loteOptions.length > 1 && (
          <label className="vaccination-lote-selector">
            <span>Lote de aves</span>
            <select
              value={loteId}
              required
              onChange={(event) => {
                setLoteId(event.target.value);
                setError('');
              }}
            >
              {loteOptions.map((loteOption) => (
                <option key={loteOption.LoteID} value={loteOption.LoteID}>
                  {loteOption.CodigoLote}
                </option>
              ))}
            </select>
          </label>
        )}

        {nombreProducto && productVacunas.length === 0 && (
          <p className="vaccination-helper-text vaccination-helper-text--warning">
            No hay vacuna programada pendiente para este producto.
          </p>
        )}

        <div className="water-form-divider" />

        <VaccinationStepTitle number={4} title="Información calculada" />
        <div className="vaccination-field-grid">
          <VaccinationReadOnlyField label="Edad de las aves" value={edadAvesDias ? `${edadAvesDias} días` : 'Sin lote'} helper="Calculada por la app" />
          <VaccinationReadOnlyField
            label="Número de animales vacunados"
            value={numeroAnimalesVacunados ? fmtNumber(numeroAnimalesVacunados) : 'Sin lote'}
            helper="Calculado según el lote"
          />
        </div>

        <div className="water-form-divider" />

        <VaccinationStepTitle number={5} title="Médico Veterinario" />
        <div className="vaccination-option-grid" role="radiogroup" aria-label="Médico Veterinario">
          {veterinaryDoctors.map((doctor) => (
            <VaccinationOptionTile
              key={doctor}
              label={doctor}
              selected={medicoVeterinario === doctor}
              onSelect={() => {
                setMedicoVeterinario(doctor);
                setError('');
              }}
            />
          ))}
        </div>

        <div className="water-form-divider" />

        <VaccinationStepTitle number={6} title="FOTO" />
        <VaccinationPhotoField value={foto} onChange={setFoto} />
      </section>

      {error && <p className="water-form-error vaccination-form-error" role="alert">{error}</p>}

      <button className="primary-action vaccination-save-button">
        <Save size={24} />
        <span>Guardar Registro</span>
      </button>
    </form>
  );
}

function VaccinationPhotoField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  async function handleFile(file?: File | null) {
    onChange(await fileToDataUrl(file));
  }

  return (
    <label className="vaccination-photo-field">
      <span>FOTO</span>
      <strong>{value ? 'Foto lista' : 'Tomar foto del producto'}</strong>
      <input type="file" accept="image/*" capture="environment" onChange={(event) => void handleFile(event.target.files?.[0])} />
    </label>
  );
}

function VaccinationStepTitle({ number, title, detail }: { number: number; title: string; detail?: string }) {
  return (
    <header className="vaccination-step-title">
      <span>{number}</span>
      <strong>{title}</strong>
      {detail && <em>{detail}</em>}
    </header>
  );
}

function VaccinationOptionTile({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`vaccination-option-tile ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <strong>{label}</strong>
      {selected && (
        <span className="vaccination-option-tile__check" aria-hidden="true">
          <Check size={18} />
        </span>
      )}
    </button>
  );
}

function VaccinationReadOnlyField({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="vaccination-field vaccination-field--readonly">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </div>
  );
}

function matchesVaccinationProduct(vacuna: { NombreVacuna: string; Producto: string }, productName: string): boolean {
  const normalizedProduct = normalizeVaccinationName(productName);
  return [vacuna.NombreVacuna, vacuna.Producto].some((value) => normalizeVaccinationName(value).includes(normalizedProduct));
}

function normalizeVaccinationName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function WaterTreatmentForm({ user, context, onSaved }: { user: Usuario; context?: AgendaRecordContext; onSaved: (message: string) => void }) {
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

  useEffect(() => {
    if (context?.loteId) selection.setLoteId(context.loteId);
    if (context?.galponId) selection.setGalponId(context.galponId);
  }, [context?.galponId, context?.loteId, selection.setGalponId, selection.setLoteId]);

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
    await completeLinkedActivities(context, user);
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
        <RecordFormCardTitle icon={<Droplets size={38} />} title="TRATAMIENTO DE AGUA" />
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

function RecordFormCardTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <header className="record-form-card-title">
      <span className="record-form-card-title__icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{title}</strong>
    </header>
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

function PestControlForm({ user, context, onSaved }: { user: Usuario; context?: AgendaRecordContext; onSaved: (message: string) => void }) {
  const galpones = useLiveQuery(() => db.galpones.toArray(), []);
  const [fechaRegistro] = useState(() => todayISO());
  const [galponId, setGalponId] = useState('');
  const [selectedStationIds, setSelectedStationIds] = useState<number[]>([]);
  const [selectedFlyDosage, setSelectedFlyDosage] = useState<FlyDosageOption>('30 cc/bomba');
  const [error, setError] = useState('');

  useEffect(() => {
    if (context?.galponId) {
      setGalponId(context.galponId);
      return;
    }
    if (!galponId && galpones?.[0]) setGalponId(galpones[0].GalponID);
  }, [context?.galponId, galponId, galpones]);

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

    await completeLinkedActivities(context, user);
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

      <section className="water-form-card pest-title-card">
        <RecordFormCardTitle icon={<Bug size={38} />} title="CONTROL DE PLAGAS" />
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
              <RodentStationPin stationId={station.id} />
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

function RodentStationPin({ stationId }: { stationId: number }) {
  return (
    <span className="rodent-station-pin" aria-hidden="true">
      <svg className="rodent-station-pin__icon" viewBox="0 0 72 88" focusable="false">
        <path
          className="rodent-station-pin__body"
          d="M36 84C31.2 78.4 8 55.2 8 34.2 8 16.9 20.2 5 36 5s28 11.9 28 29.2C64 55.2 40.8 78.4 36 84Z"
        />
        <circle className="rodent-station-pin__ring" cx="36" cy="34.8" r="22.4" />
        <g className="rodent-station-pin__mouse">
          <path className="rodent-station-pin__tail" d="M52.2 45.1c8.2-.8 13.7 2 13.5 6.8-.3 5.8-8.8 8.2-20.4 5" />
          <ellipse className="rodent-station-pin__mouse-fill" cx="42.5" cy="43.5" rx="16.8" ry="11.6" transform="rotate(3 42.5 43.5)" />
          <path
            className="rodent-station-pin__mouse-fill"
            d="M31.2 35.4c-8.8-.3-16.2 4.1-20.2 10.7-.8 1.2-.2 2.9 1.2 3.5l15.4 6.4c6 2.4 12.7-1.8 13.1-8.2.5-6.6-3.7-12.2-9.5-12.4Z"
          />
          <circle className="rodent-station-pin__mouse-fill" cx="29.9" cy="29.5" r="6.5" />
          <circle className="rodent-station-pin__mouse-fill" cx="38.5" cy="30.4" r="5.5" />
          <ellipse className="rodent-station-pin__mouse-fill" cx="30.8" cy="54.2" rx="7.8" ry="2.3" transform="rotate(-7 30.8 54.2)" />
          <ellipse className="rodent-station-pin__mouse-fill" cx="44.9" cy="54.7" rx="9.2" ry="2.4" transform="rotate(-5 44.9 54.7)" />
        </g>
      </svg>
      <span className="rodent-station-marker__number">{stationId}</span>
    </span>
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
  const registrosDiarios = useLiveQuery(() => db.registroDiarioLote.toArray(), []);
  const [fechaRegistro] = useState(() => todayISO());
  const [nombreProducto, setNombreProducto] = useState('');
  const [numeroLoteProducto, setNumeroLoteProducto] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [viaAplicacion, setViaAplicacion] = useState('');
  const [medicoVeterinario, setMedicoVeterinario] = useState<VeterinaryDoctor | ''>('');
  const [foto, setFoto] = useState('');
  const [error, setError] = useState('');
  const registrosLote = useMemo(
    () => (registrosDiarios ?? []).filter((registro) => registro.LoteID === selection.selectedLote?.LoteID),
    [selection.selectedLote?.LoteID, registrosDiarios],
  );
  const loteTotals = useMemo(() => sumLoteTotals(registrosLote), [registrosLote]);
  const edadAvesDias = selection.selectedLote ? getDiaLote(selection.selectedLote.FechaLlegada, fechaRegistro) : 0;
  const numeroAnimalesTratados = selection.selectedLote ? avesVivasTotal(selection.selectedLote, loteTotals) : 0;
  const shouldShowLoteSelector = selection.lotes.length > 1 || selection.assignmentsForLote.length > 1;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!fechaRegistro) {
      setError('La fecha de registro es obligatoria.');
      return;
    }
    if (!selection.loteId || !selection.galponId || !selection.selectedLote) {
      setError('Selecciona un lote y galpón activo antes de guardar.');
      return;
    }
    if (!nombreProducto.trim()) {
      setError('Ingresa el nombre del producto.');
      return;
    }
    if (!numeroLoteProducto.trim()) {
      setError('Ingresa el número de lote del producto.');
      return;
    }
    if (!fechaVencimiento) {
      setError('Selecciona la fecha de vencimiento.');
      return;
    }
    if (!viaAplicacion.trim()) {
      setError('Ingresa la vía de aplicación.');
      return;
    }
    if (!medicoVeterinario) {
      setError('Selecciona el médico veterinario.');
      return;
    }

    await registrarMedicamento(
      {
        Fecha: fechaRegistro,
        Estado: medicationRecordStatus,
        LoteID: selection.loteId,
        GalponID: selection.galponId,
        Producto: nombreProducto.trim(),
        LoteProducto: numeroLoteProducto.trim(),
        FechaVencimiento: fechaVencimiento,
        ViaAdministracion: viaAplicacion.trim(),
        EdadDias: edadAvesDias,
        NumeroAnimalesTratados: numeroAnimalesTratados,
        Dosis: '',
        Motivo: '',
        Responsable: medicoVeterinario,
        PeriodoRetiroDias: 0,
        Foto: foto,
        Observaciones: '',
      },
      user,
    );
    setNombreProducto('');
    setNumeroLoteProducto('');
    setFechaVencimiento('');
    setViaAplicacion('');
    setMedicoVeterinario('');
    setFoto('');
    setError('');
    onSaved('Medicamento guardado offline.');
  }

  return (
    <form className="form-grid flow-form vaccination-record-form medication-record-form" noValidate onSubmit={handleSubmit}>
      <section className="water-date-card vaccination-date-card medication-date-card" aria-label="Fecha y estado del registro">
        <span className="water-date-card__icon">
          <CalendarDays size={30} />
        </span>
        <div className="water-date-card__date">
          <span>Fecha de Registro</span>
          <strong>{formatWaterDate(fechaRegistro)}</strong>
        </div>
        <div className="water-date-card__status">
          <span>Estado</span>
          <strong>{medicationRecordStatus}</strong>
        </div>
      </section>

      <section className="water-form-card vaccination-main-card medication-main-card">
        <header className="vaccination-main-card__header medication-main-card__header">
          <span className="vaccination-main-card__icon medication-main-card__icon" aria-hidden="true">
            <Pill size={42} />
          </span>
          <strong>MEDICAMENTOS</strong>
        </header>

        <label className="vaccination-field medication-field medication-field--full">
          <span>Nombre del Producto</span>
          <input
            value={nombreProducto}
            placeholder="Ingrese el nombre del producto"
            required
            onChange={(event) => {
              setNombreProducto(event.target.value);
              setError('');
            }}
          />
        </label>

        <div className="vaccination-field-grid medication-field-grid">
          <label className="vaccination-field medication-field">
            <span>Número de lote producto</span>
            <input
              value={numeroLoteProducto}
              placeholder="Ingrese el lote"
              required
              onChange={(event) => {
                setNumeroLoteProducto(event.target.value);
                setError('');
              }}
            />
          </label>
          <label className="vaccination-field medication-field">
            <span>Fecha de vencimiento</span>
            <input
              type="date"
              value={fechaVencimiento}
              required
              aria-label="Seleccionar fecha"
              onChange={(event) => {
                setFechaVencimiento(event.target.value);
                setError('');
              }}
            />
          </label>
        </div>

        <label className="vaccination-field medication-field medication-field--full">
          <span>Vía de Aplicación</span>
          <input
            value={viaAplicacion}
            placeholder="Ingrese la vía de aplicación"
            required
            onChange={(event) => {
              setViaAplicacion(event.target.value);
              setError('');
            }}
          />
        </label>

        {shouldShowLoteSelector && <MedicationLoteFields selection={selection} onChange={() => setError('')} />}

        {!selection.selectedLote && (
          <p className="vaccination-helper-text vaccination-helper-text--warning">
            No hay lote y galpón activos para calcular este registro.
          </p>
        )}

        <div className="water-form-divider" />

        <header className="medication-section-title">
          <Info size={20} />
          <strong>Información calculada</strong>
        </header>
        <div className="vaccination-field-grid medication-field-grid">
          <VaccinationReadOnlyField label="Edad de las aves" value={selection.selectedLote ? `${edadAvesDias} días` : 'Sin lote'} helper="Calculada por la app" />
          <VaccinationReadOnlyField
            label="Número de animales tratados"
            value={selection.selectedLote ? fmtNumber(numeroAnimalesTratados) : 'Sin lote'}
            helper="Calculado según el lote"
          />
        </div>

        <header className="medication-section-title medication-section-title--plain">
          <strong>Médico Veterinario</strong>
        </header>
        <div className="vaccination-option-grid medication-option-grid" role="radiogroup" aria-label="Médico Veterinario">
          {veterinaryDoctors.map((doctor) => (
            <VaccinationOptionTile
              key={doctor}
              label={doctor}
              selected={medicoVeterinario === doctor}
              onSelect={() => {
                setMedicoVeterinario(doctor);
                setError('');
              }}
            />
          ))}
        </div>

        <div className="water-form-divider" />

        <VaccinationPhotoField value={foto} onChange={setFoto} />
      </section>

      {error && <p className="water-form-error vaccination-form-error medication-form-error" role="alert">{error}</p>}

      <button className="primary-action vaccination-save-button medication-save-button">
        <Save size={24} />
        <span>Guardar Registro</span>
      </button>
    </form>
  );
}

function MedicationLoteFields({ selection, onChange }: { selection: ReturnType<typeof useLoteGalponSelection>; onChange: () => void }) {
  const hasMultipleLotes = selection.lotes.length > 1;
  const hasMultipleGalpones = selection.assignmentsForLote.length > 1;

  return (
    <div className="vaccination-field-grid medication-field-grid medication-lote-grid">
      {hasMultipleLotes && (
        <label className="vaccination-lote-selector">
          <span>Lote de aves</span>
          <select
            value={selection.loteId}
            required
            onChange={(event) => {
              selection.setLoteId(event.target.value);
              onChange();
            }}
          >
            {selection.lotes.map((lote) => (
              <option key={lote.LoteID} value={lote.LoteID}>
                {lote.CodigoLote}
              </option>
            ))}
          </select>
        </label>
      )}
      {hasMultipleGalpones && (
        <label className="vaccination-lote-selector">
          <span>Galpón</span>
          <select
            value={selection.galponId}
            required
            onChange={(event) => {
              selection.setGalponId(event.target.value);
              onChange();
            }}
          >
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

function DogRecordForm({ user, context, onSaved }: { user: Usuario; context?: AgendaRecordContext; onSaved: (message: string) => void }) {
  const perros = useLiveQuery(() => db.perros.toArray().then((items) => items.filter((perro) => perro.Activo)), []);
  const [fechaRegistro] = useState(() => todayISO());
  const [perroId, setPerroId] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<DogRecordType | ''>('');
  const [foto, setFoto] = useState('');
  const [error, setError] = useState('');
  const selectedPerro = (perros ?? []).find((perro) => perro.PerroID === perroId);
  const resolvedNombre = selectedPerro?.NombrePerro ?? nombre.trim();

  useEffect(() => {
    if (context?.perroId) setPerroId(context.perroId);
    if (context?.dogType) setTipo(context.dogType);
  }, [context?.dogType, context?.perroId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!resolvedNombre) {
      setError('Ingresa el nombre del perro.');
      return;
    }
    if (!tipo) {
      setError('Selecciona Rabia o Desparasitacion.');
      return;
    }
    if (!foto) {
      setError('Toma o selecciona una foto antes de guardar.');
      return;
    }

    await registrarPerro(
      {
        PerroID: selectedPerro?.PerroID,
        Fecha: fechaRegistro,
        NombrePerro: resolvedNombre,
        TipoRegistro: tipo,
        Producto: '',
        Laboratorio: '',
        LoteProducto: '',
        FechaVencimiento: '',
        Responsable: user.Nombre,
        FirmaResponsable: '',
        Foto: foto,
        Observaciones: '',
      },
      user,
    );
    await completeLinkedActivities(context, user);
    setNombre('');
    if (!context?.perroId) setPerroId('');
    setTipo('');
    setFoto('');
    setError('');
    onSaved('Registro de perros guardado offline.');
  }

  return (
    <form className="form-grid flow-form dog-record-form" noValidate onSubmit={handleSubmit}>
      <section className="water-date-card dog-date-card" aria-label="Fecha y estado del registro">
        <span className="water-date-card__icon">
          <CalendarDays size={30} />
        </span>
        <div className="water-date-card__date">
          <span>Fecha de Registro</span>
          <strong>{formatWaterDate(fechaRegistro)}</strong>
        </div>
        <div className="water-date-card__status">
          <span>Estado</span>
          <strong>{dogRecordStatus}</strong>
        </div>
      </section>

      <section className="water-form-card dog-main-card">
        <header className="dog-main-card__header">
          <span className="dog-main-card__icon" aria-hidden="true">
            <Dog size={46} />
          </span>
          <strong>PERROS</strong>
        </header>

        {(perros ?? []).length > 0 && (
          <label className="dog-field dog-field--full">
            <span>Perro</span>
            <select
              value={perroId}
              disabled={Boolean(context?.perroId)}
              onChange={(event) => {
                setPerroId(event.target.value);
                setNombre('');
                setError('');
              }}
            >
              <option value="">Nuevo perro</option>
              {(perros ?? []).map((perro) => (
                <option key={perro.PerroID} value={perro.PerroID}>
                  {perro.NombrePerro}
                </option>
              ))}
            </select>
          </label>
        )}

        {!selectedPerro && (
          <label className="dog-field dog-field--full">
            <span>Nombre Perro</span>
            <input
              value={nombre}
              placeholder="Ingrese el nombre del perro"
              required
              onChange={(event) => {
                setNombre(event.target.value);
                setError('');
              }}
            />
          </label>
        )}

        <div className="dog-type-section">
          <span>Tipo</span>
          <div className="dog-type-grid" role="radiogroup" aria-label="Tipo">
            {dogTypeOptions.map((option) => (
              <DogTypeOption
                key={option.value}
                icon={option.icon}
                label={option.label}
                selected={tipo === option.value}
                onSelect={() => {
                  setTipo(option.value);
                  setError('');
                }}
              />
            ))}
          </div>
        </div>

        <DogPhotoField
          value={foto}
          onChange={(value) => {
            setFoto(value);
            setError('');
          }}
        />
      </section>

      {error && <p className="water-form-error dog-form-error" role="alert">{error}</p>}

      <button className="primary-action dog-save-button">
        <Save size={24} />
        <span>Guardar Registro</span>
      </button>
    </form>
  );
}

function DogTypeOption({
  icon,
  label,
  selected,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`dog-type-option ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <span className="dog-type-option__radio" aria-hidden="true">
        {selected && <Check size={18} />}
      </span>
      <span className="dog-type-option__icon" aria-hidden="true">
        {icon}
      </span>
      <strong>{label}</strong>
    </button>
  );
}

function DogPhotoField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  async function handleFile(file?: File | null) {
    onChange(await fileToDataUrl(file));
  }

  return (
    <label className={`dog-photo-field ${value ? 'has-photo' : ''}`}>
      <span>Foto</span>
      <input type="file" accept="image/*" capture="environment" aria-label="Tomar foto o seleccionar" onChange={(event) => void handleFile(event.target.files?.[0])} />
      <div className="dog-photo-field__surface">
        {value ? (
          <img src={value} alt="Foto seleccionada del perro" />
        ) : (
          <>
            <span className="dog-photo-field__icon" aria-hidden="true">
              <Camera size={38} />
            </span>
            <strong>Tomar foto o seleccionar</strong>
            <small>La foto sera guardada con el registro</small>
          </>
        )}
      </div>
    </label>
  );
}

interface TrainingAssistantDraft {
  id: string;
  Nombre: string;
  Firma: string;
}

type TrainingSignatureTarget = { type: 'trainer' } | { type: 'assistant'; assistantId: string };

function createTrainingAssistantDraft(): TrainingAssistantDraft {
  return {
    id: `training-assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    Nombre: '',
    Firma: '',
  };
}

function TrainingForm({ user, onSaved }: { user: Usuario; onSaved: (message: string) => void }) {
  const [fechaRegistro] = useState(() => todayISO());
  const [tema, setTema] = useState('');
  const [capacitador, setCapacitador] = useState('');
  const [firmaCapacitador, setFirmaCapacitador] = useState('');
  const [asistentes, setAsistentes] = useState<TrainingAssistantDraft[]>(() => [createTrainingAssistantDraft()]);
  const [signatureTarget, setSignatureTarget] = useState<TrainingSignatureTarget | null>(null);
  const [error, setError] = useState('');
  const activeSignature = signatureTarget
    ? signatureTarget.type === 'trainer'
      ? { title: 'Firma del Capacitador', value: firmaCapacitador }
      : {
          title: 'Firma del asistente',
          value: asistentes.find((assistant) => assistant.id === signatureTarget.assistantId)?.Firma ?? '',
        }
    : null;

  function updateAssistant(id: string, key: 'Nombre' | 'Firma', value: string) {
    setAsistentes((current) => current.map((assistant) => (assistant.id === id ? { ...assistant, [key]: value } : assistant)));
  }

  function removeAssistant(id: string) {
    setAsistentes((current) => {
      if (current.length <= 1) return [createTrainingAssistantDraft()];
      return current.filter((assistant) => assistant.id !== id);
    });
    setError('');
  }

  function addAssistant() {
    setAsistentes((current) => [...current, createTrainingAssistantDraft()]);
    setError('');
  }

  function saveSignature(value: string) {
    if (!signatureTarget) return;
    if (signatureTarget.type === 'trainer') {
      setFirmaCapacitador(value);
    } else {
      updateAssistant(signatureTarget.assistantId, 'Firma', value);
    }
    setSignatureTarget(null);
    setError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const normalizedAssistants = asistentes.map((assistant) => ({
      Nombre: assistant.Nombre.trim(),
      Firma: assistant.Firma,
    }));

    if (!fechaRegistro) {
      setError('La fecha de registro es obligatoria.');
      return;
    }
    if (!tema.trim()) {
      setError('Ingresa el tema de la capacitación.');
      return;
    }
    if (!capacitador.trim()) {
      setError('Ingresa el nombre del capacitador.');
      return;
    }
    if (!firmaCapacitador) {
      setError('La firma del capacitador es obligatoria.');
      return;
    }
    if (!normalizedAssistants.some((assistant) => assistant.Nombre || assistant.Firma)) {
      setError('Registra al menos un asistente con nombre y firma.');
      return;
    }
    if (normalizedAssistants.some((assistant) => !assistant.Nombre || !assistant.Firma)) {
      setError('Cada asistente debe tener nombre y firma. Completa o elimina las filas vacías.');
      return;
    }

    await registrarCapacitacion(
      {
        Fecha: fechaRegistro,
        Tema: tema.trim(),
        Capacitador: capacitador.trim(),
        FirmaCapacitador: firmaCapacitador,
        Observaciones: '',
        Asistentes: normalizedAssistants,
      },
      user,
    );
    setTema('');
    setCapacitador('');
    setFirmaCapacitador('');
    setAsistentes([createTrainingAssistantDraft()]);
    setError('');
    onSaved('Capacitación guardada offline.');
  }

  return (
    <form className="form-grid flow-form training-record-form" noValidate onSubmit={handleSubmit}>
      <section className="water-date-card training-date-card" aria-label="Fecha y estado del registro">
        <span className="water-date-card__icon">
          <CalendarDays size={30} />
        </span>
        <div className="water-date-card__date">
          <span>Fecha de Registro</span>
          <strong>{formatWaterDate(fechaRegistro)}</strong>
        </div>
        <div className="water-date-card__status">
          <span>Estado</span>
          <strong>{trainingRecordStatus}</strong>
        </div>
      </section>

      <section className="water-form-card training-main-card">
        <header className="training-main-card__header">
          <span className="training-main-card__icon" aria-hidden="true">
            <GraduationCap size={46} />
          </span>
          <strong>CAPACITACIONES</strong>
        </header>

        <label className="training-field training-field--full">
          <span>Tema</span>
          <input
            value={tema}
            placeholder="Ingrese el tema de la capacitación"
            required
            onChange={(event) => {
              setTema(event.target.value);
              setError('');
            }}
          />
        </label>

        <label className="training-field training-field--full">
          <span>Capacitador</span>
          <input
            value={capacitador}
            placeholder="Ingrese el nombre del capacitador"
            required
            onChange={(event) => {
              setCapacitador(event.target.value);
              setError('');
            }}
          />
        </label>

        <TrainingSignatureField
          label="Firma del Capacitador"
          value={firmaCapacitador}
          title="Firmar aquí"
          helper="El capacitador debe firmar en el área inferior"
          onOpen={() => setSignatureTarget({ type: 'trainer' })}
        />

        <section className="training-assistants-section">
          <header className="training-assistants-section__header">
            <span className="training-assistants-section__icon" aria-hidden="true">
              <Users size={34} />
            </span>
            <strong>ASISTENTES</strong>
          </header>

          <div className="training-assistants-headings" aria-hidden="true">
            <span>Nombre</span>
            <span>Firma</span>
          </div>

          <div className="training-assistant-list">
            {asistentes.map((assistant) => (
              <div key={assistant.id} className="training-assistant-row">
                <label className="training-assistant-name">
                  <span>Nombre</span>
                  <input
                    value={assistant.Nombre}
                    placeholder="Nombre del asistente"
                    required
                    onChange={(event) => {
                      updateAssistant(assistant.id, 'Nombre', event.target.value);
                      setError('');
                    }}
                  />
                </label>
                <TrainingSignatureField
                  compact
                  label="Firma"
                  value={assistant.Firma}
                  title="Firmar aquí"
                  helper="Firma del asistente"
                  onOpen={() => setSignatureTarget({ type: 'assistant', assistantId: assistant.id })}
                />
                <button className="training-remove-assistant" type="button" aria-label="Eliminar asistente" onClick={() => removeAssistant(assistant.id)}>
                  <Trash2 size={24} />
                </button>
              </div>
            ))}
          </div>

          <button className="training-add-assistant" type="button" onClick={addAssistant}>
            <SquarePlus size={24} />
            <span>Agregar asistente</span>
          </button>
        </section>
      </section>

      {error && <p className="water-form-error training-form-error" role="alert">{error}</p>}

      <button className="primary-action training-save-button">
        <Save size={25} />
        <span>Guardar Registro</span>
      </button>

      {activeSignature && (
        <TrainingSignatureModal
          title={activeSignature.title}
          value={activeSignature.value}
          onCancel={() => setSignatureTarget(null)}
          onSave={saveSignature}
        />
      )}
    </form>
  );
}

function TrainingSignatureField({
  label,
  value,
  title,
  helper,
  compact = false,
  onOpen,
}: {
  label: string;
  value: string;
  title: string;
  helper: string;
  compact?: boolean;
  onOpen: () => void;
}) {
  return (
    <div className={`training-signature-field ${compact ? 'training-signature-field--compact' : ''}`}>
      <span className="training-signature-field__label">{label}</span>
      <button className={`training-signature-field__surface ${value ? 'has-signature' : ''}`} type="button" onClick={onOpen}>
        {value ? (
          <>
            <img src={value} alt={label} />
            <span className="training-signature-field__status" aria-hidden="true">
              <CheckCircle2 size={20} />
            </span>
            <strong>Firma registrada</strong>
            <small>Tocar para volver a firmar</small>
          </>
        ) : (
          <>
            <span className="training-signature-field__icon" aria-hidden="true">
              <PenLine size={compact ? 30 : 42} />
            </span>
            <strong>{title}</strong>
            <small>{helper}</small>
          </>
        )}
      </button>
    </div>
  );
}

function TrainingSignatureModal({
  title,
  value,
  onCancel,
  onSave,
}: {
  title: string;
  value: string;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasInkRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const ratio = window.devicePixelRatio || 1;
    const context = canvas.getContext('2d');
    let cancelled = false;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    if (!context) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    clearSignatureCanvas(context, width, height);
    hasInkRef.current = false;

    if (value) {
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        context.drawImage(image, 0, 0, width, height);
        configureSignatureContext(context);
        hasInkRef.current = true;
      };
      image.src = value;
    }

    return () => {
      cancelled = true;
    };
  }, [value]);

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext('2d');
    if (!context) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event);
    configureSignatureContext(context);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
    isDrawingRef.current = true;
    hasInkRef.current = true;
    lastPointRef.current = point;
    setModalError('');
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;

    const context = event.currentTarget.getContext('2d');
    if (!context) return;

    event.preventDefault();
    const point = getCanvasPoint(event);
    const lastPoint = lastPointRef.current ?? point;
    configureSignatureContext(context);
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    lastPointRef.current = point;
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    clearSignatureCanvas(context, rect.width, rect.height);
    hasInkRef.current = false;
    setModalError('');
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInkRef.current) {
      setModalError('Dibuja la firma antes de guardar.');
      return;
    }
    onSave(canvas.toDataURL('image/png'));
  }

  return (
    <div className="training-signature-modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="training-signature-modal__panel">
        <header className="training-signature-modal__header">
          <strong>{title}</strong>
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        </header>
        <canvas
          ref={canvasRef}
          className="training-signature-canvas"
          aria-label="Área para dibujar la firma"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
        />
        {modalError && <p className="training-signature-modal__error">{modalError}</p>}
        <div className="training-signature-modal__actions">
          <button type="button" className="training-signature-modal__clear" onClick={handleClear}>
            <Eraser size={20} />
            <span>Limpiar</span>
          </button>
          <button type="button" className="training-signature-modal__save" onClick={handleSave}>
            <Check size={20} />
            <span>Guardar firma</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function configureSignatureContext(context: CanvasRenderingContext2D) {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = 3.4;
  context.strokeStyle = '#1f2925';
}

function clearSignatureCanvas(context: CanvasRenderingContext2D, width: number, height: number) {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  configureSignatureContext(context);
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
