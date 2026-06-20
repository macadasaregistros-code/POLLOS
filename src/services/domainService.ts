import { avesVivasHembras, avesVivasMachos, calculatePesajeStats, sumLoteTotals } from './calculationsService';
import { db } from './localDbService';
import { enqueueSync } from './syncService';
import { getMissingDailyRegisterDates } from './dailyRegisterService';
import { isRoutineTemplate } from './routineService';
import { addDays, getDiaLote, getSemanaLote, nowISO, todayISO } from '../lib/date';
import { createId } from '../lib/id';
import type {
  ActividadLote,
  Capacitacion,
  CapacitacionAsistente,
  CompostajeCajon,
  CompostajeRegistro,
  ControlAgua,
  EntradaAlimento,
  EntradaMaterial,
  EventoSanitario,
  Galpon,
  Lote,
  LoteGalpon,
  MaterialLote,
  MedicamentoRegistro,
  MovimientoInventarioAlimento,
  MovimientoInventarioMaterial,
  Pesaje,
  PesajeDetalle,
  Perro,
  PerroRegistro,
  RegistroDiarioLote,
  RegistroPlaga,
  SalidaPollo,
  SexoLote,
  TipoMaterialInventario,
  TipoPlaga,
  Usuario,
  VacunaLote,
} from '../types/entities';

export interface CreateLoteInput {
  CodigoLote: string;
  FechaLlegada: string;
  CantidadInicialMachos: number;
  CantidadInicialHembras: number;
  ProveedorPollitoID: string;
  LineaGenetica: string;
  GalponID: string;
  Observaciones: string;
}

export interface RegistroDiaInput {
  LoteID: string;
  Fecha: string;
  TipoAlimentoID: string;
  BultosConsumidos: number;
  MuertosMachos: number;
  MuertosHembras: number;
  MuertosSinClasificar: number;
  SacrificadosMachos: number;
  SacrificadosHembras: number;
  Observaciones: string;
}

export interface PesajeInput {
  LoteID: string;
  Fecha: string;
  pesosMachos: number[];
  pesosHembras: number[];
}

export interface EntradaAlimentoInput {
  Fecha: string;
  TipoAlimentoID: string;
  CantidadBultos: number;
  KgPorBulto: number;
  ProveedorID: string;
  Observaciones: string;
}

export interface SalidaInput {
  Fecha: string;
  LoteID: string;
  TipoSalida: 'VENTA' | 'SACRIFICIO';
  Sexo: SexoLote;
  CantidadAves: number;
  PesoTotalKg: number;
  ClienteID: string;
  Observaciones: string;
}

export interface ControlAguaInput {
  Fecha: string;
  fechaRegistro?: string;
  estado?: string;
  LoteID: string;
  GalponID: string;
  DosificacionCloroGr: number;
  cloroAdicionadoGramos?: number;
  VerificacionPH: number;
  phSeleccionado?: number;
  phCorrecto?: boolean;
  VerificacionCloro: number;
  cloroResidualSeleccionado?: number;
  cloroCorrecto?: boolean;
  LugarMedicion: ControlAgua['LugarMedicion'];
  AccionTomada: string;
  Foto: string;
  Observacion: string;
}

export interface EntradaMaterialInput {
  Fecha: string;
  TipoMaterial: TipoMaterialInventario;
  Cantidad: number;
  Unidad: string;
  ProveedorID: string;
  Observaciones: string;
}

export interface AplicarVacunaInput {
  Producto: string;
  Laboratorio: string;
  LoteProducto: string;
  FechaVencimientoProducto: string;
  ViaAdministracion: string;
  Cepa: string;
  Enfermedad: string;
  NumeroAves?: number;
  EdadDias?: number;
  Responsable: string;
  FirmaResponsable: string;
  Foto: string;
  Observacion: string;
}

export interface RegistroPlagaInput {
  Fecha: string;
  TipoPlaga: TipoPlaga;
  GalponID: string;
  Producto: string;
  Dosificacion: string;
  EstacionesVeneno: number;
  EstacionesVenenoDetalle: string;
  Foto: string;
  Observaciones: string;
}

export interface MedicamentoInput {
  Fecha: string;
  Estado: string;
  LoteID: string;
  GalponID: string;
  Producto: string;
  LoteProducto: string;
  FechaVencimiento: string;
  EdadDias: number;
  NumeroAnimalesTratados: number;
  Dosis: string;
  ViaAdministracion: string;
  Motivo: string;
  Responsable: string;
  PeriodoRetiroDias: number;
  Foto: string;
  Observaciones: string;
}

export interface PerroInput {
  PerroID?: string;
  Fecha: string;
  NombrePerro: string;
  TipoRegistro: PerroRegistro['TipoRegistro'];
  Producto: string;
  Laboratorio: string;
  LoteProducto: string;
  FechaVencimiento: string;
  Responsable: string;
  FirmaResponsable: string;
  Foto: string;
  Observaciones: string;
}

export interface CapacitacionInput {
  Fecha: string;
  Tema: string;
  Capacitador: string;
  FirmaCapacitador: string;
  Observaciones: string;
  Asistentes: Array<{ Nombre: string; Firma: string }>;
}

export interface EventoSanitarioInput {
  Fecha: string;
  LoteID: string;
  GalponID: string;
  TipoEvento: EventoSanitario['TipoEvento'];
  Severidad: EventoSanitario['Severidad'];
  Descripcion: string;
}

