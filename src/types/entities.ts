export type Role = 'ADMIN' | 'GALPONERO';
export type EstadoSync = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR' | 'REQUIERE_REVISION';
export type EstadoActivo = 'ACTIVO' | 'CERRADO' | 'CANCELADO';
export type SexoLote = 'MIXTO' | 'MACHO' | 'HEMBRA';
export type TipoMaterialInventario = 'CISCO' | 'GAS';
export type TipoPlaga = 'ROEDORES' | 'MOSCA';
export type FechaISO = string;
export type FechaHoraISO = string;

export interface SyncFields {
  EstadoSync: EstadoSync;
}

export interface Usuario {
  UsuarioID: string;
  Nombre: string;
  Email: string;
  Rol: Role;
  Activo: boolean;
  PuedeEditarHastaMinutos: number;
}

export interface Galpon {
  GalponID: string;
  NombreGalpon: string;
  Capacidad: number;
  EstadoActual: 'VACIO' | 'PREPARACION' | 'RECIBIMIENTO' | 'ENGORDE' | 'SALIDA' | 'LIMPIEZA' | 'DESCANSO_SANITARIO';
  Observaciones: string;
  Activo: boolean;
}

export interface Lote {
  LoteID: string;
  CodigoLote: string;
  FechaLlegada: FechaISO;
  CantidadInicialMachos: number;
  CantidadInicialHembras: number;
  CantidadInicialTotal: number;
  ProveedorPollitoID: string;
  FacturaPollitoID: string;
  EstadoLote: EstadoActivo;
  LineaGenetica: string;
  Observaciones: string;
  CreadoPor: string;
  FechaCreacion: FechaHoraISO;
}

export interface LoteGalpon {
  LoteGalponID: string;
  LoteID: string;
  GalponID: string;
  Sexo: SexoLote;
  FechaInicio: FechaISO;
  FechaFin: FechaISO;
  DiaInicio: number;
  DiaFin: number;
  CantidadEntrada: number;
  CantidadSalida: number;
  Estado: 'ACTIVO' | 'CERRADO' | 'PENDIENTE';
  Observaciones: string;
}

export interface MovimientoEntreGalpones {
  MovimientoID: string;
  Fecha: FechaISO;
  LoteID: string;
  GalponOrigenID: string;
  GalponDestinoID: string;
  Sexo: 'MACHO' | 'HEMBRA';
  CantidadMovida: number;
  Motivo: string;
  RegistradoPor: string;
  FechaHoraRegistro: FechaHoraISO;
  Observaciones: string;
}

export interface RegistroDiarioLote extends SyncFields {
  RegistroDiarioID: string;
  Fecha: FechaISO;
  LoteID: string;
  DiaLote: number;
  TipoAlimentoID: string;
  BultosConsumidos: number;
  KgConsumidos: number;
  MuertosMachos: number;
  MuertosHembras: number;
  MuertosSinClasificar: number;
  SacrificadosMachos: number;
  SacrificadosHembras: number;
  VendidosMachos: number;
  VendidosHembras: number;
  Observaciones: string;
  RegistradoPor: string;
  FechaHoraRegistro: FechaHoraISO;
  FechaHoraUltimaEdicion: FechaHoraISO;
  EditadoPor: string;
  Bloqueado: boolean;
}

export interface Pesaje extends SyncFields {
  PesajeID: string;
  Fecha: FechaISO;
  LoteID: string;
  DiaLote: number;
  SemanaLote: number;
  CantidadMachosPesados: number;
  CantidadHembrasPesadas: number;
  PesoPromedioMachos: number;
  PesoPromedioHembras: number;
  PesoPromedioGeneral: number;
  PesoMinimoMachos: number;
  PesoMaximoMachos: number;
  PesoMinimoHembras: number;
  PesoMaximoHembras: number;
  UniformidadMachos: number;
  UniformidadHembras: number;
  RegistradoPor: string;
  FechaHoraRegistro: FechaHoraISO;
}

