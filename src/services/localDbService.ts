import Dexie, { type Table, type Transaction } from 'dexie';
import { createDemoData } from '../data/demoData';
import { isRoutineActivity } from './routineService';
import type {
  ActividadLote,
  ActividadProgramada,
  Alerta,
  Capacitacion,
  CapacitacionAsistente,
  CierreLote,
  CierreSemanal,
  Cliente,
  CompostajeCajon,
  CompostajeRegistro,
  ConsumoAlimentoLote,
  ControlAgua,
  CostoLote,
  CurvaEstandar,
  DetalleFacturaCompra,
  DetalleFacturaVenta,
  EntradaAlimento,
  EntradaMaterial,
  EventoSanitario,
  FacturaCompra,
  FacturaVenta,
  Galpon,
  HistorialCambio,
  InventarioAlimento,
  InventarioMaterial,
  Lote,
  LoteGalpon,
  MaterialLote,
  MedicamentoRegistro,
  MovimientoEntreGalpones,
  MovimientoInventarioAlimento,
  MovimientoInventarioMaterial,
  Pesaje,
  PesajeDetalle,
  PlanVacunalBase,
  Perro,
  PerroRegistro,
  Proveedor,
  RegistroDiarioLote,
  RegistroPlaga,
  ReportePDF,
  SalidaPollo,
  SyncEntityTable,
  SyncQueueItem,
  TipoAlimento,
  TratamientoVeterinario,
  Usuario,
  VacunaLote,
} from '../types/entities';

export const POLLOS_DB_NAME = 'pollos-offline-db';

const REQUIRED_STORE_NAMES = [
  'usuarios',
  'galpones',
  'lotes',
  'loteGalpones',
  'movimientosEntreGalpones',
  'registroDiarioLote',
  'pesajes',
  'pesajeDetalle',
  'salidasPollo',
  'actividadesProgramadas',
  'actividadesLote',
  'planVacunalBase',
  'vacunasLote',
  'entradasAlimento',
  'consumosAlimentoLote',
  'materialesLote',
  'controlesAgua',
  'eventosSanitarios',
  'tratamientosVeterinarios',
  'proveedores',
  'clientes',
  'tiposAlimento',
  'facturasCompra',
  'detalleFacturasCompra',
  'facturasVenta',
  'detalleFacturasVenta',
  'costosLote',
  'inventarioAlimento',
  'movimientosInventarioAlimento',
  'curvasEstandar',
  'cierresSemanales',
  'cierreLote',
  'alertas',
  'historialCambios',
  'reportesPDF',
  'syncQueue',
] as const;