async function buildActivitiesForLote(lote: Lote, galponId: string): Promise<ActividadLote[]> {
  const templates = (await db.actividadesProgramadas.toArray()).filter((template) => template.Activa && !isRoutineTemplate(template));
  const activities: ActividadLote[] = [];

  for (const template of templates) {
    const days: number[] = [];
    if (template.TipoFrecuencia === 'DIARIA') {
      for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 1) days.push(day);
    } else if (template.TipoFrecuencia === 'CADA_3_DIAS') {
      for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 3) days.push(day);
    } else if (template.TipoFrecuencia === 'SEMANAL') {
      for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 7) days.push(day);
    } else if (template.TipoFrecuencia === 'MENSUAL') {
      for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 30) days.push(day);
    } else {
      days.push(Math.max(1, template.DiaLote));
    }

    days.forEach((day) => {
      activities.push({
        ActividadLoteID: createId('act_lote'),
        LoteID: lote.LoteID,
        GalponID: galponId,
        FechaProgramada: addDays(lote.FechaLlegada, day - 1),
        DiaLote: day,
        NombreActividad: template.NombreActividad,
        Categoria: template.Categoria,
        Estado: 'PENDIENTE',
        FechaRealizada: '',
        RealizadaPor: '',
        Observacion: '',
        CerradaComoPendiente: false,
        EstadoSync: 'PENDIENTE',
      });
    });
  }

  return activities;
}

async function buildVacunasForLote(lote: Lote, galponId: string): Promise<VacunaLote[]> {
  const vacunas = (await db.planVacunalBase.toArray()).filter((vacuna) => vacuna.Activa);
  return vacunas.map((vacuna) => ({
    VacunaLoteID: createId('vac_lote'),
    LoteID: lote.LoteID,
    GalponID: galponId,
    NombreVacuna: vacuna.NombreVacuna,
    Producto: vacuna.NombreVacuna,
    Laboratorio: '',
    LoteProducto: '',
    FechaVencimientoProducto: '',
    ViaAdministracion: vacuna.ViaAplicacion || 'Agua de bebida',
    Cepa: '',
    Enfermedad: vacuna.NombreVacuna,
    NumeroAves: lote.CantidadInicialTotal,
    EdadDias: vacuna.DiaProgramado,
    DiaProgramado: vacuna.DiaProgramado,
    FechaProgramada: addDays(lote.FechaLlegada, vacuna.DiaProgramado - 1),
    Estado: 'PENDIENTE',
    FechaAplicacion: '',
    AplicadaPor: '',
    Responsable: '',
    FirmaResponsable: '',
    Foto: '',
    Observacion: '',
    EstadoSync: 'PENDIENTE',
  }));
}

export async function crearLote(input: CreateLoteInput, user: Usuario): Promise<Lote> {
  const now = nowISO();
  const lote: Lote = {
    LoteID: createId('lote'),
    CodigoLote: input.CodigoLote.trim(),
    FechaLlegada: input.FechaLlegada,
    CantidadInicialMachos: input.CantidadInicialMachos,
    CantidadInicialHembras: input.CantidadInicialHembras,
    CantidadInicialTotal: input.CantidadInicialMachos + input.CantidadInicialHembras,
    ProveedorPollitoID: input.ProveedorPollitoID,
    FacturaPollitoID: '',
    EstadoLote: 'ACTIVO',
    LineaGenetica: input.LineaGenetica.trim() || 'Cobb 500',
    Observaciones: input.Observaciones,
    CreadoPor: user.UsuarioID,
    FechaCreacion: now,
  };

  const loteGalpon: LoteGalpon = {
    LoteGalponID: createId('lote_galpon'),
    LoteID: lote.LoteID,
    GalponID: input.GalponID,
    Sexo: 'MIXTO',
    FechaInicio: input.FechaLlegada,
    FechaFin: '',
    DiaInicio: 1,
    DiaFin: 0,
    CantidadEntrada: lote.CantidadInicialTotal,
    CantidadSalida: 0,
    Estado: 'ACTIVO',
    Observaciones: '',
  };

  const actividades = await buildActivitiesForLote(lote, input.GalponID);
  const vacunas = await buildVacunasForLote(lote, input.GalponID);
  const currentGalpon = await db.galpones.get(input.GalponID);
  const updatedGalpon: Galpon | undefined = currentGalpon ? { ...currentGalpon, EstadoActual: 'ENGORDE' } : undefined;

  await db.transaction('rw', [db.lotes, db.loteGalpones, db.galpones, db.actividadesLote, db.vacunasLote, db.syncQueue], async () => {
    await db.lotes.add(lote);
    await db.loteGalpones.add(loteGalpon);
    await db.galpones.update(input.GalponID, { EstadoActual: 'ENGORDE' });
    await db.actividadesLote.bulkAdd(actividades);
    await db.vacunasLote.bulkAdd(vacunas);
    await enqueueSync('Lotes', lote.LoteID, 'CREATE', lote);
    await enqueueSync('LoteGalpones', loteGalpon.LoteGalponID, 'CREATE', loteGalpon);
    if (updatedGalpon) await enqueueSync('Galpones', input.GalponID, 'UPDATE', updatedGalpon);
    await Promise.all(actividades.map((actividad) => enqueueSync('ActividadesLote', actividad.ActividadLoteID, 'CREATE', actividad)));
    await Promise.all(vacunas.map((vacuna) => enqueueSync('VacunasLote', vacuna.VacunaLoteID, 'CREATE', vacuna)));
  });

  return lote;
}

function buildCompostCajon(fecha: string): CompostajeCajon {
  return {
    CajonID: createId('compost_cajon'),
    CodigoCajon: `Cajon ${fecha}`,
    Estado: 'ACTIVO',
    FechaInicio: fecha,
    FechaFinLlenado: addDays(fecha, 20),
    FechaVolteo: addDays(fecha, 30),
    FechaRetiro: addDays(fecha, 60),
    AvesAcumuladas: 0,
    Observaciones: '',
    EstadoSync: 'PENDIENTE',
  };
}