export interface PesajeDetalle extends SyncFields {
  PesajeDetalleID: string;
  PesajeID: string;
  LoteID: string;
  Sexo: 'MACHO' | 'HEMBRA';
  NumeroAve: number;
  PesoGramos: number;
  FechaHoraRegistro: FechaHoraISO;
}

export interface SalidaPollo extends SyncFields {
  SalidaID: string;
  Fecha: FechaISO;
  LoteID: string;
  TipoSalida: 'VENTA' | 'SACRIFICIO' | 'AJUSTE_ADMIN';
  Sexo: SexoLote;
  CantidadAves: number;
  PesoTotalKg: number;
  PesoPromedioKg: number;
  ClienteID: string;
  PrecioKg: number;
  ValorTotal: number;
  FacturaVentaID: string;
  EstadoAdministrativo: 'PENDIENTE_PRECIO' | 'PENDIENTE_FACTURA' | 'COMPLETO' | 'REVISAR';
  RegistradoPor: string;
  Observaciones: string;
}

export interface ActividadProgramada {
  ActividadProgramadaID: string;
  NombreActividad: string;
  Categoria: string;
  TipoFrecuencia: 'UNICA' | 'DIARIA' | 'CADA_3_DIAS' | 'SEMANAL' | 'SEGUN_DIA_LOTE';
  DiaLote: number;
  HoraSugerida: string;
  AplicaDesdeDia: number;
  AplicaHastaDia: number;
  RequiereDato: boolean;
  RequiereFoto: boolean;
  Activa: boolean;
}

export interface ActividadLote extends SyncFields {
  ActividadLoteID: string;
  LoteID: string;
  GalponID: string;
  FechaProgramada: FechaISO;
  DiaLote: number;
  NombreActividad: string;
  Categoria: string;
  Estado: 'PENDIENTE' | 'REALIZADA' | 'NO_REALIZADA' | 'VENCIDA' | 'NO_APLICA';
  FechaRealizada: FechaHoraISO;
  RealizadaPor: string;
  Observacion: string;
  CerradaComoPendiente: boolean;
}

export interface PlanVacunalBase {
  VacunaBaseID: string;
  NombreVacuna: string;
  DiaProgramado: number;
  ViaAplicacion: string;
  Activa: boolean;
}

export interface VacunaLote extends SyncFields {
  VacunaLoteID: string;
  LoteID: string;
  GalponID: string;
  NombreVacuna: string;
  Producto: string;
  Laboratorio: string;
  LoteProducto: string;
  FechaVencimientoProducto: FechaISO;
  ViaAdministracion: string;
  Cepa: string;
  Enfermedad: string;
  NumeroAves: number;
  EdadDias: number;
  DiaProgramado: number;
  FechaProgramada: FechaISO;
  Estado: 'PENDIENTE' | 'APLICADA' | 'VENCIDA' | 'NO_APLICADA';
  FechaAplicacion: FechaHoraISO;
  AplicadaPor: string;
  Responsable: string;
  FirmaResponsable: string;
  Foto: string;
  Observacion: string;
}

export interface EntradaAlimento extends SyncFields {
  EntradaAlimentoID: string;
  Fecha: FechaISO;
  TipoAlimentoID: string;
  CantidadBultos: number;
  KgPorBulto: number;
  KgTotal: number;
  ProveedorID: string;
  FacturaID: string;
  PrecioUnitario: number;
  EstadoAdmin: 'PENDIENTE_PROVEEDOR' | 'PENDIENTE_FACTURA' | 'PENDIENTE_PRECIO' | 'COMPLETO';
  RegistradoPor: string;
  Observaciones: string;
}

export interface ConsumoAlimentoLote extends SyncFields {
  ConsumoID: string;
  Fecha: FechaISO;
  LoteID: string;
  TipoAlimentoID: string;
  BultosConsumidos: number;
  KgConsumidos: number;
  PorcentajeMañana: number;
  PorcentajeTarde: number;
  RegistradoPor: string;
}