export class PollosDb extends Dexie {
  usuarios!: Table<Usuario, string>;
  galpones!: Table<Galpon, string>;
  lotes!: Table<Lote, string>;
  loteGalpones!: Table<LoteGalpon, string>;
  movimientosEntreGalpones!: Table<MovimientoEntreGalpones, string>;
  registroDiarioLote!: Table<RegistroDiarioLote, string>;
  pesajes!: Table<Pesaje, string>;
  pesajeDetalle!: Table<PesajeDetalle, string>;
  salidasPollo!: Table<SalidaPollo, string>;
  actividadesProgramadas!: Table<ActividadProgramada, string>;
  actividadesLote!: Table<ActividadLote, string>;
  planVacunalBase!: Table<PlanVacunalBase, string>;
  vacunasLote!: Table<VacunaLote, string>;
  entradasAlimento!: Table<EntradaAlimento, string>;
  consumosAlimentoLote!: Table<ConsumoAlimentoLote, string>;
  materialesLote!: Table<MaterialLote, string>;
  entradasMaterial!: Table<EntradaMaterial, string>;
  inventarioMaterial!: Table<InventarioMaterial, string>;
  movimientosInventarioMaterial!: Table<MovimientoInventarioMaterial, string>;
  controlesAgua!: Table<ControlAgua, string>;
  eventosSanitarios!: Table<EventoSanitario, string>;
  tratamientosVeterinarios!: Table<TratamientoVeterinario, string>;
  registrosPlaga!: Table<RegistroPlaga, string>;
  compostajeCajones!: Table<CompostajeCajon, string>;
  compostajeRegistros!: Table<CompostajeRegistro, string>;
  medicamentos!: Table<MedicamentoRegistro, string>;
  perros!: Table<Perro, string>;
  perrosRegistros!: Table<PerroRegistro, string>;
  capacitaciones!: Table<Capacitacion, string>;
  capacitacionAsistentes!: Table<CapacitacionAsistente, string>;
  proveedores!: Table<Proveedor, string>;
  clientes!: Table<Cliente, string>;
  tiposAlimento!: Table<TipoAlimento, string>;
  facturasCompra!: Table<FacturaCompra, string>;
  detalleFacturasCompra!: Table<DetalleFacturaCompra, string>;
  facturasVenta!: Table<FacturaVenta, string>;
  detalleFacturasVenta!: Table<DetalleFacturaVenta, string>;
  costosLote!: Table<CostoLote, string>;
  inventarioAlimento!: Table<InventarioAlimento, string>;
  movimientosInventarioAlimento!: Table<MovimientoInventarioAlimento, string>;
  curvasEstandar!: Table<CurvaEstandar, string>;
  cierresSemanales!: Table<CierreSemanal, string>;
  cierreLote!: Table<CierreLote, string>;
  alertas!: Table<Alerta, string>;
  historialCambios!: Table<HistorialCambio, string>;
  reportesPDF!: Table<ReportePDF, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super(POLLOS_DB_NAME);
    this.version(2).stores({
      usuarios: '&UsuarioID, Rol, Activo',
      galpones: '&GalponID, EstadoActual, Activo',
      lotes: '&LoteID, CodigoLote, EstadoLote, FechaLlegada',
      loteGalpones: '&LoteGalponID, LoteID, GalponID, Estado',
      movimientosEntreGalpones: '&MovimientoID, LoteID, Fecha',
      registroDiarioLote: '&RegistroDiarioID, LoteID, Fecha, EstadoSync, FechaHoraRegistro',
      pesajes: '&PesajeID, LoteID, Fecha, EstadoSync',
      pesajeDetalle: '&PesajeDetalleID, PesajeID, LoteID, Sexo, EstadoSync',
      salidasPollo: '&SalidaID, LoteID, Fecha, TipoSalida, EstadoSync',
      actividadesProgramadas: '&ActividadProgramadaID, TipoFrecuencia, DiaLote, Activa',
      actividadesLote: '&ActividadLoteID, LoteID, GalponID, FechaProgramada, Estado, EstadoSync',
      planVacunalBase: '&VacunaBaseID, DiaProgramado, Activa',
      vacunasLote: '&VacunaLoteID, LoteID, FechaProgramada, Estado, EstadoSync',
      entradasAlimento: '&EntradaAlimentoID, TipoAlimentoID, Fecha, EstadoSync, EstadoAdmin',
      consumosAlimentoLote: '&ConsumoID, LoteID, TipoAlimentoID, Fecha, EstadoSync',
      materialesLote: '&MaterialLoteID, LoteID, GalponID, TipoMaterial, Fecha, EstadoSync',
      controlesAgua: '&ControlAguaID, LoteID, GalponID, Fecha, EstadoSync',
      eventosSanitarios: '&EventoSanitarioID, LoteID, GalponID, Fecha, Severidad, EstadoSync',
      tratamientosVeterinarios: '&TratamientoID, LoteID, Estado',
      proveedores: '&ProveedorID, TipoProveedor, Activo',
      clientes: '&ClienteID, Activo',
      tiposAlimento: '&TipoAlimentoID, Activo',
      facturasCompra: '&FacturaCompraID, ProveedorID, FechaFactura, EstadoPago',
      detalleFacturasCompra: '&DetalleID, FacturaCompraID, LoteID',
      facturasVenta: '&FacturaVentaID, ClienteID, FechaFactura, EstadoCobro',
      detalleFacturasVenta: '&DetalleVentaID, FacturaVentaID, LoteID',
      costosLote: '&CostoID, LoteID, CategoriaCosto, Estado',
      inventarioAlimento: '&InventarioID, TipoAlimentoID',
      movimientosInventarioAlimento: '&MovimientoInventarioID, TipoAlimentoID, LoteID, Fecha, TipoMovimiento',
      curvasEstandar: '&CurvaID, [LineaGenetica+Sexo+DiaLote], DiaLote',
      cierresSemanales: '&CierreSemanalID, LoteID, SemanaLote, EstadoCierre',
      cierreLote: '&CierreLoteID, LoteID, EstadoCierre',
      alertas: '&AlertaID, LoteID, Fecha, Estado, Nivel',
      historialCambios: '&CambioID, Tabla, RegistroID, FechaHoraCambio',
      reportesPDF: '&ReporteID, LoteID, FechaGeneracion, TipoReporte',
      syncQueue: '&SyncID, Tabla, RegistroID, EstadoSync, CreadoEn',
    });

