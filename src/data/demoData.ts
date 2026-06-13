import { addDays, getDiaLote, getSemanaLote, nowISO, todayISO } from '../lib/date';
import type {
  ActividadLote,
  ActividadProgramada,
  Alerta,
  Cliente,
  ConsumoAlimentoLote,
  CurvaEstandar,
  Galpon,
  InventarioAlimento,
  Lote,
  LoteGalpon,
  Pesaje,
  PesajeDetalle,
  PlanVacunalBase,
  Perro,
  Proveedor,
  RegistroDiarioLote,
  TipoAlimento,
  Usuario,
  VacunaLote,
} from '../types/entities';

export interface DemoData {
  usuarios: Usuario[];
  galpones: Galpon[];
  proveedores: Proveedor[];
  clientes: Cliente[];
  tiposAlimento: TipoAlimento[];
  lotes: Lote[];
  loteGalpones: LoteGalpon[];
  registroDiarioLote: RegistroDiarioLote[];
  consumosAlimentoLote: ConsumoAlimentoLote[];
  pesajes: Pesaje[];
  pesajeDetalle: PesajeDetalle[];
  actividadesProgramadas: ActividadProgramada[];
  actividadesLote: ActividadLote[];
  planVacunalBase: PlanVacunalBase[];
  vacunasLote: VacunaLote[];
  perros: Perro[];
  inventarioAlimento: InventarioAlimento[];
  curvasEstandar: CurvaEstandar[];
  alertas: Alerta[];
}

const baseActivityRows: Array<[string, string, string, ActividadProgramada['TipoFrecuencia'], number, string, number, number]> = [
  ['act_lote_ampliacion_dia_3', 'Ampliación día 3.', 'Manejo', 'SEGUN_DIA_LOTE', 3, '', 3, 3],
  ['act_lote_ampliacion_dia_8', 'Ampliación día 8.', 'Manejo', 'SEGUN_DIA_LOTE', 8, '', 8, 8],
  ['act_lote_sacar_bebederos_babies_dia_11', 'Sacar bebederos babies día 11.', 'Manejo', 'SEGUN_DIA_LOTE', 11, '', 11, 11],
  ['act_lote_retirar_calentadoras_dia_15', 'Ampliación y retirada calentadoras día 15.', 'Manejo', 'SEGUN_DIA_LOTE', 15, '', 15, 15],
  ['act_lote_ampliacion_dia_20', 'Ampliación día 20.', 'Manejo', 'SEGUN_DIA_LOTE', 20, '', 20, 20],
  ['act_lote_desencortinar_dia_20', 'Desencortinar día 20.', 'Manejo', 'SEGUN_DIA_LOTE', 20, '', 20, 20],
  ['act_lote_bajar_hembras_dia_21', 'Bajar hembras día 21.', 'Manejo', 'SEGUN_DIA_LOTE', 21, '', 21, 21],
  ['act_rutina_clorar_tanque', 'Clorar tanque principal cada 3 días.', 'Agua', 'CADA_3_DIAS', 3, '', 3, 42],
  ['act_rutina_sulfatar_tanque', 'Sulfatar tanque 24 horas antes de clorar.', 'Agua', 'CADA_3_DIAS', 2, '', 2, 41],
  ['act_rutina_medir_cloro_ph', 'Medir cloro y pH en líneas y tanques.', 'Agua', 'DIARIA', 1, '08:00', 1, 42],
  ['act_rutina_purgar_linea', 'Purgar línea.', 'Agua', 'DIARIA', 1, '08:00', 1, 42],
  ['act_rutina_alimentacion_manana', 'Alimentación mañana 70% (5:00 - 5:30 am).', 'Alimentación', 'DIARIA', 1, '05:00', 1, 42],
  ['act_rutina_alimentacion_tarde', 'Alimentación tarde 30% (3:00 - 4:00 pm).', 'Alimentación', 'DIARIA', 1, '15:00', 1, 42],
  ['act_rutina_fumigacion_9am', 'Fumigación con desinfectante dentro del galpón 9am.', 'Bioseguridad', 'DIARIA', 1, '09:00', 1, 42],
  ['act_rutina_fumigacion_4pm', 'Fumigación con desinfectante dentro del galpón 4pm.', 'Bioseguridad', 'DIARIA', 1, '16:00', 1, 42],
  ['act_rutina_revolcar_cama', 'Revolcar cama.', 'Rutina', 'DIARIA', 1, '10:00', 1, 42],
  ['act_rutina_control_pediluvios', 'Control de pediluvios con creolina.', 'Bioseguridad', 'DIARIA', 1, '08:30', 1, 42],
  ['act_rutina_control_plagas', 'Control de plagas con Cicario / Cipermetrina para la mosca alrededor del galpón.', 'Plagas', 'DIARIA', 1, '17:00', 1, 42],
  ['act_rutina_limpiar_mallas', 'Limpiar mallas y telarañas.', 'Rutina', 'SEMANAL', 7, '', 7, 42],
  ['act_rutina_lavar_filtros', 'Lavar filtros.', 'Rutina', 'SEMANAL', 7, '', 7, 42],
];