export interface MaterialLote extends SyncFields {
  MaterialLoteID: string;
  Fecha: FechaISO;
  LoteID: string;
  GalponID: string;
  TipoMaterial: 'CISCO' | 'GAS' | 'OTRO';
  Cantidad: number;
  Unidad: string;
  ProveedorID: string;
  PrecioUnitario: number;
  FacturaID: string;
  EstadoAdmin: 'PENDIENTE_PROVEEDOR' | 'PENDIENTE_FACTURA' | 'PENDIENTE_PRECIO' | 'COMPLETO';
  RegistradoPor: string;
  Observaciones: string;
}

export interface ControlAgua extends SyncFields {
  ControlAguaID: string;
  Fecha: FechaISO;
  FechaHoraRegistro: FechaHoraISO;
  fechaRegistro: FechaISO;
  estado: string;
  LoteID: string;
  GalponID: string;
  DosificacionCloroGr: number;
  cloroAdicionadoGramos: number;
  PH: number;
  CloroLibrePPM: number;
  VerificacionPH: number;
  phSeleccionado: number;
  phCorrecto: boolean;
  VerificacionCloro: number;
  cloroResidualSeleccionado: number;
  cloroCorrecto: boolean;
  Foto: string;
  LugarMedicion: 'TANQUE' | 'LINEA' | 'NIPPLE';
  AccionTomada: string;
  Observacion: string;
  RegistradoPor: string;
}

export interface EventoSanitario extends SyncFields {
  EventoSanitarioID: string;
  Fecha: FechaISO;
  LoteID: string;
  GalponID: string;
  TipoEvento: 'DIARREA' | 'RESPIRATORIO' | 'MORTALIDAD_ALTA' | 'CAMA_HUMEDA' | 'BAJO_CONSUMO' | 'CALOR' | 'PATAS' | 'LESIONES' | 'OTRO';
  Severidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  Descripcion: string;
  Fotos: string;
  RegistradoPor: string;
  Estado: 'ABIERTO' | 'EN_SEGUIMIENTO' | 'CERRADO';
}

export interface TratamientoVeterinario {
  TratamientoID: string;
  FechaInicio: FechaISO;
  FechaFin: FechaISO;
  LoteID: string;
  Producto: string;
  Dosis: string;
  ViaAplicacion: string;
  Motivo: string;
  VeterinarioResponsable: string;
  PeriodoRetiroDias: number;
  Estado: 'ACTIVO' | 'FINALIZADO' | 'CANCELADO';
  Observaciones: string;
}

export interface Proveedor {
  ProveedorID: string;
  NombreProveedor: string;
  TipoProveedor: 'POLLITO' | 'ALIMENTO' | 'CISCO' | 'GAS' | 'MEDICAMENTO' | 'VACUNA' | 'TRANSPORTE' | 'VETERINARIO' | 'OTRO';
  Telefono: string;
  NIT: string;
  Contacto: string;
  ProductoPrincipal: string;
  Activo: boolean;
  Observaciones: string;
}

export interface Cliente {
  ClienteID: string;
  NombreCliente: string;
  Telefono: string;
  NIT: string;
  TipoCliente: string;
  Activo: boolean;
  Observaciones: string;
}

export interface TipoAlimento {
  TipoAlimentoID: string;
  Nombre: string;
  EtapaRecomendadaDesdeDia: number;
  EtapaRecomendadaHastaDia: number;
  KgPorBulto: number;
  Activo: boolean;
}

export interface FacturaCompra {
  FacturaCompraID: string;
  FechaFactura: FechaISO;
  ProveedorID: string;
  NumeroFactura: string;
  Categoria: string;
  Subtotal: number;
  IVA: number;
  Total: number;
  EstadoPago: 'PENDIENTE' | 'PAGADA' | 'ANULADA';
  ArchivoPDF: string;
  Observacion: string;
}

export interface DetalleFacturaCompra {
  DetalleID: string;
  FacturaCompraID: string;
  LoteID: string;
  ProductoServicio: string;
  Cantidad: number;
  Unidad: string;
  ValorUnitario: number;
  ValorTotal: number;
}