    this.version(3).stores({
      usuarios: '&UsuarioID, Rol, Activo',
      galpones: '&GalponID, EstadoActual, Activo',
      lotes: '&LoteID, CodigoLote, EstadoLote, FechaLlegada',
      loteGalpones: '&LoteGalponID, LoteID, GalponID, Estado',
      movimientosEntreGalpones: '&MovimientoID, LoteID, Fecha',
      registroDiarioLote: '&RegistroDiarioID, LoteID, Fecha, EstadoSync, FechaHoraRegistro',
      pesajes: '&PesajeID, LoteID, Fecha, EstadoSync',
      pesajeDetalle: '&PesajeDetalleID, PesajeID, LoteID, Sexo, EstadoSync',
      salidasPollo: '&SalidaID, LoteID, Fecha, TipoSalida, EstadoSync',
      actividadesProgramadas: '&ActividadProgramadaID, TipoFrecuencia, DiaLote, Activa',
      actividadesLote: '&ActividadLoteID, LoteID, GalponID, FechaProgramada, Estado, EstadoSync',
      planVacunalBase: '&VacunaBaseID, DiaProgramado, Activa',
      vacunasLote: '&VacunaLoteID, LoteID, FechaProgramada, Estado, EstadoSync',
      entradasAlimento: '&EntradaAlimentoID, TipoAlimentoID, Fecha, EstadoSync, EstadoAdmin',
      consumosAlimentoLote: '&ConsumoID, LoteID, TipoAlimentoID, Fecha, EstadoSync',
      materialesLote: '&MaterialLoteID, LoteID, GalponID, TipoMaterial, Fecha, EstadoSync',
      entradasMaterial: '&EntradaMaterialID, TipoMaterial, Fecha, EstadoSync, EstadoAdmin',
      inventarioMaterial: '&InventarioMaterialID, TipoMaterial',
      movimientosInventarioMaterial: '&MovimientoMaterialID, TipoMaterial, Fecha, TipoMovimiento',
      controlesAgua: '&ControlAguaID, LoteID, GalponID, Fecha, EstadoSync',
      eventosSanitarios: '&EventoSanitarioID, LoteID, GalponID, Fecha, Severidad, EstadoSync',
      tratamientosVeterinarios: '&TratamientoID, LoteID, Estado',
      registrosPlaga: '&RegistroPlagaID, TipoPlaga, Fecha, EstadoSync',
      compostajeCajones: '&CajonID, Estado, FechaInicio, EstadoSync',
      compostajeRegistros: '&RegistroCompostajeID, CajonID, Fecha, LoteID, EstadoSync',
      medicamentos: '&MedicamentoID, LoteID, Fecha, EstadoSync',
      perrosRegistros: '&PerroRegistroID, NombrePerro, TipoRegistro, Fecha, EstadoSync',
      capacitaciones: '&CapacitacionID, Fecha, EstadoSync',
      capacitacionAsistentes: '&AsistenteID, CapacitacionID, EstadoSync',
      proveedores: '&ProveedorID, TipoProveedor, Activo',
      clientes: '&ClienteID, Activo',
      tiposAlimento: '&TipoAlimentoID, Activo',
      facturasCompra: '&FacturaCompraID, ProveedorID, FechaFactura, EstadoPago',
      detalleFacturasCompra: '&DetalleID, FacturaCompraID, LoteID',
      facturasVenta: '&FacturaVentaID, ClienteID, FechaFactura, EstadoCobro',
      detalleFacturasVenta: '&DetalleVentaID, FacturaVentaID, LoteID',
      costosLote: '&CostoID, LoteID, CategoriaCosto, Estado',
      inventarioAlimento: '&InventarioID, TipoAlimentoID',
      movimientosInventarioAlimento: '&MovimientoInventarioID, TipoAlimentoID, LoteID, Fecha, TipoMovimiento',
      curvasEstandar: '&CurvaID, [LineaGenetica+Sexo+DiaLote], DiaLote',
      cierresSemanales: '&CierreSemanalID, LoteID, SemanaLote, EstadoCierre',
      cierreLote: '&CierreLoteID, LoteID, EstadoCierre',
      alertas: '&AlertaID, LoteID, Fecha, Estado, Nivel',
      historialCambios: '&CambioID, Tabla, RegistroID, FechaHoraCambio',
      reportesPDF: '&ReporteID, LoteID, FechaGeneracion, TipoReporte',
      syncQueue: '&SyncID, Tabla, RegistroID, EstadoSync, CreadoEn',
    });

    this.version(4).stores({
      perros: '&PerroID, NombrePerro, Activo, EstadoSync',
      perrosRegistros: '&PerroRegistroID, PerroID, NombrePerro, TipoRegistro, Fecha, EstadoSync',
    }).upgrade(async (transaction: Transaction) => {
      const perros = transaction.table('perros') as Table<Perro, string>;
      const registros = transaction.table('perrosRegistros') as Table<PerroRegistro, string>;
      const registrosActuales = await registros.toArray();
      const perrosByName = new Map<string, Perro>();
      const updatedRegistros: PerroRegistro[] = [];

      for (const registro of registrosActuales) {
        const nombre = registro.NombrePerro.trim();
        if (!nombre) continue;
        const key = nombre.toLowerCase();
        const existing = perrosByName.get(key);
        const perro: Perro = existing ?? {
          PerroID: `perro_migrado_${key.replace(/[^a-z0-9]+/g, '_')}`,
          NombrePerro: nombre,
          Activo: true,
          FechaUltimaRabia: '',
          FechaUltimaDesparasitacion: '',
          FrecuenciaRabiaDias: 365,
          FrecuenciaDesparasitacionDias: 90,
          Observaciones: '',
          EstadoSync: registro.EstadoSync,
        };

        if (registro.TipoRegistro === 'RABIA' && registro.Fecha > perro.FechaUltimaRabia) perro.FechaUltimaRabia = registro.Fecha;
        if (registro.TipoRegistro === 'DESPARASITACION' && registro.Fecha > perro.FechaUltimaDesparasitacion) {
          perro.FechaUltimaDesparasitacion = registro.Fecha;
        }

        perrosByName.set(key, perro);
        updatedRegistros.push({ ...registro, PerroID: registro.PerroID || perro.PerroID });
      }

      if (perrosByName.size) await perros.bulkPut([...perrosByName.values()]);
      if (updatedRegistros.length) await registros.bulkPut(updatedRegistros);
    });