const baseActivities: ActividadProgramada[] = baseActivityRows.map(
  ([ActividadProgramadaID, NombreActividad, Categoria, TipoFrecuencia, DiaLote, HoraSugerida, AplicaDesdeDia, AplicaHastaDia]) => ({
    ActividadProgramadaID: String(ActividadProgramadaID),
    NombreActividad: String(NombreActividad),
    Categoria: String(Categoria),
    TipoFrecuencia: TipoFrecuencia as ActividadProgramada['TipoFrecuencia'],
    DiaLote: Number(DiaLote),
    HoraSugerida: String(HoraSugerida),
    AplicaDesdeDia: Number(AplicaDesdeDia),
    AplicaHastaDia: Number(AplicaHastaDia),
    RequiereDato: /calentadoras|Cisco|temperatura|pollinaza/i.test(String(NombreActividad)),
    RequiereFoto: false,
    Activa: true,
  }),
);

export function createDemoData(): DemoData {
  const today = todayISO();
  const now = nowISO();
  const fechaLlegada = addDays(today, -9);
  const loteId = 'lote_demo_001';
  const galponId = 'galpon_1A';
  const diaLote = getDiaLote(fechaLlegada, today);

  const usuarios: Usuario[] = [
    {
      UsuarioID: 'user_admin',
      Nombre: 'Administrador',
      Email: 'admin@pollos.local',
      Rol: 'ADMIN',
      Activo: true,
      PuedeEditarHastaMinutos: 999999,
    },
    {
      UsuarioID: 'user_galponero',
      Nombre: 'Galponero',
      Email: 'galponero@pollos.local',
      Rol: 'GALPONERO',
      Activo: true,
      PuedeEditarHastaMinutos: 60,
    },
  ];

  const galpones: Galpon[] = [
    ['galpon_1A', '1A', 750],
    ['galpon_1B', '1B', 750],
    ['galpon_2A', '2A', 750],
    ['galpon_2B', '2B', 750],
    ['galpon_3A', '3A', 2500],
    ['galpon_3B', '3B', 2500],
  ].map(([GalponID, NombreGalpon, Capacidad]) => ({
    GalponID: String(GalponID),
    NombreGalpon: String(NombreGalpon),
    Capacidad: Number(Capacidad),
    EstadoActual: 'ENGORDE',
    Observaciones: 'Lote demo activo',
    Activo: true,
  }));

  const proveedores: Proveedor[] = [
    {
      ProveedorID: 'prov_pollito_001',
      NombreProveedor: 'Incubadora Demo',
      TipoProveedor: 'POLLITO',
      Telefono: '',
      NIT: '',
      Contacto: '',
      ProductoPrincipal: 'Pollito Cobb 500',
      Activo: true,
      Observaciones: 'Proveedor demo',
    },
    {
      ProveedorID: 'prov_alimento_001',
      NombreProveedor: 'Alimentos Demo',
      TipoProveedor: 'ALIMENTO',
      Telefono: '',
      NIT: '',
      Contacto: '',
      ProductoPrincipal: 'Preiniciador e iniciador',
      Activo: true,
      Observaciones: 'Proveedor demo',
    },
  ];

  const clientes: Cliente[] = [
    {
      ClienteID: 'cliente_demo_001',
      NombreCliente: 'Cliente mostrador',
      Telefono: '',
      NIT: '',
      TipoCliente: 'LOCAL',
      Activo: true,
      Observaciones: '',
    },
  ];

  const tiposAlimento: TipoAlimento[] = [
    {
      TipoAlimentoID: 'alimento_preiniciador',
      Nombre: 'Preiniciador',
      EtapaRecomendadaDesdeDia: 1,
      EtapaRecomendadaHastaDia: 10,
      KgPorBulto: 40,
      Activo: true,
    },
    {
      TipoAlimentoID: 'alimento_iniciador',
      Nombre: 'Iniciador',
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

  const lotes: Lote[] = [
    {
      LoteID: loteId,
      CodigoLote: 'POLLOS-001',
      FechaLlegada: fechaLlegada,
      CantidadInicialMachos: 3800,
      CantidadInicialHembras: 3700,
      CantidadInicialTotal: 7500,
      ProveedorPollitoID: 'prov_pollito_001',
      FacturaPollitoID: '',
      EstadoLote: 'ACTIVO',
      LineaGenetica: 'Cobb 500',
      Observaciones: 'Lote demo para pruebas offline',
      CreadoPor: 'user_admin',
      FechaCreacion: now,
    },
  ];

  const loteGalpones: LoteGalpon[] = [
    ['galpon_1A', 750],
    ['galpon_1B', 750],
    ['galpon_2A', 750],
    ['galpon_2B', 750],
    ['galpon_3A', 2250],
    ['galpon_3B', 2250],
  ].map(([GalponID, CantidadEntrada], index) => ({
    LoteGalponID: `lote_galpon_demo_${index + 1}`,
    LoteID: loteId,
    GalponID: String(GalponID),
    Sexo: 'MIXTO',
    FechaInicio: fechaLlegada,
    FechaFin: '',
    DiaInicio: 1,
    DiaFin: 0,
    CantidadEntrada: Number(CantidadEntrada),
    CantidadSalida: 0,
    Estado: 'ACTIVO',
    Observaciones: 'Machos y hembras juntos',
  }));

  const registroDiarioLote: RegistroDiarioLote[] = [1, 2, 3, 4, 5, 6, 7, 8].map((day) => {
    const fecha = addDays(fechaLlegada, day - 1);
    return {
      RegistroDiarioID: `reg_demo_${day}`,
      Fecha: fecha,
      LoteID: loteId,
      DiaLote: day,
      TipoAlimentoID: 'alimento_preiniciador',
      BultosConsumidos: day < 3 ? 5 : 8 + day,
      KgConsumidos: (day < 3 ? 5 : 8 + day) * 40,
      MuertosMachos: day === 1 ? 18 : day % 3,
      MuertosHembras: day === 1 ? 15 : day % 2,
      MuertosSinClasificar: 0,
      SacrificadosMachos: 0,
      SacrificadosHembras: 0,
      VendidosMachos: 0,
      VendidosHembras: 0,
      Observaciones: '',
      RegistradoPor: 'user_galponero',
      FechaHoraRegistro: `${fecha}T13:00:00.000Z`,
      FechaHoraUltimaEdicion: `${fecha}T13:00:00.000Z`,
      EditadoPor: 'user_galponero',
      Bloqueado: true,
      EstadoSync: 'SINCRONIZADO',
    };
  });

  const consumosAlimentoLote: ConsumoAlimentoLote[] = registroDiarioLote.map((registro) => ({
    ConsumoID: `consumo_${registro.RegistroDiarioID}`,
    Fecha: registro.Fecha,
    LoteID: registro.LoteID,
    TipoAlimentoID: registro.TipoAlimentoID,
    BultosConsumidos: registro.BultosConsumidos,
    KgConsumidos: registro.KgConsumidos,
    PorcentajeMañana: 70,
    PorcentajeTarde: 30,
    RegistradoPor: registro.RegistradoPor,
    EstadoSync: 'SINCRONIZADO',
  }));

  const pesajeDetalle: PesajeDetalle[] = [
    ...Array.from({ length: 50 }, (_, index) => ({
      PesajeDetalleID: `peso_m_${index + 1}`,
      PesajeID: 'pesaje_demo_001',
      LoteID: loteId,
      Sexo: 'MACHO' as const,
      NumeroAve: index + 1,
      PesoGramos: 240 + index * 2,
      FechaHoraRegistro: now,
      EstadoSync: 'SINCRONIZADO' as const,
    })),
    ...Array.from({ length: 50 }, (_, index) => ({
      PesajeDetalleID: `peso_h_${index + 1}`,
      PesajeID: 'pesaje_demo_001',
      LoteID: loteId,
      Sexo: 'HEMBRA' as const,
      NumeroAve: index + 1,
      PesoGramos: 220 + index * 2,
      FechaHoraRegistro: now,
      EstadoSync: 'SINCRONIZADO' as const,
    })),
  ];

  const pesajes: Pesaje[] = [
    {
      PesajeID: 'pesaje_demo_001',
      Fecha: addDays(fechaLlegada, 6),
      LoteID: loteId,
      DiaLote: 7,
      SemanaLote: getSemanaLote(7),
      CantidadMachosPesados: 50,
      CantidadHembrasPesadas: 50,
      PesoPromedioMachos: 289,
      PesoPromedioHembras: 269,
      PesoPromedioGeneral: 279,
      PesoMinimoMachos: 240,
      PesoMaximoMachos: 338,
      PesoMinimoHembras: 220,
      PesoMaximoHembras: 318,
      UniformidadMachos: 0.94,
      UniformidadHembras: 0.94,
      RegistradoPor: 'user_galponero',
      FechaHoraRegistro: now,
      EstadoSync: 'SINCRONIZADO',
    },
  ];

  const actividadesProgramadas: ActividadProgramada[] = baseActivities.map((activity) => ({ ...activity }));

  const actividadesLote: ActividadLote[] = actividadesProgramadas
    .filter((activity) => activity.Activa && activity.AplicaDesdeDia <= diaLote && activity.AplicaHastaDia >= Math.max(1, diaLote - 2))
    .flatMap((activity) => {
      const scheduledDay =
        activity.TipoFrecuencia === 'DIARIA'
          ? diaLote
          : activity.TipoFrecuencia === 'CADA_3_DIAS'
            ? Math.max(activity.AplicaDesdeDia, diaLote - ((diaLote - activity.AplicaDesdeDia) % 3))
            : activity.TipoFrecuencia === 'MENSUAL'
              ? Math.max(1, diaLote - ((diaLote - Math.max(1, activity.AplicaDesdeDia)) % 30))
            : activity.DiaLote;
      const fechaProgramada = addDays(fechaLlegada, scheduledDay - 1);
      return [
        {
          ActividadLoteID: `act_lote_${activity.ActividadProgramadaID}_${scheduledDay}`,
          LoteID: loteId,
          GalponID: galponId,
          FechaProgramada: fechaProgramada,
          DiaLote: scheduledDay,
          NombreActividad: activity.NombreActividad,
          Categoria: activity.Categoria,
          Estado: fechaProgramada < today ? 'VENCIDA' : 'PENDIENTE',
          FechaRealizada: '',
          RealizadaPor: '',
          Observacion: '',
          CerradaComoPendiente: false,
          EstadoSync: 'SINCRONIZADO' as const,
        },
      ];
    });

  const planVacunalBase: PlanVacunalBase[] = [
    {
      VacunaBaseID: 'vac_base_gumboro',
      NombreVacuna: 'Gumboro',
      DiaProgramado: 8,
      ViaAplicacion: 'Agua',
      Activa: true,
    },
    {
      VacunaBaseID: 'vac_base_newcastle',
      NombreVacuna: 'Newcastle',
      DiaProgramado: 10,
      ViaAplicacion: 'Agua',
      Activa: true,
    },
  ];

  const vacunasLote: VacunaLote[] = planVacunalBase.map((vacuna) => ({
    VacunaLoteID: `vac_lote_${vacuna.VacunaBaseID}`,
    LoteID: loteId,
    GalponID: galponId,
    NombreVacuna: vacuna.NombreVacuna,
    Producto: vacuna.NombreVacuna,
    Laboratorio: '',
    LoteProducto: '',
    FechaVencimientoProducto: '',
    ViaAdministracion: vacuna.ViaAplicacion,
    Cepa: '',
    Enfermedad: vacuna.NombreVacuna,
    NumeroAves: 7500,
    EdadDias: vacuna.DiaProgramado,
    DiaProgramado: vacuna.DiaProgramado,
    FechaProgramada: addDays(fechaLlegada, vacuna.DiaProgramado - 1),
    Estado: vacuna.DiaProgramado < diaLote ? 'VENCIDA' : 'PENDIENTE',
    FechaAplicacion: '',
    AplicadaPor: '',
    Responsable: '',
    FirmaResponsable: '',
    Foto: '',
    Observacion: '',
    EstadoSync: 'SINCRONIZADO',
  }));

  const perros: Perro[] = [
    {
      PerroID: 'perro_demo_akira',
      NombrePerro: 'Akira',
      Activo: true,
      FechaUltimaRabia: addDays(today, -366),
      FechaUltimaDesparasitacion: addDays(today, -35),
      FrecuenciaRabiaDias: 365,
      FrecuenciaDesparasitacionDias: 90,
      Observaciones: '',
      EstadoSync: 'SINCRONIZADO',
    },
    {
      PerroID: 'perro_demo_toby',
      NombrePerro: 'Toby',
      Activo: true,
      FechaUltimaRabia: addDays(today, -150),
      FechaUltimaDesparasitacion: addDays(today, -86),
      FrecuenciaRabiaDias: 365,
      FrecuenciaDesparasitacionDias: 90,
      Observaciones: '',
      EstadoSync: 'SINCRONIZADO',
    },
  ];

  const inventarioAlimento: InventarioAlimento[] = tiposAlimento.map((tipo, index) => ({
    InventarioID: `inv_${tipo.TipoAlimentoID}`,
    TipoAlimentoID: tipo.TipoAlimentoID,
    BultosDisponibles: index === 0 ? 145 : 80,
    KgDisponibles: (index === 0 ? 145 : 80) * tipo.KgPorBulto,
    UltimaActualizacion: now,
  }));

  const curvasEstandar: CurvaEstandar[] = Array.from({ length: 42 }, (_, index) => {
    const day = index + 1;
    const expected = Math.round(42 + Math.pow(day, 1.45) * 24);
    return {
      CurvaID: `curva_general_${day}`,
      LineaGenetica: 'Cobb 500',
      Sexo: 'GENERAL',
      DiaLote: day,
      PesoEsperadoGr: expected,
      ConsumoDiarioEsperadoGrAve: Math.round(12 + day * 4.8),
      ConsumoAcumuladoEsperadoGrAve: Math.round(day * (10 + day * 2.6)),
      ConversionEsperada: 1.15 + day * 0.015,
      MortalidadMaximaAcumulada: 0.005 + day * 0.001,
      GananciaDiariaEsperada: Math.round(18 + day * 1.7),
    };
  });

  const alertas: Alerta[] = [
    {
      AlertaID: 'alerta_demo_vacuna',
      Fecha: today,
      LoteID: loteId,
      TipoAlerta: 'Vacuna vencida',
      Nivel: 'ALTA',
      Mensaje: 'Gumboro está vencida en el lote demo.',
      Estado: 'ABIERTA',
      Responsable: 'user_admin',
      FechaResuelta: '',
      Observacion: '',
    },
  ];

  return {
    usuarios,
    galpones,
    proveedores,
    clientes,
    tiposAlimento,
    lotes,
    loteGalpones,
    registroDiarioLote,
    consumosAlimentoLote,
    pesajes,
    pesajeDetalle,
    actividadesProgramadas,
    actividadesLote,
    planVacunalBase,
    vacunasLote,
    perros,
    inventarioAlimento,
    curvasEstandar,
    alertas,
  };
}