export interface FacturaVenta {
  FacturaVentaID: string;
  FechaFactura: FechaISO;
  ClienteID: string;
  NumeroFactura: string;
  Subtotal: number;
  IVA: number;
  Total: number;
  EstadoCobro: 'PENDIENTE' | 'PAGADO' | 'CREDITO' | 'ANULADO';
  ArchivoPDF: string;
  Observacion: string;
}

export interface DetalleFacturaVenta {
  DetalleVentaID: string;
  FacturaVentaID: string;
  LoteID: string;
  ProductoServicio: string;
  CantidadAves: number;
  Kg: number;
  PrecioKg: number;
  ValorTotal: number;
}

export interface CostoLote {
  CostoID: string;
  Fecha: FechaISO;
  LoteID: string;
  CategoriaCosto: 'POLLITO' | 'ALIMENTO' | 'CISCO' | 'GAS' | 'VACUNA' | 'MEDICAMENTO' | 'DESINFECTANTE' | 'MANO_OBRA' | 'TRANSPORTE' | 'SERVICIOS' | 'OTRO';
  Concepto: string;
  Cantidad: number;
  Unidad: string;
  ValorUnitario: number;
  ValorTotal: number;
  ProveedorID: string;
  FacturaID: string;
  Estado: 'PENDIENTE_FACTURA' | 'PENDIENTE_PRECIO' | 'COMPLETO' | 'REVISAR';
  Observacion: string;
}

export interface InventarioAlimento {
  InventarioID: string;
  TipoAlimentoID: string;
  BultosDisponibles: number;
  KgDisponibles: number;
  UltimaActualizacion: FechaHoraISO;
}

export interface MovimientoInventarioAlimento {
  MovimientoInventarioID: string;
  Fecha: FechaISO;
  TipoMovimiento: 'ENTRADA_COMPRA' | 'CONSUMO_LOTE' | 'AJUSTE_ADMIN' | 'DEVOLUCION' | 'MERMA' | 'TRASLADO';
  TipoAlimentoID: string;
  CantidadBultos: number;
  KgTotal: number;
  LoteID: string;
  ProveedorID: string;
  FacturaID: string;
  Origen: string;
  Destino: string;
  RegistradoPor: string;
  Observacion: string;
}

export interface EntradaMaterial extends SyncFields {
  EntradaMaterialID: string;
  Fecha: FechaISO;
  FechaHoraRegistro: FechaHoraISO;
  TipoMaterial: TipoMaterialInventario;
  Cantidad: number;
  Unidad: string;
  ProveedorID: string;
  FacturaID: string;
  PrecioUnitario: number;
  EstadoAdmin: 'PENDIENTE_PROVEEDOR' | 'PENDIENTE_FACTURA' | 'PENDIENTE_PRECIO' | 'COMPLETO';
  RegistradoPor: string;
  Observaciones: string;
}

export interface InventarioMaterial {
  InventarioMaterialID: string;
  TipoMaterial: TipoMaterialInventario;
  CantidadDisponible: number;
  Unidad: string;
  UltimaActualizacion: FechaHoraISO;
}

export interface MovimientoInventarioMaterial {
  MovimientoMaterialID: string;
  Fecha: FechaISO;
  TipoMovimiento: 'ENTRADA_COMPRA' | 'CONSUMO_LOTE' | 'AJUSTE_ADMIN' | 'MERMA';
  TipoMaterial: TipoMaterialInventario;
  Cantidad: number;
  Unidad: string;
  LoteID: string;
  GalponID: string;
  ProveedorID: string;
  FacturaID: string;
  Origen: string;
  Destino: string;
  RegistradoPor: string;
  Observacion: string;
}

export interface RegistroPlaga extends SyncFields {
  RegistroPlagaID: string;
  Fecha: FechaISO;
  FechaHoraRegistro: FechaHoraISO;
  TipoPlaga: TipoPlaga;
  GalponID: string;
  Producto: string;
  Dosificacion: string;
  EstacionesVeneno: number;
  EstacionesVenenoDetalle: string;
  Responsable: string;
  Foto: string;
  Observaciones: string;
}