    this.version(5).upgrade(async (transaction: Transaction) => {
      const reference = createDemoData();
      const actividades = transaction.table('actividadesProgramadas') as Table<ActividadProgramada, string>;
      const vacunas = transaction.table('planVacunalBase') as Table<PlanVacunalBase, string>;
      const legacyActivityIds = (await actividades.toCollection().primaryKeys())
        .filter((id): id is string => typeof id === 'string' && /^act_base_[0-9]{2}$/.test(id));

      if (legacyActivityIds.length) await actividades.bulkDelete(legacyActivityIds);
      await actividades.bulkPut(reference.actividadesProgramadas);
      await vacunas.bulkPut(reference.planVacunalBase);
    });

    this.version(6).upgrade(async (transaction: Transaction) => {
      const actividades = transaction.table('actividadesLote') as Table<ActividadLote, string>;
      const current = await actividades.toArray();
      const seenRoutineKeys = new Set<string>();
      const updates: ActividadLote[] = [];

      for (const activity of current.filter(isRoutineActivity)) {
        const key = `${activity.FechaProgramada}|${activity.NombreActividad}`;
        const duplicate = seenRoutineKeys.has(key);
        if (!duplicate) seenRoutineKeys.add(key);
        updates.push({
          ...activity,
          LoteID: '',
          GalponID: '',
          Estado: duplicate ? 'NO_APLICA' : activity.Estado,
          Observacion: duplicate && !activity.Observacion ? 'Rutina duplicada por lote' : activity.Observacion,
        });
      }

      if (updates.length) await actividades.bulkPut(updates);
    });
  }
}

export const db = new PollosDb();

const DEMO_PRIMARY_KEYS = new Set([
  'user_admin',
  'user_galponero',
  'prov_pollito_001',
  'prov_alimento_001',
  'cliente_demo_001',
  'alimento_preiniciador',
  'alimento_iniciador',
  'alimento_engorde',
  'pesaje_demo_001',
  'alerta_demo_vacuna',
]);

function isDemoPrimaryKey(key: unknown): boolean {
  if (typeof key !== 'string') return false;
  if (DEMO_PRIMARY_KEYS.has(key)) return true;
  return [
    'lote_demo_',
    'lote_galpon_demo_',
    'reg_demo_',
    'consumo_reg_demo_',
    'peso_m_',
    'peso_h_',
    'act_lote_',
    'act_rutina_',
    'vac_lote_',
    'perro_demo_',
    'perro_reg_demo_',
    'inv_alimento_',
  ].some((prefix) => key.startsWith(prefix));
}

async function getExistingStoreNames(): Promise<string[]> {
  const databaseInfo = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string | null }>> };
  const databases = await databaseInfo.databases?.();
  if (databases && !databases.some((database) => database.name === POLLOS_DB_NAME)) return [];

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(POLLOS_DB_NAME);
    request.onsuccess = () => {
      const database = request.result;
      const storeNames = Array.from(database.objectStoreNames);
      database.close();
      resolve(storeNames);
    };
    request.onerror = () => reject(request.error ?? new Error('No se pudo revisar la base local.'));
  });
}

async function ensurePollosSchemaBeforeOpen(): Promise<void> {
  if (db.isOpen()) return;

  const storeNames = await getExistingStoreNames();
  if (storeNames.length === 0) {
    await deletePollosDatabaseRaw();
    await db.open();
    return;
  }

  const existing = new Set(storeNames);
  const missingStore = REQUIRED_STORE_NAMES.some((storeName) => !existing.has(storeName));
  if (missingStore) {
    await deletePollosDatabaseRaw();
    await db.open();
  }
}

function formatDbError(stage: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(`${stage}: ${error.name}: ${error.message}`);
  }
  return new Error(`${stage}: error desconocido.`);
}

async function runDbStage<T>(stage: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw formatDbError(stage, error);
  }
}

export async function deletePollosDatabaseRaw(): Promise<void> {
  db.close();
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('La base local esta bloqueada por otra pestana. Cierra otras ventanas de POLLOS y vuelve a cargar.'));
      }
    }, 5000);

    const request = indexedDB.deleteDatabase(POLLOS_DB_NAME);
    request.onsuccess = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      reject(request.error ?? new Error('No se pudo borrar IndexedDB.'));
    };
  });
}

