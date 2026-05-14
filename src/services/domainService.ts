import { calculatePesajeStats } from './calculationsService';
import { db } from './localDbService';
import { enqueueSync } from './syncService';
import { addDays, getDiaLote, getSemanaLote, nowISO, todayISO } from '../lib/date';
import { createId } from '../lib/id';
import type {
  ActividadLote,
  ControlAgua,
  EntradaAlimento,
  EventoSanitario,
  Galpon,
  Lote,
  LoteGalpon,
  MaterialLote,
  MovimientoInventarioAlimento,
  Pesaje,
  PesajeDetalle,
  RegistroDiarioLote,
  SalidaPollo,
  SexoLote,
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
  KgConsumidos: number;
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
  LoteID: string;
  GalponID: string;
  PH: number;
  CloroLibrePPM: number;
  LugarMedicion: ControlAgua['LugarMedicion'];
  AccionTomada: string;
  Observacion: string;
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
  const templates = (await db.actividadesProgramadas.toArray()).filter((template) => template.Activa);
  const activities: ActividadLote[] = [];

  for (const template of templates) {
    const days: number[] = [];
    if (template.TipoFrecuencia === 'DIARIA') {
      for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 1) days.push(day);
    } else if (template.TipoFrecuencia === 'CADA_3_DIAS') {
      for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 3) days.push(day);
    } else if (template.TipoFrecuencia === 'SEMANAL') {
      for (let day = Math.max(1, template.AplicaDesdeDia); day <= template.AplicaHastaDia; day += 7) days.push(day);
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

async function buildVacunasForLote(lote: Lote): Promise<VacunaLote[]> {
  const vacunas = (await db.planVacunalBase.toArray()).filter((vacuna) => vacuna.Activa);
  return vacunas.map((vacuna) => ({
    VacunaLoteID: createId('vac_lote'),
    LoteID: lote.LoteID,
    NombreVacuna: vacuna.NombreVacuna,
    DiaProgramado: vacuna.DiaProgramado,
    FechaProgramada: addDays(lote.FechaLlegada, vacuna.DiaProgramado - 1),
    Estado: 'PENDIENTE',
    FechaAplicacion: '',
    AplicadaPor: '',
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
  const vacunas = await buildVacunasForLote(lote);
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

export async function registrarDia(input: RegistroDiaInput, user: Usuario): Promise<RegistroDiarioLote> {
  const lote = await db.lotes.get(input.LoteID);
  if (!lote) throw new Error('Lote no encontrado.');
  const now = nowISO();
  const diaLote = getDiaLote(lote.FechaLlegada, input.Fecha);

  const registro: RegistroDiarioLote = {
    RegistroDiarioID: createId('reg_dia'),
    Fecha: input.Fecha,
    LoteID: input.LoteID,
    DiaLote: diaLote,
    TipoAlimentoID: input.TipoAlimentoID,
    BultosConsumidos: input.BultosConsumidos,
    KgConsumidos: input.KgConsumidos,
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
    KgConsumidos: input.KgConsumidos,
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
    KgTotal: input.KgConsumidos,
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
    [db.registroDiarioLote, db.consumosAlimentoLote, db.inventarioAlimento, db.movimientosInventarioAlimento, db.syncQueue],
    async () => {
      await db.registroDiarioLote.add(registro);
      await db.consumosAlimentoLote.add(consumo);
      await updateInventory(input.TipoAlimentoID, -input.BultosConsumidos, -input.KgConsumidos);
      await db.movimientosInventarioAlimento.add(movimiento);
      await enqueueSync('RegistroDiarioLote', registro.RegistroDiarioID, 'CREATE', registro);
      await enqueueSync('ConsumoAlimentoLote', consumo.ConsumoID, 'CREATE', consumo);
      await enqueueSync('MovimientosInventarioAlimento', movimiento.MovimientoInventarioID, 'CREATE', movimiento);
    },
  );

  return registro;
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

  await db.transaction('rw', [db.actividadesLote, db.materialesLote, db.syncQueue], async () => {
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

export async function aplicarVacuna(vacunaId: string, user: Usuario, observacion = ''): Promise<void> {
  const vacuna = await db.vacunasLote.get(vacunaId);
  if (!vacuna) throw new Error('Vacuna no encontrada.');
  const patch: Partial<VacunaLote> = {
    Estado: 'APLICADA',
    FechaAplicacion: nowISO(),
    AplicadaPor: user.UsuarioID,
    Observacion: observacion,
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
  const control: ControlAgua = {
    ControlAguaID: createId('agua'),
    ...input,
    RegistradoPor: user.UsuarioID,
    EstadoSync: 'PENDIENTE',
  };
  await db.controlesAgua.add(control);
  await enqueueSync('ControlesAgua', control.ControlAguaID, 'CREATE', control);
  return control;
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