export interface CompostajeCajon extends SyncFields {
  CajonID: string;
  CodigoCajon: string;
  Estado: 'ACTIVO' | 'LLENADO_CERRADO' | 'VOLTEO_PENDIENTE' | 'RETIRO_PENDIENTE' | 'RETIRADO';
  FechaInicio: FechaISO;
  FechaFinLlenado: FechaISO;
  FechaVolteo: FechaISO;
  FechaRetiro: FechaISO;
  AvesAcumuladas: number;
  Observaciones: string;
}

export interface CompostajeRegistro extends SyncFields {
  RegistroCompostajeID: string;
  CajonID: string;
  Fecha: FechaISO;
  FechaHoraRegistro: FechaHoraISO;
  LoteID: string;
  GalponID: string;
  RegistroDiarioID: string;
  MuertosMachos: number;
  MuertosHembras: number;
  MuertosSinClasificar: number;
  TotalAves: number;
  Fuente: 'MORTALIDAD_DIARIA' | 'AJUSTE_MANUAL';
  RegistradoPor: string;
  Observaciones: string;
}

export interface MedicamentoRegistro extends SyncFields {
  MedicamentoID: string;
  Fecha: FechaISO;
  FechaHoraRegistro: FechaHoraISO;
  Estado: string;
  LoteID: string;
  GalponID: string;
  Producto: string;
  LoteProducto: string;
  FechaVencimiento: FechaISO;
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

export interface PerroRegistro extends SyncFields {
  PerroRegistroID: string;
  Fecha: FechaISO;
  FechaHoraRegistro: FechaHoraISO;
  NombrePerro: string;
  TipoRegistro: 'RABIA' | 'DESPARASITACION';
  Producto: string;
  Laboratorio: string;
  LoteProducto: string;
  FechaVencimiento: FechaISO;
  Responsable: string;
  FirmaResponsable: string;
  Foto: string;
  Observaciones: string;
}

export interface Capacitacion extends SyncFields {
  CapacitacionID: string;
  Fecha: FechaISO;
  FechaHoraRegistro: FechaHoraISO;
  Tema: string;
  Capacitador: string;
  FirmaCapacitador: string;
  Observaciones: string;
  RegistradoPor: string;
}

export interface CapacitacionAsistente extends SyncFields {
  AsistenteID: string;
  CapacitacionID: string;
  Nombre: string;
  Firma: string;
}

export interface CurvaEstandar {
  CurvaID: string;
  LineaGenetica: string;
  Sexo: 'MACHO' | 'HEMBRA' | 'GENERAL';
  DiaLote: number;
  PesoEsperadoGr: number;
  ConsumoDiarioEsperadoGrAve: number;
  ConsumoAcumuladoEsperadoGrAve: number;
  ConversionEsperada: number;
  MortalidadMaximaAcumulada: number;
  GananciaDiariaEsperada: number;
}

export interface CierreSemanal {
  CierreSemanalID: string;
  LoteID: string;
  SemanaLote: number;
  FechaInicio: FechaISO;
  FechaFin: FechaISO;
  AvesInicialSemana: number;
  AvesFinalSemana: number;
  MuertosSemana: number;
  MortalidadSemana: number;
  MortalidadAcumulada: number;
  ConsumoSemanaKg: number;
  ConsumoAcumuladoKg: number;
  PesoPromedioMacho: number;
  PesoPromedioHembra: number;
  PesoPromedioGeneral: number;
  GananciaDiariaMacho: number;
  GananciaDiariaHembra: number;
  ConversionSemana: number;
  ConversionAcumulada: number;
  CostoSemana: number;
  CostoAcumulado: number;
  ActividadesNoRealizadas: number;
  AlertasGeneradas: number;
  EstadoCierre: 'GENERADO' | 'REVISADO' | 'APROBADO' | 'REABIERTO';
}

export interface CierreLote {
  CierreLoteID: string;
  LoteID: string;
  FechaCierre: FechaISO;
  CantidadInicial: number;
  CantidadVendida: number;
  CantidadMuerta: number;
  MortalidadFinal: number;
  KgVendidos: number;
  IngresoTotal: number;
  CostoTotal: number;
  UtilidadBruta: number;
  CostoPorAveInicial: number;
  CostoPorAveVendida: number;
  CostoPorKg: number;
  IngresoPorKg: number;
  UtilidadPorKg: number;
  Margen: number;
  ConversionFinal: number;
  PesoPromedioFinal: number;
  EdadFinal: number;
  EstadoCierre: string;
}

export interface Alerta {
  AlertaID: string;
  Fecha: FechaISO;
  LoteID: string;
  TipoAlerta: string;
  Nivel: 'INFORMATIVA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  Mensaje: string;
  Estado: 'ABIERTA' | 'RESUELTA' | 'IGNORADA';
  Responsable: string;
  FechaResuelta: FechaHoraISO;
  Observacion: string;
}

export interface HistorialCambio {
  CambioID: string;
  Tabla: string;
  RegistroID: string;
  CampoEditado: string;
  ValorAnterior: string;
  ValorNuevo: string;
  EditadoPor: string;
  FechaHoraCambio: FechaHoraISO;
  Motivo: string;
}

export interface ReportePDF {
  ReporteID: string;
  LoteID: string;
  FechaGeneracion: FechaHoraISO;
  TipoReporte: 'TECNICO' | 'ECONOMICO' | 'COMPLETO';
  URLArchivo: string;
  GeneradoPor: string;
}

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export type SyncEntityTable =
  | 'Usuarios'
  | 'Galpones'
  | 'Lotes'
  | 'LoteGalpones'
  | 'MovimientosEntreGalpones'
  | 'RegistroDiarioLote'
  | 'Pesajes'
  | 'PesajeDetalle'
  | 'SalidasPollo'
  | 'ActividadesLote'
  | 'VacunasLote'
  | 'EntradasAlimento'
  | 'ConsumoAlimentoLote'
  | 'MaterialesLote'
  | 'EntradasMaterial'
  | 'InventarioMaterial'
  | 'MovimientosInventarioMaterial'
  | 'ControlesAgua'
  | 'EventosSanitarios'
  | 'TratamientosVeterinarios'
  | 'RegistrosPlaga'
  | 'CompostajeCajones'
  | 'CompostajeRegistros'
  | 'Medicamentos'
  | 'PerrosRegistros'
  | 'Capacitaciones'
  | 'CapacitacionAsistentes'
  | 'Proveedores'
  | 'Clientes'
  | 'TiposAlimento'
  | 'FacturasCompra'
  | 'DetalleFacturasCompra'
  | 'FacturasVenta'
  | 'DetalleFacturasVenta'
  | 'CostosLote'
  | 'InventarioAlimento'
  | 'MovimientosInventarioAlimento'
  | 'CurvasEstandar'
  | 'CierresSemanales'
  | 'CierreLote'
  | 'Alertas'
  | 'HistorialCambios'
  | 'ReportesPDF';

export interface SyncQueueItem {
  SyncID: string;
  Tabla: SyncEntityTable;
  RegistroID: string;
  Operacion: SyncOperation;
  Payload: unknown;
  EstadoSync: EstadoSync;
  Intentos: number;
  Error: string;
  CreadoEn: FechaHoraISO;
  ActualizadoEn: FechaHoraISO;
}

export interface LoteResumen {
  LoteID: string;
  CodigoLote: string;
  DiaLote: number;
  Galpones: string[];
  MachosVivos: number;
  HembrasVivas: number;
  AvesVivasTotal: number;
  MortalidadAcumulada: number;
  ConsumoAcumuladoKg: number;
  PesoPromedioMachoKg: number;
  PesoPromedioHembraKg: number;
  PesoPromedioGeneralKg: number;
  ConversionAlimenticia: number;
  PendientesHoy: number;
  VacunasPendientes: number;
  SyncPendiente: number;
}