const DEFAULT_GALPONES: Galpon[] = [
  {
    GalponID: 'galpon_1A',
    NombreGalpon: '1A',
    Capacidad: 750,
    EstadoActual: 'ENGORDE',
    Observaciones: 'Galpón 1 superior',
    Activo: true,
  },
  {
    GalponID: 'galpon_1B',
    NombreGalpon: '1B',
    Capacidad: 750,
    EstadoActual: 'ENGORDE',
    Observaciones: 'Galpón 1 inferior',
    Activo: true,
  },
  {
    GalponID: 'galpon_2A',
    NombreGalpon: '2A',
    Capacidad: 750,
    EstadoActual: 'ENGORDE',
    Observaciones: 'Galpón 2 superior',
    Activo: true,
  },
  {
    GalponID: 'galpon_2B',
    NombreGalpon: '2B',
    Capacidad: 750,
    EstadoActual: 'ENGORDE',
    Observaciones: 'Galpón 2 inferior',
    Activo: true,
  },
  {
    GalponID: 'galpon_3A',
    NombreGalpon: '3A',
    Capacidad: 2500,
    EstadoActual: 'ENGORDE',
    Observaciones: 'Galpón 3 superior',
    Activo: true,
  },
  {
    GalponID: 'galpon_3B',
    NombreGalpon: '3B',
    Capacidad: 2500,
    EstadoActual: 'ENGORDE',
    Observaciones: 'Galpón 3 inferior',
    Activo: true,
  },
];

const REMOTE_DEFAULT_GALPONES: Galpon[] = DEFAULT_GALPONES.map((galpon) => ({
  ...galpon,
  EstadoActual: 'VACIO',
  Observaciones: '',
}));

const CANONICAL_FEED_TYPES: TipoAlimento[] = [
  {
    TipoAlimentoID: 'alimento_preiniciador',
    Nombre: 'preIniciador',
    EtapaRecomendadaDesdeDia: 1,
    EtapaRecomendadaHastaDia: 10,
    KgPorBulto: 40,
    Activo: true,
  },
  {
    TipoAlimentoID: 'alimento_iniciador',
    Nombre: 'Iniciacion',
    EtapaRecomendadaDesdeDia: 11,
    EtapaRecomendadaHastaDia: 21,
    KgPorBulto: 40,
    Activo: true,
  },
  {
    TipoAlimentoID: 'alimento_engorde',
    Nombre: 'Engorde',
    EtapaRecomendadaDesdeDia: 22,
    EtapaRecomendadaHastaDia: 42,
    KgPorBulto: 40,
    Activo: true,
  },
];

function mergeCanonicalFeedType(canonical: TipoAlimento, existing?: TipoAlimento): TipoAlimento {
  return {
    ...canonical,
    ...existing,
    Nombre: existing?.Nombre || canonical.Nombre,
    EtapaRecomendadaDesdeDia: existing?.EtapaRecomendadaDesdeDia || canonical.EtapaRecomendadaDesdeDia,
    EtapaRecomendadaHastaDia: existing?.EtapaRecomendadaHastaDia || canonical.EtapaRecomendadaHastaDia,
    KgPorBulto: existing?.KgPorBulto || canonical.KgPorBulto,
    Activo: true,
  };
}

export async function ensureCanonicalFeedTypes(): Promise<void> {
  await db.transaction('rw', db.tiposAlimento, async () => {
    for (const canonical of CANONICAL_FEED_TYPES) {
      const existing = await db.tiposAlimento.get(canonical.TipoAlimentoID);
      await db.tiposAlimento.put(mergeCanonicalFeedType(canonical, existing));
    }
  });
}

async function deleteDemoRows(table: Table<object, string>): Promise<void> {
  const keys = await table.toCollection().primaryKeys();
  const demoKeys = keys.filter(isDemoPrimaryKey) as string[];
  if (demoKeys.length > 0) await table.bulkDelete(demoKeys);
}

export async function seedDemoDataIfNeeded(): Promise<void> {
  await runDbStage('Validar esquema local', ensurePollosSchemaBeforeOpen);

  const lotesCount = await runDbStage('Contar lotes locales', () => db.lotes.count());
  if (lotesCount === 0) {
    const demo = createDemoData();
    await runDbStage('Insertar datos demo', () => db.transaction(
      'rw',
      [
        db.usuarios,
        db.galpones,
        db.proveedores,
        db.clientes,
        db.tiposAlimento,
        db.lotes,
        db.loteGalpones,
        db.registroDiarioLote,
        db.consumosAlimentoLote,
        db.pesajes,
        db.pesajeDetalle,
        db.actividadesProgramadas,
        db.actividadesLote,
        db.planVacunalBase,
        db.vacunasLote,
        db.perros,
        db.inventarioAlimento,
        db.curvasEstandar,
        db.alertas,
      ],
      async () => {
        await db.usuarios.bulkPut(demo.usuarios);
        await db.galpones.bulkPut(demo.galpones);
        await db.proveedores.bulkPut(demo.proveedores);
        await db.clientes.bulkPut(demo.clientes);
        await db.tiposAlimento.bulkPut(demo.tiposAlimento);
        await db.lotes.bulkPut(demo.lotes);
        await db.loteGalpones.bulkPut(demo.loteGalpones);
        await db.registroDiarioLote.bulkPut(demo.registroDiarioLote);
        await db.consumosAlimentoLote.bulkPut(demo.consumosAlimentoLote);
        await db.pesajes.bulkPut(demo.pesajes);
        await db.pesajeDetalle.bulkPut(demo.pesajeDetalle);
        await db.actividadesProgramadas.bulkPut(demo.actividadesProgramadas);
        await db.actividadesLote.bulkPut(demo.actividadesLote);
        await db.planVacunalBase.bulkPut(demo.planVacunalBase);
        await db.vacunasLote.bulkPut(demo.vacunasLote);
        await db.perros.bulkPut(demo.perros);
        await db.inventarioAlimento.bulkPut(demo.inventarioAlimento);
        await db.curvasEstandar.bulkPut(demo.curvasEstandar);
        await db.alertas.bulkPut(demo.alertas);
      },
    ));
  }

  await runDbStage('Asegurar tipos de alimento', ensureCanonicalFeedTypes);
  await runDbStage('Asegurar galpones demo', ensureDefaultGalponLayout);
}