async function prepareCompostCajonForMortality(fecha: string): Promise<{
  activeCajon: CompostajeCajon;
  created: boolean;
  closedCajon?: CompostajeCajon;
}> {
  const current = await db.compostajeCajones.where('Estado').equals('ACTIVO').first();
  if (current && fecha <= current.FechaFinLlenado) {
    return { activeCajon: current, created: false };
  }

  const next = buildCompostCajon(fecha);
  if (!current) return { activeCajon: next, created: true };

  return {
    activeCajon: next,
    created: true,
    closedCajon: { ...current, Estado: 'LLENADO_CERRADO', EstadoSync: 'PENDIENTE' },
  };
}

export async function registrarDia(input: RegistroDiaInput, user: Usuario): Promise<RegistroDiarioLote> {
  const lote = await db.lotes.get(input.LoteID);
  if (!lote) throw new Error('Lote no encontrado.');
  if (lote.EstadoLote !== 'ACTIVO') throw new Error('Este lote ya no está activo.');
  if (input.Fecha < lote.FechaLlegada || input.Fecha > todayISO()) throw new Error('La fecha del registro diario no es válida.');

  const previousRecords = await db.registroDiarioLote.where('LoteID').equals(input.LoteID).toArray();
  const existingRecord = previousRecords.find((record) => record.Fecha === input.Fecha);
  if (existingRecord) throw new Error('El registro diario de este lote ya fue guardado para esa fecha.');
  const missingBeforeDate = getMissingDailyRegisterDates(lote.FechaLlegada, addDays(input.Fecha, -1), previousRecords);
  if (missingBeforeDate.length > 0) {
    throw new Error(`Primero registra ${missingBeforeDate[0]}. No puede quedar ninguna fecha sin registro.`);
  }

  const tipoAlimento = await db.tiposAlimento.get(input.TipoAlimentoID);
  if (!tipoAlimento?.Activo) throw new Error('Selecciona un tipo de alimento activo.');

  const values = [
    input.BultosConsumidos,
    input.MuertosMachos,
    input.MuertosHembras,
    input.MuertosSinClasificar,
    input.SacrificadosMachos,
    input.SacrificadosHembras,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('Los valores del registro no pueden ser negativos.');
  if (values.slice(1).some((value) => !Number.isInteger(value))) throw new Error('Las cantidades de aves deben ser números enteros.');

  const previousTotals = sumLoteTotals(previousRecords);
  const machosDisponibles = avesVivasMachos(lote, previousTotals);
  const hembrasDisponibles = avesVivasHembras(lote, previousTotals);
  if (input.MuertosMachos + input.SacrificadosMachos > machosDisponibles) {
    throw new Error(`No puedes registrar más de ${machosDisponibles} machos disponibles.`);
  }
  if (input.MuertosHembras + input.SacrificadosHembras > hembrasDisponibles) {
    throw new Error(`No puedes registrar más de ${hembrasDisponibles} hembras disponibles.`);
  }

  const now = nowISO();
  const diaLote = getDiaLote(lote.FechaLlegada, input.Fecha);
  const kgConsumidos = input.BultosConsumidos * tipoAlimento.KgPorBulto;
  const activeAssignment = await db.loteGalpones
    .where('LoteID')
    .equals(input.LoteID)
    .and((assignment) => assignment.Estado === 'ACTIVO')
    .first();
  const totalMuertos = input.MuertosMachos + input.MuertosHembras + input.MuertosSinClasificar;

  const registro: RegistroDiarioLote = {
    RegistroDiarioID: createId('reg_dia'),
    Fecha: input.Fecha,
    LoteID: input.LoteID,
    DiaLote: diaLote,
    TipoAlimentoID: input.TipoAlimentoID,
    BultosConsumidos: input.BultosConsumidos,
    KgConsumidos: kgConsumidos,
    MuertosMachos: input.MuertosMachos,
    MuertosHembras: input.MuertosHembras,
    MuertosSinClasificar: input.MuertosSinClasificar,
    SacrificadosMachos: input.SacrificadosMachos,
    SacrificadosHembras: input.SacrificadosHembras,
    VendidosMachos: 0,
    VendidosHembras: 0,
    Observaciones: input.Observaciones,
    RegistradoPor: user.UsuarioID,
    FechaHoraRegistro: now,
    FechaHoraUltimaEdicion: now,
    EditadoPor: user.UsuarioID,
    Bloqueado: false,
    EstadoSync: 'PENDIENTE',
  };

  const consumo = {
    ConsumoID: createId('consumo'),
    Fecha: input.Fecha,
    LoteID: input.LoteID,
    TipoAlimentoID: input.TipoAlimentoID,
    BultosConsumidos: input.BultosConsumidos,
    KgConsumidos: kgConsumidos,
    PorcentajeMañana: 70,
    PorcentajeTarde: 30,
    RegistradoPor: user.UsuarioID,
    EstadoSync: 'PENDIENTE' as const,
  };

  const movimiento: MovimientoInventarioAlimento = {
    MovimientoInventarioID: createId('mov_inv'),
    Fecha: input.Fecha,
    TipoMovimiento: 'CONSUMO_LOTE',
    TipoAlimentoID: input.TipoAlimentoID,
    CantidadBultos: input.BultosConsumidos,
    KgTotal: kgConsumidos,
    LoteID: input.LoteID,
    ProveedorID: '',
    FacturaID: '',
    Origen: 'INVENTARIO',
    Destino: lote.CodigoLote,
    RegistradoPor: user.UsuarioID,
    Observacion: 'Consumo diario de lote',
  };

  await db.transaction(
    'rw',
    [
      db.registroDiarioLote,
      db.consumosAlimentoLote,
      db.inventarioAlimento,
      db.movimientosInventarioAlimento,
      db.compostajeCajones,
      db.compostajeRegistros,
      db.syncQueue,
    ],
    async () => {
      const duplicate = await db.registroDiarioLote.where('LoteID').equals(input.LoteID).and((record) => record.Fecha === input.Fecha).first();
      if (duplicate) throw new Error('El registro diario de este lote ya fue guardado para esa fecha.');

      await db.registroDiarioLote.add(registro);
      await db.consumosAlimentoLote.add(consumo);
      await enqueueSync('RegistroDiarioLote', registro.RegistroDiarioID, 'CREATE', registro);
      await enqueueSync('ConsumoAlimentoLote', consumo.ConsumoID, 'CREATE', consumo);
      if (input.BultosConsumidos > 0) {
        await updateInventory(input.TipoAlimentoID, -input.BultosConsumidos, -kgConsumidos);
        await db.movimientosInventarioAlimento.add(movimiento);
        await enqueueSync('MovimientosInventarioAlimento', movimiento.MovimientoInventarioID, 'CREATE', movimiento);
      }

      if (totalMuertos > 0) {
        const compost = await prepareCompostCajonForMortality(input.Fecha);
        if (compost.closedCajon) {
          await db.compostajeCajones.put(compost.closedCajon);
          await enqueueSync('CompostajeCajones', compost.closedCajon.CajonID, 'UPDATE', compost.closedCajon);
        }

        const cajonActualizado: CompostajeCajon = {
          ...compost.activeCajon,
          AvesAcumuladas: compost.activeCajon.AvesAcumuladas + totalMuertos,
          EstadoSync: 'PENDIENTE',
        };
        await db.compostajeCajones.put(cajonActualizado);

        const registroCompostaje: CompostajeRegistro = {
          RegistroCompostajeID: createId('compost_reg'),
          CajonID: cajonActualizado.CajonID,
          Fecha: input.Fecha,
          FechaHoraRegistro: now,
          LoteID: input.LoteID,
          GalponID: activeAssignment?.GalponID ?? '',
          RegistroDiarioID: registro.RegistroDiarioID,
          MuertosMachos: input.MuertosMachos,
          MuertosHembras: input.MuertosHembras,
          MuertosSinClasificar: input.MuertosSinClasificar,
          TotalAves: totalMuertos,
          Fuente: 'MORTALIDAD_DIARIA',
          RegistradoPor: user.UsuarioID,
          Observaciones: 'Acumulado automatico desde mortalidad diaria',
          EstadoSync: 'PENDIENTE',
        };

        await db.compostajeRegistros.add(registroCompostaje);
        await enqueueSync('CompostajeCajones', cajonActualizado.CajonID, compost.created ? 'CREATE' : 'UPDATE', cajonActualizado);
        await enqueueSync('CompostajeRegistros', registroCompostaje.RegistroCompostajeID, 'CREATE', registroCompostaje);
      }
    },
  );

  return registro;
}

export async function actualizarEstadoGalpon(
  galponId: string,
  estado: Galpon['EstadoActual'],
  observaciones?: string,
): Promise<Galpon> {
  const galpon = await db.galpones.get(galponId);
  if (!galpon) throw new Error('Galpón no encontrado.');

  const updatedGalpon: Galpon = {
    ...galpon,
    EstadoActual: estado,
    Observaciones: observaciones ?? galpon.Observaciones,
  };

  await db.transaction('rw', [db.galpones, db.syncQueue], async () => {
    await db.galpones.update(galponId, {
      EstadoActual: updatedGalpon.EstadoActual,
      Observaciones: updatedGalpon.Observaciones,
    });
    await enqueueSync('Galpones', galponId, 'UPDATE', updatedGalpon);
  });

  return updatedGalpon;
}

export async function registrarPesaje(input: PesajeInput, user: Usuario): Promise<Pesaje> {
  const lote = await db.lotes.get(input.LoteID);
  if (!lote) throw new Error('Lote no encontrado.');
  const pesajeId = createId('pesaje');
  const now = nowISO();
  const diaLote = getDiaLote(lote.FechaLlegada, input.Fecha);
  const detalles: PesajeDetalle[] = [
    ...input.pesosMachos.map<PesajeDetalle>((peso, index) => ({
      PesajeDetalleID: createId('peso_det'),
      PesajeID: pesajeId,
      LoteID: lote.LoteID,
      Sexo: 'MACHO',
      NumeroAve: index + 1,
      PesoGramos: peso,
      FechaHoraRegistro: now,
      EstadoSync: 'PENDIENTE',
    })),
    ...input.pesosHembras.map<PesajeDetalle>((peso, index) => ({
      PesajeDetalleID: createId('peso_det'),
      PesajeID: pesajeId,
      LoteID: lote.LoteID,
      Sexo: 'HEMBRA',
      NumeroAve: index + 1,
      PesoGramos: peso,
      FechaHoraRegistro: now,
      EstadoSync: 'PENDIENTE',
    })),
  ];
  const stats = calculatePesajeStats(detalles);
  const pesaje: Pesaje = {
    PesajeID: pesajeId,
    Fecha: input.Fecha,
    LoteID: lote.LoteID,
    DiaLote: diaLote,
    SemanaLote: getSemanaLote(diaLote),
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
    FechaHoraRegistro: now,
    EstadoSync: 'PENDIENTE',
  };

  await db.transaction('rw', [db.pesajes, db.pesajeDetalle, db.syncQueue], async () => {
    await db.pesajes.add(pesaje);
    await db.pesajeDetalle.bulkAdd(detalles);
    await enqueueSync('Pesajes', pesaje.PesajeID, 'CREATE', pesaje);
    await Promise.all(detalles.map((detalle) => enqueueSync('PesajeDetalle', detalle.PesajeDetalleID, 'CREATE', detalle)));
  });

  return pesaje;
}

export async function actualizarActividad(
  actividadId: string,
  estado: ActividadLote['Estado'],
  user: Usuario,
  observacion = '',
  gasCilindros?: number,
): Promise<void> {
  const actividad = await db.actividadesLote.get(actividadId);
  if (!actividad) throw new Error('Actividad no encontrada.');
  const patch: Partial<ActividadLote> = {
    Estado: estado,
    FechaRealizada: estado === 'REALIZADA' ? nowISO() : '',
    RealizadaPor: user.UsuarioID,
    Observacion: observacion,
    CerradaComoPendiente: estado === 'NO_REALIZADA',
    EstadoSync: 'PENDIENTE',
  };

  const shouldRegisterGas = actividad.NombreActividad.toLowerCase().includes('retirada calentadoras') && estado === 'REALIZADA';
  if (shouldRegisterGas && (!gasCilindros || gasCilindros <= 0)) {
    throw new Error('Debes registrar los cilindros de gas consumidos al retirar calentadoras.');
  }

  await db.transaction('rw', [db.actividadesLote, db.materialesLote, db.inventarioMaterial, db.movimientosInventarioMaterial, db.syncQueue], async () => {
    await db.actividadesLote.update(actividadId, patch);
    await enqueueSync('ActividadesLote', actividadId, 'UPDATE', { ...actividad, ...patch });
    if (shouldRegisterGas) {
      const material: MaterialLote = {
        MaterialLoteID: createId('mat_gas'),
        Fecha: todayISO(),
        LoteID: actividad.LoteID,
        GalponID: actividad.GalponID,
        TipoMaterial: 'GAS',
        Cantidad: gasCilindros ?? 0,
        Unidad: 'CILINDRO',
        ProveedorID: '',
        PrecioUnitario: 0,
        FacturaID: '',
        EstadoAdmin: 'PENDIENTE_PRECIO',
        RegistradoPor: user.UsuarioID,
        Observaciones: 'Registro automático por retirada de calentadoras',
        EstadoSync: 'PENDIENTE',
      };
      await db.materialesLote.add(material);
      await enqueueSync('MaterialesLote', material.MaterialLoteID, 'CREATE', material);
      const movimientoMaterial: MovimientoInventarioMaterial = {
        MovimientoMaterialID: createId('mov_mat'),
        Fecha: todayISO(),
        TipoMovimiento: 'CONSUMO_LOTE',
        TipoMaterial: 'GAS',
        Cantidad: gasCilindros ?? 0,
        Unidad: 'CILINDROS',
        LoteID: actividad.LoteID,
        GalponID: actividad.GalponID,
        ProveedorID: '',
        FacturaID: '',
        Origen: 'INVENTARIO',
        Destino: actividad.GalponID,
        RegistradoPor: user.UsuarioID,
        Observacion: 'Consumo automatico por retirada de calentadoras',
      };
      const inventorySync = await updateMaterialInventory('GAS', 'CILINDROS', -(gasCilindros ?? 0));
      await db.movimientosInventarioMaterial.add(movimientoMaterial);
      await enqueueSync('InventarioMaterial', inventorySync.inventario.InventarioMaterialID, inventorySync.operation, inventorySync.inventario);
      await enqueueSync('MovimientosInventarioMaterial', movimientoMaterial.MovimientoMaterialID, 'CREATE', movimientoMaterial);
    }
  });
}

export async function cerrarActividadesPendientesDelDia(loteId: string, user: Usuario): Promise<void> {
  const today = todayISO();
  const pendientes = await db.actividadesLote
    .where('LoteID')
    .equals(loteId)
    .and((actividad) => actividad.FechaProgramada <= today && actividad.Estado === 'PENDIENTE')
    .toArray();
  await Promise.all(pendientes.map((actividad) => actualizarActividad(actividad.ActividadLoteID, 'NO_REALIZADA', user, 'Cierre del día')));
}

export async function aplicarVacuna(vacunaId: string, user: Usuario, detalles: AplicarVacunaInput | string = ''): Promise<void> {
  const vacuna = await db.vacunasLote.get(vacunaId);
  if (!vacuna) throw new Error('Vacuna no encontrada.');
  const lote = await db.lotes.get(vacuna.LoteID);
  const assignment = await db.loteGalpones
    .where('LoteID')
    .equals(vacuna.LoteID)
    .and((item) => item.Estado === 'ACTIVO')
    .first();
  const input: Partial<AplicarVacunaInput> = typeof detalles === 'string' ? { Observacion: detalles } : detalles;
  const patch: Partial<VacunaLote> = {
    Estado: 'APLICADA',
    FechaAplicacion: nowISO(),
    AplicadaPor: user.UsuarioID,
    GalponID: vacuna.GalponID || assignment?.GalponID || '',
    Producto: input.Producto || vacuna.Producto || vacuna.NombreVacuna,
    Laboratorio: input.Laboratorio || vacuna.Laboratorio || '',
    LoteProducto: input.LoteProducto || vacuna.LoteProducto || '',
    FechaVencimientoProducto: input.FechaVencimientoProducto || vacuna.FechaVencimientoProducto || '',
    ViaAdministracion: input.ViaAdministracion || vacuna.ViaAdministracion || 'Agua de bebida',
    Cepa: input.Cepa || vacuna.Cepa || '',
    Enfermedad: input.Enfermedad || vacuna.Enfermedad || vacuna.NombreVacuna,
    NumeroAves: input.NumeroAves ?? (vacuna.NumeroAves || lote?.CantidadInicialTotal || 0),
    EdadDias: input.EdadDias ?? (lote ? getDiaLote(lote.FechaLlegada, todayISO()) : vacuna.EdadDias),
    Responsable: input.Responsable || user.Nombre,
    FirmaResponsable: input.FirmaResponsable || '',
    Foto: input.Foto || vacuna.Foto || '',
    Observacion: input.Observacion || '',
    EstadoSync: 'PENDIENTE',
  };
  await db.vacunasLote.update(vacunaId, patch);
  await enqueueSync('VacunasLote', vacunaId, 'UPDATE', { ...vacuna, ...patch });
}

async function updateInventory(tipoAlimentoId: string, bultosDelta: number, kgDelta: number): Promise<void> {
  const existing = await db.inventarioAlimento.where('TipoAlimentoID').equals(tipoAlimentoId).first();
  if (!existing) {
    await db.inventarioAlimento.add({
      InventarioID: createId('inv'),
      TipoAlimentoID: tipoAlimentoId,
      BultosDisponibles: Math.max(0, bultosDelta),
      KgDisponibles: Math.max(0, kgDelta),
      UltimaActualizacion: nowISO(),
    });
    return;
  }

  await db.inventarioAlimento.update(existing.InventarioID, {
    BultosDisponibles: Math.max(0, existing.BultosDisponibles + bultosDelta),
    KgDisponibles: Math.max(0, existing.KgDisponibles + kgDelta),
    UltimaActualizacion: nowISO(),
  });
}

async function updateMaterialInventory(
  tipoMaterial: TipoMaterialInventario,
  unidad: string,
  cantidadDelta: number,
): Promise<{ inventario: { InventarioMaterialID: string; TipoMaterial: TipoMaterialInventario; CantidadDisponible: number; Unidad: string; UltimaActualizacion: string }; operation: 'CREATE' | 'UPDATE' }> {
  const existing = await db.inventarioMaterial.where('TipoMaterial').equals(tipoMaterial).first();
  if (!existing) {
    const inventario = {
      InventarioMaterialID: createId('inv_mat'),
      TipoMaterial: tipoMaterial,
      CantidadDisponible: Math.max(0, cantidadDelta),
      Unidad: unidad,
      UltimaActualizacion: nowISO(),
    };
    await db.inventarioMaterial.add(inventario);
    return { inventario, operation: 'CREATE' };
  }

  const inventario = {
    ...existing,
    CantidadDisponible: Math.max(0, existing.CantidadDisponible + cantidadDelta),
    Unidad: existing.Unidad || unidad,
    UltimaActualizacion: nowISO(),
  };
  await db.inventarioMaterial.put(inventario);
  return { inventario, operation: 'UPDATE' };
}

export async function registrarEntradaAlimento(input: EntradaAlimentoInput, user: Usuario): Promise<EntradaAlimento> {
  const kgTotal = input.CantidadBultos * input.KgPorBulto;
  const entrada: EntradaAlimento = {
    EntradaAlimentoID: createId('entrada_alim'),
    Fecha: input.Fecha,
    TipoAlimentoID: input.TipoAlimentoID,
    CantidadBultos: input.CantidadBultos,
    KgPorBulto: input.KgPorBulto,
    KgTotal: kgTotal,
    ProveedorID: input.ProveedorID,
    FacturaID: '',
    PrecioUnitario: 0,
    EstadoAdmin: input.ProveedorID ? 'PENDIENTE_FACTURA' : 'PENDIENTE_PROVEEDOR',
    RegistradoPor: user.UsuarioID,
    Observaciones: input.Observaciones,
    EstadoSync: 'PENDIENTE',
  };
  const movimiento: MovimientoInventarioAlimento = {
    MovimientoInventarioID: createId('mov_inv'),
    Fecha: input.Fecha,
    TipoMovimiento: 'ENTRADA_COMPRA',
    TipoAlimentoID: input.TipoAlimentoID,
    CantidadBultos: input.CantidadBultos,
    KgTotal: kgTotal,
    LoteID: '',
    ProveedorID: input.ProveedorID,
    FacturaID: '',
    Origen: input.ProveedorID,
    Destino: 'GRANJA',
    RegistradoPor: user.UsuarioID,
    Observacion: input.Observaciones,
  };

  await db.transaction('rw', [db.entradasAlimento, db.inventarioAlimento, db.movimientosInventarioAlimento, db.syncQueue], async () => {
    await db.entradasAlimento.add(entrada);
    await updateInventory(input.TipoAlimentoID, input.CantidadBultos, kgTotal);
    await db.movimientosInventarioAlimento.add(movimiento);
    await enqueueSync('EntradasAlimento', entrada.EntradaAlimentoID, 'CREATE', entrada);
    await enqueueSync('MovimientosInventarioAlimento', movimiento.MovimientoInventarioID, 'CREATE', movimiento);
  });

  return entrada;
}

export async function registrarEntradaMaterial(input: EntradaMaterialInput, user: Usuario): Promise<EntradaMaterial> {
  const entrada: EntradaMaterial = {
    EntradaMaterialID: createId('entrada_mat'),
    Fecha: input.Fecha,
    FechaHoraRegistro: nowISO(),
    TipoMaterial: input.TipoMaterial,
    Cantidad: input.Cantidad,
    Unidad: input.Unidad,
    ProveedorID: input.ProveedorID,
    FacturaID: '',
    PrecioUnitario: 0,
    EstadoAdmin: input.ProveedorID ? 'PENDIENTE_FACTURA' : 'PENDIENTE_PROVEEDOR',
    RegistradoPor: user.UsuarioID,
    Observaciones: input.Observaciones,
    EstadoSync: 'PENDIENTE',
  };
  const movimiento: MovimientoInventarioMaterial = {
    MovimientoMaterialID: createId('mov_mat'),
    Fecha: input.Fecha,
    TipoMovimiento: 'ENTRADA_COMPRA',
    TipoMaterial: input.TipoMaterial,
    Cantidad: input.Cantidad,
    Unidad: input.Unidad,
    LoteID: '',
    GalponID: '',
    ProveedorID: input.ProveedorID,
    FacturaID: '',
    Origen: input.ProveedorID,
    Destino: 'GRANJA',
    RegistradoPor: user.UsuarioID,
    Observacion: input.Observaciones,
  };

  await db.transaction('rw', [db.entradasMaterial, db.inventarioMaterial, db.movimientosInventarioMaterial, db.syncQueue], async () => {
    await db.entradasMaterial.add(entrada);
    const inventorySync = await updateMaterialInventory(input.TipoMaterial, input.Unidad, input.Cantidad);
    await db.movimientosInventarioMaterial.add(movimiento);
    await enqueueSync('EntradasMaterial', entrada.EntradaMaterialID, 'CREATE', entrada);
    await enqueueSync('InventarioMaterial', inventorySync.inventario.InventarioMaterialID, inventorySync.operation, inventorySync.inventario);
    await enqueueSync('MovimientosInventarioMaterial', movimiento.MovimientoMaterialID, 'CREATE', movimiento);
  });

  return entrada;
}

export async function registrarSalida(input: SalidaInput, user: Usuario): Promise<SalidaPollo> {
  const salida: SalidaPollo = {
    SalidaID: createId('salida'),
    Fecha: input.Fecha,
    LoteID: input.LoteID,
    TipoSalida: input.TipoSalida,
    Sexo: input.Sexo,
    CantidadAves: input.CantidadAves,
    PesoTotalKg: input.PesoTotalKg,
    PesoPromedioKg: input.CantidadAves > 0 ? input.PesoTotalKg / input.CantidadAves : 0,
    ClienteID: input.ClienteID,
    PrecioKg: 0,
    ValorTotal: 0,
    FacturaVentaID: '',
    EstadoAdministrativo: input.TipoSalida === 'VENTA' ? 'PENDIENTE_PRECIO' : 'COMPLETO',
    RegistradoPor: user.UsuarioID,
    Observaciones: input.Observaciones,
    EstadoSync: 'PENDIENTE',
  };
  await db.salidasPollo.add(salida);
  await enqueueSync('SalidasPollo', salida.SalidaID, 'CREATE', salida);
  return salida;
}

export async function registrarControlAgua(input: ControlAguaInput, user: Usuario): Promise<ControlAgua> {
  const phSeleccionado = input.phSeleccionado ?? input.VerificacionPH;
  const cloroResidualSeleccionado = input.cloroResidualSeleccionado ?? input.VerificacionCloro;
  const cloroAdicionadoGramos = input.cloroAdicionadoGramos ?? input.DosificacionCloroGr;
  const control: ControlAgua = {
    ControlAguaID: createId('agua'),
    Fecha: input.Fecha,
    FechaHoraRegistro: nowISO(),
    fechaRegistro: input.fechaRegistro ?? input.Fecha,
    estado: input.estado ?? 'EN PROCESO',
    LoteID: input.LoteID,
    GalponID: input.GalponID,
    DosificacionCloroGr: cloroAdicionadoGramos,
    cloroAdicionadoGramos,
    PH: phSeleccionado,
    CloroLibrePPM: cloroResidualSeleccionado,
    VerificacionPH: phSeleccionado,
    phSeleccionado,
    phCorrecto: input.phCorrecto ?? (phSeleccionado === 6 || phSeleccionado === 6.8),
    VerificacionCloro: cloroResidualSeleccionado,
    cloroResidualSeleccionado,
    cloroCorrecto: input.cloroCorrecto ?? cloroResidualSeleccionado === 3,
    Foto: input.Foto,
    LugarMedicion: input.LugarMedicion,
    AccionTomada: input.AccionTomada,
    Observacion: input.Observacion,
    RegistradoPor: user.UsuarioID,
    EstadoSync: 'PENDIENTE',
  };
  await db.controlesAgua.add(control);
  await enqueueSync('ControlesAgua', control.ControlAguaID, 'CREATE', control);
  return control;
}

export async function registrarPlaga(input: RegistroPlagaInput, user: Usuario): Promise<RegistroPlaga> {
  const registro: RegistroPlaga = {
    RegistroPlagaID: createId('plaga'),
    Fecha: input.Fecha,
    FechaHoraRegistro: nowISO(),
    TipoPlaga: input.TipoPlaga,
    GalponID: input.GalponID,
    Producto: input.Producto,
    Dosificacion: input.Dosificacion,
    EstacionesVeneno: input.EstacionesVeneno,
    EstacionesVenenoDetalle: input.EstacionesVenenoDetalle,
    Responsable: user.UsuarioID,
    Foto: input.Foto,
    Observaciones: input.Observaciones,
    EstadoSync: 'PENDIENTE',
  };
  await db.registrosPlaga.add(registro);
  await enqueueSync('RegistrosPlaga', registro.RegistroPlagaID, 'CREATE', registro);
  return registro;
}

export async function registrarMedicamento(input: MedicamentoInput, user: Usuario): Promise<MedicamentoRegistro> {
  const medicamento: MedicamentoRegistro = {
    MedicamentoID: createId('med'),
    Fecha: input.Fecha,
    FechaHoraRegistro: nowISO(),
    Estado: input.Estado || 'EN PROCESO',
    LoteID: input.LoteID,
    GalponID: input.GalponID,
    Producto: input.Producto,
    LoteProducto: input.LoteProducto,
    FechaVencimiento: input.FechaVencimiento,
    EdadDias: input.EdadDias,
    NumeroAnimalesTratados: input.NumeroAnimalesTratados,
    Dosis: input.Dosis,
    ViaAdministracion: input.ViaAdministracion,
    Motivo: input.Motivo,
    Responsable: input.Responsable || user.Nombre,
    PeriodoRetiroDias: input.PeriodoRetiroDias,
    Foto: input.Foto,
    Observaciones: input.Observaciones,
    EstadoSync: 'PENDIENTE',
  };
  await db.medicamentos.add(medicamento);
  await enqueueSync('Medicamentos', medicamento.MedicamentoID, 'CREATE', medicamento);
  return medicamento;
}

export async function registrarPerro(input: PerroInput, user: Usuario): Promise<PerroRegistro> {
  const nombre = input.NombrePerro.trim();
  const existingById = input.PerroID ? await db.perros.get(input.PerroID) : undefined;
  const existingByName = existingById
    ? undefined
    : await db.perros
        .where('NombrePerro')
        .equalsIgnoreCase(nombre)
        .first();
  const perro: Perro = existingById ?? existingByName ?? {
    PerroID: createId('perro'),
    NombrePerro: nombre,
    Activo: true,
    FechaUltimaRabia: '',
    FechaUltimaDesparasitacion: '',
    FrecuenciaRabiaDias: 365,
    FrecuenciaDesparasitacionDias: 90,
    Observaciones: '',
    EstadoSync: 'PENDIENTE',
  };
  const nextPerro: Perro = {
    ...perro,
    NombrePerro: nombre || perro.NombrePerro,
    FechaUltimaRabia: input.TipoRegistro === 'RABIA' ? input.Fecha : perro.FechaUltimaRabia,
    FechaUltimaDesparasitacion: input.TipoRegistro === 'DESPARASITACION' ? input.Fecha : perro.FechaUltimaDesparasitacion,
    EstadoSync: 'PENDIENTE',
  };
  const registro: PerroRegistro = {
    PerroRegistroID: createId('perro'),
    PerroID: nextPerro.PerroID,
    Fecha: input.Fecha,
    FechaHoraRegistro: nowISO(),
    NombrePerro: nextPerro.NombrePerro,
    TipoRegistro: input.TipoRegistro,
    Producto: input.Producto,
    Laboratorio: input.Laboratorio,
    LoteProducto: input.LoteProducto,
    FechaVencimiento: input.FechaVencimiento,
    Responsable: input.Responsable || user.Nombre,
    FirmaResponsable: input.FirmaResponsable,
    Foto: input.Foto,
    Observaciones: input.Observaciones,
    EstadoSync: 'PENDIENTE',
  };
  await db.transaction('rw', [db.perros, db.perrosRegistros, db.syncQueue], async () => {
    await db.perros.put(nextPerro);
    await db.perrosRegistros.add(registro);
    await enqueueSync('Perros', nextPerro.PerroID, existingById || existingByName ? 'UPDATE' : 'CREATE', nextPerro);
    await enqueueSync('PerrosRegistros', registro.PerroRegistroID, 'CREATE', registro);
  });
  return registro;
}

export async function registrarCapacitacion(input: CapacitacionInput, user: Usuario): Promise<Capacitacion> {
  const capacitacionId = createId('cap');
  const capacitacion: Capacitacion = {
    CapacitacionID: capacitacionId,
    Fecha: input.Fecha,
    FechaHoraRegistro: nowISO(),
    Tema: input.Tema,
    Capacitador: input.Capacitador,
    FirmaCapacitador: input.FirmaCapacitador,
    Observaciones: input.Observaciones,
    RegistradoPor: user.UsuarioID,
    EstadoSync: 'PENDIENTE',
  };
  const asistentes: CapacitacionAsistente[] = input.Asistentes
    .filter((asistente) => asistente.Nombre.trim())
    .map((asistente) => ({
      AsistenteID: createId('cap_asist'),
      CapacitacionID: capacitacionId,
      Nombre: asistente.Nombre.trim(),
      Firma: asistente.Firma,
      EstadoSync: 'PENDIENTE',
    }));

  await db.transaction('rw', [db.capacitaciones, db.capacitacionAsistentes, db.syncQueue], async () => {
    await db.capacitaciones.add(capacitacion);
    if (asistentes.length > 0) await db.capacitacionAsistentes.bulkAdd(asistentes);
    await enqueueSync('Capacitaciones', capacitacion.CapacitacionID, 'CREATE', capacitacion);
    await Promise.all(asistentes.map((asistente) => enqueueSync('CapacitacionAsistentes', asistente.AsistenteID, 'CREATE', asistente)));
  });

  return capacitacion;
}

export async function registrarEventoSanitario(input: EventoSanitarioInput, user: Usuario): Promise<EventoSanitario> {
  const evento: EventoSanitario = {
    EventoSanitarioID: createId('evento'),
    ...input,
    Fotos: '',
    RegistradoPor: user.UsuarioID,
    Estado: 'ABIERTO',
    EstadoSync: 'PENDIENTE',
  };
  await db.eventosSanitarios.add(evento);
  await enqueueSync('EventosSanitarios', evento.EventoSanitarioID, 'CREATE', evento);
  return evento;
}