export async function prepareRemoteLocalData(): Promise<void> {
  await runDbStage('Validar esquema local', ensurePollosSchemaBeforeOpen);
  await runDbStage('Limpiar datos demo locales', async () => {
    await Promise.all([
      deleteDemoRows(db.usuarios as unknown as Table<object, string>),
      deleteDemoRows(db.proveedores as unknown as Table<object, string>),
      deleteDemoRows(db.clientes as unknown as Table<object, string>),
      deleteDemoRows(db.tiposAlimento as unknown as Table<object, string>),
      deleteDemoRows(db.lotes as unknown as Table<object, string>),
      deleteDemoRows(db.loteGalpones as unknown as Table<object, string>),
      deleteDemoRows(db.registroDiarioLote as unknown as Table<object, string>),
      deleteDemoRows(db.consumosAlimentoLote as unknown as Table<object, string>),
      deleteDemoRows(db.pesajes as unknown as Table<object, string>),
      deleteDemoRows(db.pesajeDetalle as unknown as Table<object, string>),
      deleteDemoRows(db.actividadesLote as unknown as Table<object, string>),
      deleteDemoRows(db.vacunasLote as unknown as Table<object, string>),
      deleteDemoRows(db.perros as unknown as Table<object, string>),
      deleteDemoRows(db.perrosRegistros as unknown as Table<object, string>),
      deleteDemoRows(db.inventarioAlimento as unknown as Table<object, string>),
      deleteDemoRows(db.alertas as unknown as Table<object, string>),
    ]);
  });

  const reference = createDemoData();
  await runDbStage('Preparar catalogos locales remotos', async () => {
    await db.transaction('rw', [db.galpones, db.tiposAlimento, db.actividadesProgramadas, db.planVacunalBase, db.curvasEstandar], async () => {
      for (const galpon of REMOTE_DEFAULT_GALPONES) {
        const existing = await db.galpones.get(galpon.GalponID);
        await db.galpones.put({
          ...galpon,
          EstadoActual: existing && !existing.Observaciones.toLowerCase().includes('demo') ? existing.EstadoActual : galpon.EstadoActual,
          Observaciones: existing && !existing.Observaciones.toLowerCase().includes('demo') ? existing.Observaciones : galpon.Observaciones,
          Activo: existing?.Activo ?? true,
        });
      }
      for (const canonical of CANONICAL_FEED_TYPES) {
        const existing = await db.tiposAlimento.get(canonical.TipoAlimentoID);
        await db.tiposAlimento.put(mergeCanonicalFeedType(canonical, existing));
      }
      if ((await db.actividadesProgramadas.count()) === 0) await db.actividadesProgramadas.bulkPut(reference.actividadesProgramadas);
      if ((await db.planVacunalBase.count()) === 0) await db.planVacunalBase.bulkPut(reference.planVacunalBase);
      if ((await db.curvasEstandar.count()) === 0) await db.curvasEstandar.bulkPut(reference.curvasEstandar);
    });
  });
}

async function ensureDefaultGalponLayout(): Promise<void> {
  const remap: Record<string, string> = {
    galpon_01: 'galpon_1A',
    galpon_02: 'galpon_1B',
    galpon_03: 'galpon_2A',
    galpon_04: 'galpon_2B',
    galpon_05: 'galpon_3A',
    galpon_06: 'galpon_3B',
  };

  await db.transaction('rw', [db.galpones, db.lotes, db.loteGalpones, db.actividadesLote], async () => {
    for (const galpon of DEFAULT_GALPONES) {
      const existing = await db.galpones.get(galpon.GalponID);
      await db.galpones.put({
        ...galpon,
        EstadoActual: existing?.EstadoActual ?? galpon.EstadoActual,
        Observaciones: existing?.Observaciones ?? galpon.Observaciones,
        Activo: existing?.Activo ?? true,
      });
    }

    const oldIds = Object.keys(remap);
    const oldAssignments = await db.loteGalpones.where('GalponID').anyOf(oldIds).toArray();
    await Promise.all(
      oldAssignments.map((assignment) => db.loteGalpones.update(assignment.LoteGalponID, { GalponID: remap[assignment.GalponID] })),
    );

    const oldActivities = await db.actividadesLote.where('GalponID').anyOf(oldIds).toArray();
    await Promise.all(
      oldActivities.map((activity) => db.actividadesLote.update(activity.ActividadLoteID, { GalponID: remap[activity.GalponID] })),
    );

    await db.galpones.bulkDelete(oldIds);

    const demoLote = await db.lotes.get('lote_demo_001');
    if (!demoLote) return;

    const demoAssignments = await db.loteGalpones.where('LoteID').equals('lote_demo_001').toArray();
    const hasFullLayout = DEFAULT_GALPONES.every((galpon) =>
      demoAssignments.some((assignment) => assignment.GalponID === galpon.GalponID && assignment.Estado === 'ACTIVO'),
    );
    if (hasFullLayout) return;

    await db.loteGalpones.bulkDelete(demoAssignments.map((assignment) => assignment.LoteGalponID));
    await db.loteGalpones.bulkPut(
      [
        ['galpon_1A', 750],
        ['galpon_1B', 750],
        ['galpon_2A', 750],
        ['galpon_2B', 750],
        ['galpon_3A', 2250],
        ['galpon_3B', 2250],
      ].map(([GalponID, CantidadEntrada], index) => ({
        LoteGalponID: `lote_galpon_demo_${index + 1}`,
        LoteID: 'lote_demo_001',
        GalponID: String(GalponID),
        Sexo: 'MIXTO' as const,
        FechaInicio: demoLote.FechaLlegada,
        FechaFin: '',
        DiaInicio: 1,
        DiaFin: 0,
        CantidadEntrada: Number(CantidadEntrada),
        CantidadSalida: 0,
        Estado: 'ACTIVO' as const,
        Observaciones: 'Machos y hembras juntos',
      })),
    );
  });
}

export async function resetLocalDemoData(): Promise<void> {
  await deletePollosDatabaseRaw();
  await db.open();
  await seedDemoDataIfNeeded();
}

export function getTableForSync(table: SyncEntityTable): Table<object, string> {
  const map: Record<SyncEntityTable, Table<object, string>> = {
    Usuarios: db.usuarios as unknown as Table<object, string>,
    Galpones: db.galpones as unknown as Table<object, string>,
    Lotes: db.lotes as unknown as Table<object, string>,
    LoteGalpones: db.loteGalpones as unknown as Table<object, string>,
    MovimientosEntreGalpones: db.movimientosEntreGalpones as unknown as Table<object, string>,
    RegistroDiarioLote: db.registroDiarioLote as unknown as Table<object, string>,
    Pesajes: db.pesajes as unknown as Table<object, string>,
    PesajeDetalle: db.pesajeDetalle as unknown as Table<object, string>,
    SalidasPollo: db.salidasPollo as unknown as Table<object, string>,
    ActividadesProgramadas: db.actividadesProgramadas as unknown as Table<object, string>,
    ActividadesLote: db.actividadesLote as unknown as Table<object, string>,
    PlanVacunalBase: db.planVacunalBase as unknown as Table<object, string>,
    VacunasLote: db.vacunasLote as unknown as Table<object, string>,
    EntradasAlimento: db.entradasAlimento as unknown as Table<object, string>,
    ConsumoAlimentoLote: db.consumosAlimentoLote as unknown as Table<object, string>,
    MaterialesLote: db.materialesLote as unknown as Table<object, string>,
    EntradasMaterial: db.entradasMaterial as unknown as Table<object, string>,
    InventarioMaterial: db.inventarioMaterial as unknown as Table<object, string>,
    MovimientosInventarioMaterial: db.movimientosInventarioMaterial as unknown as Table<object, string>,
    ControlesAgua: db.controlesAgua as unknown as Table<object, string>,
    EventosSanitarios: db.eventosSanitarios as unknown as Table<object, string>,
    TratamientosVeterinarios: db.tratamientosVeterinarios as unknown as Table<object, string>,
    RegistrosPlaga: db.registrosPlaga as unknown as Table<object, string>,
    CompostajeCajones: db.compostajeCajones as unknown as Table<object, string>,
    CompostajeRegistros: db.compostajeRegistros as unknown as Table<object, string>,
    Medicamentos: db.medicamentos as unknown as Table<object, string>,
    Perros: db.perros as unknown as Table<object, string>,
    PerrosRegistros: db.perrosRegistros as unknown as Table<object, string>,
    Capacitaciones: db.capacitaciones as unknown as Table<object, string>,
    CapacitacionAsistentes: db.capacitacionAsistentes as unknown as Table<object, string>,
    Proveedores: db.proveedores as unknown as Table<object, string>,
    Clientes: db.clientes as unknown as Table<object, string>,
    TiposAlimento: db.tiposAlimento as unknown as Table<object, string>,
    FacturasCompra: db.facturasCompra as unknown as Table<object, string>,
    DetalleFacturasCompra: db.detalleFacturasCompra as unknown as Table<object, string>,
    FacturasVenta: db.facturasVenta as unknown as Table<object, string>,
    DetalleFacturasVenta: db.detalleFacturasVenta as unknown as Table<object, string>,
    CostosLote: db.costosLote as unknown as Table<object, string>,
    InventarioAlimento: db.inventarioAlimento as unknown as Table<object, string>,
    MovimientosInventarioAlimento: db.movimientosInventarioAlimento as unknown as Table<object, string>,
    CurvasEstandar: db.curvasEstandar as unknown as Table<object, string>,
    CierresSemanales: db.cierresSemanales as unknown as Table<object, string>,
    CierreLote: db.cierreLote as unknown as Table<object, string>,
    Alertas: db.alertas as unknown as Table<object, string>,
    HistorialCambios: db.historialCambios as unknown as Table<object, string>,
    ReportesPDF: db.reportesPDF as unknown as Table<object, string>,
  };
  return map[table];
}

export function getLocalTableBySheetName(table: string): Table<object, string> | undefined {
  const map: Record<string, Table<object, string>> = {
    Usuarios: db.usuarios as unknown as Table<object, string>,
    Galpones: db.galpones as unknown as Table<object, string>,
    Lotes: db.lotes as unknown as Table<object, string>,
    LoteGalpones: db.loteGalpones as unknown as Table<object, string>,
    MovimientosEntreGalpones: db.movimientosEntreGalpones as unknown as Table<object, string>,
    RegistroDiarioLote: db.registroDiarioLote as unknown as Table<object, string>,
    Pesajes: db.pesajes as unknown as Table<object, string>,
    PesajeDetalle: db.pesajeDetalle as unknown as Table<object, string>,
    SalidasPollo: db.salidasPollo as unknown as Table<object, string>,
    ActividadesProgramadas: db.actividadesProgramadas as unknown as Table<object, string>,
    ActividadesLote: db.actividadesLote as unknown as Table<object, string>,
    PlanVacunalBase: db.planVacunalBase as unknown as Table<object, string>,
    VacunasLote: db.vacunasLote as unknown as Table<object, string>,
    EntradasAlimento: db.entradasAlimento as unknown as Table<object, string>,
    ConsumoAlimentoLote: db.consumosAlimentoLote as unknown as Table<object, string>,
    MaterialesLote: db.materialesLote as unknown as Table<object, string>,
    EntradasMaterial: db.entradasMaterial as unknown as Table<object, string>,
    InventarioMaterial: db.inventarioMaterial as unknown as Table<object, string>,
    MovimientosInventarioMaterial: db.movimientosInventarioMaterial as unknown as Table<object, string>,
    ControlesAgua: db.controlesAgua as unknown as Table<object, string>,
    EventosSanitarios: db.eventosSanitarios as unknown as Table<object, string>,
    TratamientosVeterinarios: db.tratamientosVeterinarios as unknown as Table<object, string>,
    RegistrosPlaga: db.registrosPlaga as unknown as Table<object, string>,
    CompostajeCajones: db.compostajeCajones as unknown as Table<object, string>,
    CompostajeRegistros: db.compostajeRegistros as unknown as Table<object, string>,
    Medicamentos: db.medicamentos as unknown as Table<object, string>,
    Perros: db.perros as unknown as Table<object, string>,
    PerrosRegistros: db.perrosRegistros as unknown as Table<object, string>,
    Capacitaciones: db.capacitaciones as unknown as Table<object, string>,
    CapacitacionAsistentes: db.capacitacionAsistentes as unknown as Table<object, string>,
    Proveedores: db.proveedores as unknown as Table<object, string>,
    Clientes: db.clientes as unknown as Table<object, string>,
    TiposAlimento: db.tiposAlimento as unknown as Table<object, string>,
    FacturasCompra: db.facturasCompra as unknown as Table<object, string>,
    DetalleFacturasCompra: db.detalleFacturasCompra as unknown as Table<object, string>,
    FacturasVenta: db.facturasVenta as unknown as Table<object, string>,
    DetalleFacturasVenta: db.detalleFacturasVenta as unknown as Table<object, string>,
    CostosLote: db.costosLote as unknown as Table<object, string>,
    InventarioAlimento: db.inventarioAlimento as unknown as Table<object, string>,
    MovimientosInventarioAlimento: db.movimientosInventarioAlimento as unknown as Table<object, string>,
    CurvasEstandar: db.curvasEstandar as unknown as Table<object, string>,
    CierresSemanales: db.cierresSemanales as unknown as Table<object, string>,
    CierreLote: db.cierreLote as unknown as Table<object, string>,
    Alertas: db.alertas as unknown as Table<object, string>,
    HistorialCambios: db.historialCambios as unknown as Table<object, string>,
    ReportesPDF: db.reportesPDF as unknown as Table<object, string>,
  };
  return map[table];
}
