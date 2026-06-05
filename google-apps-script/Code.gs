const SHEET_ID = 'REEMPLAZAR_CON_ID_DE_GOOGLE_SHEETS';

const TABLE_HEADERS = {
  Usuarios: ['UsuarioID', 'Nombre', 'Email', 'Rol', 'Activo', 'PuedeEditarHastaMinutos'],
  Galpones: ['GalponID', 'NombreGalpon', 'Capacidad', 'EstadoActual', 'Observaciones', 'Activo'],
  Lotes: [
    'LoteID',
    'CodigoLote',
    'FechaLlegada',
    'CantidadInicialMachos',
    'CantidadInicialHembras',
    'CantidadInicialTotal',
    'ProveedorPollitoID',
    'FacturaPollitoID',
    'EstadoLote',
    'LineaGenetica',
    'Observaciones',
    'CreadoPor',
    'FechaCreacion',
  ],
  LoteGalpones: [
    'LoteGalponID',
    'LoteID',
    'GalponID',
    'Sexo',
    'FechaInicio',
    'FechaFin',
    'DiaInicio',
    'DiaFin',
    'CantidadEntrada',
    'CantidadSalida',
    'Estado',
    'Observaciones',
  ],
  MovimientosEntreGalpones: [
    'MovimientoID',
    'Fecha',
    'LoteID',
    'GalponOrigenID',
    'GalponDestinoID',
    'Sexo',
    'CantidadMovida',
    'Motivo',
    'RegistradoPor',
    'FechaHoraRegistro',
    'Observaciones',
  ],
  RegistroDiarioLote: [
    'RegistroDiarioID',
    'Fecha',
    'LoteID',
    'DiaLote',
    'TipoAlimentoID',
    'BultosConsumidos',
    'KgConsumidos',
    'MuertosMachos',
    'MuertosHembras',
    'MuertosSinClasificar',
    'SacrificadosMachos',
    'SacrificadosHembras',
    'VendidosMachos',
    'VendidosHembras',
    'Observaciones',
    'RegistradoPor',
    'FechaHoraRegistro',
    'FechaHoraUltimaEdicion',
    'EditadoPor',
    'Bloqueado',
    'EstadoSync',
  ],
  Pesajes: [
    'PesajeID',
    'Fecha',
    'LoteID',
    'DiaLote',
    'SemanaLote',
    'CantidadMachosPesados',
    'CantidadHembrasPesadas',
    'PesoPromedioMachos',
    'PesoPromedioHembras',
    'PesoPromedioGeneral',
    'PesoMinimoMachos',
    'PesoMaximoMachos',
    'PesoMinimoHembras',
    'PesoMaximoHembras',
    'UniformidadMachos',
    'UniformidadHembras',
    'RegistradoPor',
    'FechaHoraRegistro',
    'EstadoSync',
  ],
  PesajeDetalle: ['PesajeDetalleID', 'PesajeID', 'LoteID', 'Sexo', 'NumeroAve', 'PesoGramos', 'FechaHoraRegistro', 'EstadoSync'],
  SalidasPollo: [
    'SalidaID',
    'Fecha',
    'LoteID',
    'TipoSalida',
    'Sexo',
    'CantidadAves',
    'PesoTotalKg',
    'PesoPromedioKg',
    'ClienteID',
    'PrecioKg',
    'ValorTotal',
    'FacturaVentaID',
    'EstadoAdministrativo',
    'RegistradoPor',
    'Observaciones',
    'EstadoSync',
  ],
  ActividadesProgramadas: [
    'ActividadProgramadaID',
    'NombreActividad',
    'Categoria',
    'TipoFrecuencia',
    'DiaLote',
    'HoraSugerida',
    'AplicaDesdeDia',
    'AplicaHastaDia',
    'RequiereDato',
    'RequiereFoto',
    'Activa',
  ],
  ActividadesLote: [
    'ActividadLoteID',
    'LoteID',
    'GalponID',
    'FechaProgramada',
    'DiaLote',
    'NombreActividad',
    'Categoria',
    'Estado',
    'FechaRealizada',
    'RealizadaPor',
    'Observacion',
    'CerradaComoPendiente',
    'EstadoSync',
  ],
  PlanVacunalBase: ['VacunaBaseID', 'NombreVacuna', 'DiaProgramado', 'ViaAplicacion', 'Activa'],
  VacunasLote: [
    'VacunaLoteID',
    'LoteID',
    'NombreVacuna',
    'DiaProgramado',
    'FechaProgramada',
    'Estado',
    'FechaAplicacion',
    'AplicadaPor',
    'Observacion',
    'EstadoSync',
  ],
  EntradasAlimento: [
    'EntradaAlimentoID',
    'Fecha',
    'TipoAlimentoID',
    'CantidadBultos',
    'KgPorBulto',
    'KgTotal',
    'ProveedorID',
    'FacturaID',
    'PrecioUnitario',
    'EstadoAdmin',
    'RegistradoPor',
    'Observaciones',
    'EstadoSync',
  ],
  ConsumoAlimentoLote: ['ConsumoID', 'Fecha', 'LoteID', 'TipoAlimentoID', 'BultosConsumidos', 'KgConsumidos', 'PorcentajeMañana', 'PorcentajeTarde', 'RegistradoPor', 'EstadoSync'],
  MaterialesLote: [
    'MaterialLoteID',
    'Fecha',
    'LoteID',
    'GalponID',
    'TipoMaterial',
    'Cantidad',
    'Unidad',
    'ProveedorID',
    'PrecioUnitario',
    'FacturaID',
    'EstadoAdmin',
    'RegistradoPor',
    'Observaciones',
    'EstadoSync',
  ],
  ControlesAgua: ['ControlAguaID', 'Fecha', 'LoteID', 'GalponID', 'PH', 'CloroLibrePPM', 'LugarMedicion', 'AccionTomada', 'Observacion', 'RegistradoPor', 'EstadoSync'],
  EventosSanitarios: ['EventoSanitarioID', 'Fecha', 'LoteID', 'GalponID', 'TipoEvento', 'Severidad', 'Descripcion', 'Fotos', 'RegistradoPor', 'Estado', 'EstadoSync'],
  TratamientosVeterinarios: [
    'TratamientoID',
    'FechaInicio',
    'FechaFin',
    'LoteID',
    'Producto',
    'Dosis',
    'ViaAplicacion',
    'Motivo',
    'VeterinarioResponsable',
    'PeriodoRetiroDias',
    'Estado',
    'Observaciones',
  ],
  RegistrosPlaga: ['RegistroPlagaID', 'Fecha', 'FechaHoraRegistro', 'TipoPlaga', 'GalponID', 'Producto', 'Dosificacion', 'EstacionesVeneno', 'EstacionesVenenoDetalle', 'Responsable', 'Foto', 'Observaciones', 'EstadoSync'],
  CompostajeCajones: ['CajonID', 'CodigoCajon', 'Estado', 'FechaInicio', 'FechaFinLlenado', 'FechaVolteo', 'FechaRetiro', 'AvesAcumuladas', 'Observaciones', 'EstadoSync'],
  CompostajeRegistros: ['RegistroCompostajeID', 'CajonID', 'Fecha', 'FechaHoraRegistro', 'LoteID', 'GalponID', 'RegistroDiarioID', 'MuertosMachos', 'MuertosHembras', 'MuertosSinClasificar', 'TotalAves', 'Fuente', 'RegistradoPor', 'Observaciones', 'EstadoSync'],
  Medicamentos: ['MedicamentoID', 'Fecha', 'FechaHoraRegistro', 'Estado', 'LoteID', 'GalponID', 'Producto', 'LoteProducto', 'FechaVencimiento', 'EdadDias', 'NumeroAnimalesTratados', 'Dosis', 'ViaAdministracion', 'Motivo', 'Responsable', 'PeriodoRetiroDias', 'Foto', 'Observaciones', 'EstadoSync'],
  Perros: ['PerroID', 'NombrePerro', 'Activo', 'FechaUltimaRabia', 'FechaUltimaDesparasitacion', 'FrecuenciaRabiaDias', 'FrecuenciaDesparasitacionDias', 'Observaciones', 'EstadoSync'],
  PerrosRegistros: ['PerroRegistroID', 'PerroID', 'Fecha', 'FechaHoraRegistro', 'NombrePerro', 'TipoRegistro', 'Producto', 'Laboratorio', 'LoteProducto', 'FechaVencimiento', 'Responsable', 'FirmaResponsable', 'Foto', 'Observaciones', 'EstadoSync'],
  Capacitaciones: ['CapacitacionID', 'Fecha', 'FechaHoraRegistro', 'Tema', 'Capacitador', 'FirmaCapacitador', 'Observaciones', 'RegistradoPor', 'EstadoSync'],
  CapacitacionAsistentes: ['AsistenteID', 'CapacitacionID', 'Nombre', 'Firma', 'EstadoSync'],
  Proveedores: ['ProveedorID', 'NombreProveedor', 'TipoProveedor', 'Telefono', 'NIT', 'Contacto', 'ProductoPrincipal', 'Activo', 'Observaciones'],
  Clientes: ['ClienteID', 'NombreCliente', 'Telefono', 'NIT', 'TipoCliente', 'Activo', 'Observaciones'],
  TiposAlimento: ['TipoAlimentoID', 'Nombre', 'EtapaRecomendadaDesdeDia', 'EtapaRecomendadaHastaDia', 'KgPorBulto', 'Activo'],
  FacturasCompra: ['FacturaCompraID', 'FechaFactura', 'ProveedorID', 'NumeroFactura', 'Categoria', 'Subtotal', 'IVA', 'Total', 'EstadoPago', 'ArchivoPDF', 'Observacion'],
  DetalleFacturasCompra: ['DetalleID', 'FacturaCompraID', 'LoteID', 'ProductoServicio', 'Cantidad', 'Unidad', 'ValorUnitario', 'ValorTotal'],
  FacturasVenta: ['FacturaVentaID', 'FechaFactura', 'ClienteID', 'NumeroFactura', 'Subtotal', 'IVA', 'Total', 'EstadoCobro', 'ArchivoPDF', 'Observacion'],
  DetalleFacturasVenta: ['DetalleVentaID', 'FacturaVentaID', 'LoteID', 'ProductoServicio', 'CantidadAves', 'Kg', 'PrecioKg', 'ValorTotal'],
  CostosLote: [
    'CostoID',
    'Fecha',
    'LoteID',
    'CategoriaCosto',
    'Concepto',
    'Cantidad',
    'Unidad',
    'ValorUnitario',
    'ValorTotal',
    'ProveedorID',
    'FacturaID',
    'Estado',
    'Observacion',
  ],
  InventarioAlimento: ['InventarioID', 'TipoAlimentoID', 'BultosDisponibles', 'KgDisponibles', 'UltimaActualizacion'],
  MovimientosInventarioAlimento: [
    'MovimientoInventarioID',
    'Fecha',
    'TipoMovimiento',
    'TipoAlimentoID',
    'CantidadBultos',
    'KgTotal',
    'LoteID',
    'ProveedorID',
    'FacturaID',
    'Origen',
    'Destino',
    'RegistradoPor',
    'Observacion',
  ],
  CurvasEstandar: [
    'CurvaID',
    'LineaGenetica',
    'Sexo',
    'DiaLote',
    'PesoEsperadoGr',
    'ConsumoDiarioEsperadoGrAve',
    'ConsumoAcumuladoEsperadoGrAve',
    'ConversionEsperada',
    'MortalidadMaximaAcumulada',
    'GananciaDiariaEsperada',
  ],
  CierresSemanales: [
    'CierreSemanalID',
    'LoteID',
    'SemanaLote',
    'FechaInicio',
    'FechaFin',
    'AvesInicialSemana',
    'AvesFinalSemana',
    'MuertosSemana',
    'MortalidadSemana',
    'MortalidadAcumulada',
    'ConsumoSemanaKg',
    'ConsumoAcumuladoKg',
    'PesoPromedioMacho',
    'PesoPromedioHembra',
    'PesoPromedioGeneral',
    'GananciaDiariaMacho',
    'GananciaDiariaHembra',
    'ConversionSemana',
    'ConversionAcumulada',
    'CostoSemana',
    'CostoAcumulado',
    'ActividadesNoRealizadas',
    'AlertasGeneradas',
    'EstadoCierre',
  ],
  CierreLote: [
    'CierreLoteID',
    'LoteID',
    'FechaCierre',
    'CantidadInicial',
    'CantidadVendida',
    'CantidadMuerta',
    'MortalidadFinal',
    'KgVendidos',
    'IngresoTotal',
    'CostoTotal',
    'UtilidadBruta',
    'CostoPorAveInicial',
    'CostoPorAveVendida',
    'CostoPorKg',
    'IngresoPorKg',
    'UtilidadPorKg',
    'Margen',
    'ConversionFinal',
    'PesoPromedioFinal',
    'EdadFinal',
    'EstadoCierre',
  ],
  Alertas: ['AlertaID', 'Fecha', 'LoteID', 'TipoAlerta', 'Nivel', 'Mensaje', 'Estado', 'Responsable', 'FechaResuelta', 'Observacion'],
  HistorialCambios: ['CambioID', 'Tabla', 'RegistroID', 'CampoEditado', 'ValorAnterior', 'ValorNuevo', 'EditadoPor', 'FechaHoraCambio', 'Motivo'],
  ReportesPDF: ['ReporteID', 'LoteID', 'FechaGeneracion', 'TipoReporte', 'URLArchivo', 'GeneradoPor'],
};

const SCHEMA_VERSION = 1;

const CONFIG = {
  SHEET_ID:
    PropertiesService.getScriptProperties().getProperty('POLLOS_SHEET_ID') ||
    SHEET_ID,
  API_TOKEN:
    PropertiesService.getScriptProperties().getProperty('POLLOS_API_TOKEN') ||
    '',
};

const ADMIN_ONLY_TABLES = [
  'Usuarios',
  'FacturasCompra',
  'DetalleFacturasCompra',
  'FacturasVenta',
  'DetalleFacturasVenta',
  'CostosLote',
  'CurvasEstandar',
  'CierresSemanales',
  'CierreLote',
  'HistorialCambios',
  'ReportesPDF',
];

const GALPONERO_WRITE_TABLES = [
  'Lotes',
  'LoteGalpones',
  'RegistroDiarioLote',
  'Pesajes',
  'PesajeDetalle',
  'SalidasPollo',
  'ActividadesLote',
  'VacunasLote',
  'EntradasAlimento',
  'ConsumoAlimentoLote',
  'MaterialesLote',
  'ControlesAgua',
  'EventosSanitarios',
  'RegistrosPlaga',
  'CompostajeCajones',
  'CompostajeRegistros',
  'Medicamentos',
  'Perros',
  'PerrosRegistros',
  'Capacitaciones',
  'CapacitacionAsistentes',
  'MovimientosInventarioAlimento',
];

const SENSITIVE_FIELDS_BY_TABLE = {
  SalidasPollo: ['PrecioKg', 'ValorTotal', 'FacturaVentaID'],
  EntradasAlimento: ['FacturaID', 'PrecioUnitario'],
  MaterialesLote: ['PrecioUnitario', 'FacturaID'],
  MovimientosInventarioAlimento: ['FacturaID'],
};

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    const action = String((e.parameter && e.parameter.action) || '').toLowerCase();
    if (!isAuthorizedRequest(e)) return fail('UNAUTHORIZED', 'Solicitud no autorizada.');
    ensureSheets();
    const getUser = readUserFromGet(e);

    if (method === 'GET' && action === 'health') return ok({ status: 'OK', schemaVersion: SCHEMA_VERSION });
    if (method === 'GET' && action === 'bootstrap') return ok(getBootstrap(getUser));
    if (method === 'GET' && action === 'lotes') return ok(readTableForRole('Lotes', getUser));
    if (method === 'GET' && action === 'dashboard') return ok(getDashboard(getUser));

    const body = method === 'POST' ? parseBody(e) : {};
    if (method === 'POST' && action === 'sync') return ok(syncItems(body));
    if (method === 'POST' && action === 'create') return ok(createItem(body));
    if (method === 'POST' && action === 'update') return ok(updateItem(body));
    if (method === 'POST' && action === 'generate-weekly-close') return ok(generateWeeklyClose(body));
    if (method === 'POST' && action === 'generate-lote-close') return ok(generateLoteClose(body));

    return fail('NOT_FOUND', 'Endpoint no encontrado.', { method, action });
  } catch (error) {
    return fail('SERVER_ERROR', errorMessage(error));
  }
}

function isAuthorizedRequest(e) {
  const expected = String(CONFIG.API_TOKEN || '');
  if (!expected) return true;

  const provided = String((e.parameter && (e.parameter.token || e.parameter.apiToken)) || '');
  return provided && provided === expected;
}

function parseBody(e) {
  if (!e.postData || !e.postData.contents) return {};
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error('JSON invalido en el cuerpo de la solicitud.');
  }
}

function readUserFromGet(e) {
  return {
    UsuarioID: String((e.parameter && e.parameter.userId) || ''),
    Rol: String((e.parameter && e.parameter.role) || 'GALPONERO').toUpperCase(),
  };
}

function ok(data, meta) {
  return json({
    ok: true,
    data: data === undefined ? null : data,
    error: null,
    meta: Object.assign(
      {
        schemaVersion: SCHEMA_VERSION,
        serverTime: new Date().toISOString(),
      },
      meta || {},
    ),
  });
}

function fail(code, message, details) {
  return json({
    ok: false,
    data: null,
    error: message,
    code,
    details: details || null,
    meta: {
      schemaVersion: SCHEMA_VERSION,
      serverTime: new Date().toISOString(),
    },
  });
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function ss() {
  if (!CONFIG.SHEET_ID || CONFIG.SHEET_ID === 'REEMPLAZAR_CON_ID_DE_GOOGLE_SHEETS') {
    throw new Error('Configura POLLOS_SHEET_ID en Script Properties o reemplaza SHEET_ID en Code.gs.');
  }
  return SpreadsheetApp.openById(CONFIG.SHEET_ID);
}

function ensureSheets() {
  const book = ss();
  Object.keys(TABLE_HEADERS).forEach((name) => {
    let sheet = book.getSheetByName(name);
    if (!sheet) sheet = book.insertSheet(name);
    const headers = TABLE_HEADERS[name];
    const lastColumn = Math.max(headers.length, sheet.getLastColumn() || 1);
    const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    if (!currentHeaders[0]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }

    const missingHeaders = headers.filter((header) => currentHeaders.indexOf(header) < 0);
    if (missingHeaders.length > 0) {
      sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    }
  });
}

function readTable(table) {
  const sheet = getSheet(table);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => rowToObject(headers, row));
}

function readTableForRole(table, user) {
  validateTable(table);
  const rows = readTable(table);
  return rows.map((record) => sanitizeRecordForRole(table, record, user));
}

function rowToObject(headers, row) {
  return headers.reduce((acc, header, index) => {
    acc[header] = serializeCell(row[index]);
    return acc;
  }, {});
}

function serializeCell(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return value.toISOString();
  return value;
}

function getSheet(table) {
  validateTable(table);
  return ss().getSheetByName(table);
}

function validateTable(table) {
  if (!TABLE_HEADERS[table]) throw new Error(`Tabla no permitida: ${table}`);
}

function getIdField(table) {
  return TABLE_HEADERS[table][0];
}

function validateRole(table, user, operation) {
  validateTable(table);
  const role = normalizeRole(user && user.Rol);
  if (!user || !user.UsuarioID || !role) throw new Error('Usuario y rol requeridos.');
  if (ADMIN_ONLY_TABLES.indexOf(table) >= 0 && role !== 'ADMIN') throw new Error('Operacion permitida solo para ADMIN.');
  if (role === 'GALPONERO' && GALPONERO_WRITE_TABLES.indexOf(table) < 0) {
    throw new Error(`GALPONERO no puede escribir en ${table}.`);
  }
}

function normalizeRole(role) {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'ADMIN' || normalized === 'GALPONERO') return normalized;
  return '';
}

function sanitizePayloadForRole(table, payload, user) {
  const role = normalizeRole(user && user.Rol);
  const safe = Object.assign({}, payload || {});
  if (role !== 'GALPONERO') return safe;

  const sensitiveFields = SENSITIVE_FIELDS_BY_TABLE[table] || [];
  sensitiveFields.forEach((field) => {
    const value = safe[field];
    const hasValue = value !== undefined && value !== null && value !== '' && Number(value) !== 0;
    if (hasValue) throw new Error(`GALPONERO no puede enviar el campo sensible ${field} en ${table}.`);
    safe[field] = '';
  });

  if ('EstadoSync' in safe) safe.EstadoSync = 'SINCRONIZADO';
  return safe;
}

function sanitizeRecordForRole(table, record, user) {
  const role = normalizeRole(user && user.Rol);
  const copy = Object.assign({}, record);
  if (role !== 'GALPONERO') return copy;

  if (ADMIN_ONLY_TABLES.indexOf(table) >= 0) return null;
  const sensitiveFields = SENSITIVE_FIELDS_BY_TABLE[table] || [];
  sensitiveFields.forEach((field) => {
    if (field in copy) copy[field] = '';
  });
  return copy;
}

function appendRecord(table, payload) {
  const sheet = getSheet(table);
  const headers = TABLE_HEADERS[table];
  const row = headers.map((header) => normalizeCellValue(payload[header]));
  sheet.appendRow(row);
  return payload[getIdField(table)];
}

function normalizeCellValue(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function findRecordRow(table, id) {
  const sheet = getSheet(table);
  const headers = getHeadersFromSheet(sheet, table);
  const idField = getIdField(table);
  const idIndex = headers.indexOf(idField);
  if (idIndex < 0) throw new Error(`La hoja ${table} no tiene columna ID ${idField}.`);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { rowIndex: -1, headers, values: [] };

  const values = sheet.getRange(1, 1, lastRow, headers.length).getValues();
  const rowIndex = values.findIndex((row, index) => index > 0 && String(row[idIndex]) === String(id));
  return { rowIndex, headers, values };
}

function getHeadersFromSheet(sheet, table) {
  const lastColumn = Math.max(sheet.getLastColumn(), TABLE_HEADERS[table].length);
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].filter((header) => header !== '');
}

function upsertRecord(table, payload, user) {
  validateRole(table, user, 'CREATE');
  const safePayload = sanitizePayloadForRole(table, payload, user);
  const idField = getIdField(table);
  const id = safePayload[idField];
  if (!id) throw new Error(`Falta ID ${idField} para insertar en ${table}.`);

  const found = findRecordRow(table, id);
  if (found.rowIndex > 0) {
    writeUpdateRecord(table, id, safePayload, user, { audit: false });
    return { id, action: 'UPDATED_EXISTING' };
  }

  appendRecord(table, safePayload);
  return { id, action: 'CREATED' };
}

function updateRecord(table, id, patch, user) {
  return writeUpdateRecord(table, id, patch, user, { audit: true });
}

function writeUpdateRecord(table, id, patch, user, options) {
  validateRole(table, user, 'UPDATE');
  const safePatch = sanitizePayloadForRole(table, patch, user);
  const sheet = getSheet(table);
  const headers = getHeadersFromSheet(sheet, table);
  const idField = getIdField(table);
  const found = findRecordRow(table, id);
  const rowIndex = found.rowIndex;
  const values = found.values;
  if (rowIndex < 1) throw new Error(`Registro no encontrado: ${id}`);

  const current = rowToObject(headers, values[rowIndex]);
  enforceGalponeroEditWindow(table, current, user);

  const next = Object.assign({}, current, safePatch);
  const newRow = headers.map((header) => normalizeCellValue(next[header]));
  sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([newRow]);

  if (options.audit && normalizeRole(user && user.Rol) === 'ADMIN' && table !== 'HistorialCambios') {
    Object.keys(safePatch).forEach((field) => {
      if (String(current[field]) !== String(safePatch[field])) {
        appendRecord('HistorialCambios', {
          CambioID: Utilities.getUuid(),
          Tabla: table,
          RegistroID: id,
          CampoEditado: field,
          ValorAnterior: current[field],
          ValorNuevo: safePatch[field],
          EditadoPor: user.UsuarioID || '',
          FechaHoraCambio: new Date().toISOString(),
          Motivo: 'Actualizacion administrativa',
        });
      }
    });
  }
  return id;
}

function enforceGalponeroEditWindow(table, current, user) {
  if (normalizeRole(user && user.Rol) !== 'GALPONERO') return;
  const createdBy = current.RegistradoPor || current.CreadoPor || current.RealizadaPor || current.AplicadaPor;
  if (createdBy && String(createdBy) !== String(user.UsuarioID)) {
    throw new Error('GALPONERO solo puede editar registros propios.');
  }

  const createdAt = current.FechaHoraRegistro || current.FechaCreacion || current.FechaRealizada || current.FechaAplicacion;
  if (!createdAt) return;
  const createdTime = new Date(createdAt).getTime();
  if (!createdTime) return;
  const minutes = (Date.now() - createdTime) / 60000;
  if (minutes > 60) throw new Error(`Registro bloqueado para GALPONERO despues de 60 minutos en ${table}.`);
}

function syncItems(body) {
  const user = body.user;
  const items = body.items || [];
  const syncedIds = [];
  const failedItems = [];
  const results = [];

  items.forEach((item) => {
    try {
      const table = item.Tabla;
      const operation = item.Operacion;
      if (operation === 'CREATE') upsertRecord(table, item.Payload, user);
      else if (operation === 'UPDATE') updateRecord(table, item.RegistroID, item.Payload, user);
      else throw new Error(`Operacion no soportada: ${operation}`);

      syncedIds.push(item.SyncID);
      results.push({ syncId: item.SyncID, recordId: item.RegistroID, table, ok: true });
    } catch (error) {
      failedItems.push({
        syncId: item.SyncID,
        recordId: item.RegistroID,
        table: item.Tabla,
        error: errorMessage(error),
      });
      results.push({ syncId: item.SyncID, recordId: item.RegistroID, table: item.Tabla, ok: false, error: errorMessage(error) });
    }
  });

  return { syncedIds, failedItems, results };
}

function createItem(body) {
  return upsertRecord(body.table, body.payload, body.user);
}

function updateItem(body) {
  const id = updateRecord(body.table, body.id, body.patch, body.user);
  return { id, action: 'UPDATED' };
}

function getBootstrap(user) {
  const role = normalizeRole(user && user.Rol) || 'GALPONERO';
  const tables = Object.keys(TABLE_HEADERS).reduce((acc, table) => {
    if (role === 'GALPONERO' && ADMIN_ONLY_TABLES.indexOf(table) >= 0) return acc;
    const rows = readTable(table)
      .map((record) => sanitizeRecordForRole(table, record, user))
      .filter((record) => record !== null);
    acc[table] = rows;
    return acc;
  }, {});

  return {
    tables,
    role,
    sheetId: CONFIG.SHEET_ID,
  };
}

function getDashboard(user) {
  return {
    lotes: readTableForRole('Lotes', user),
    registros: readTableForRole('RegistroDiarioLote', user),
    pesajes: readTableForRole('Pesajes', user),
    actividades: readTableForRole('ActividadesLote', user),
    vacunas: readTableForRole('VacunasLote', user),
    inventario: readTableForRole('InventarioAlimento', user),
    alertas: readTableForRole('Alertas', user),
  };
}

function generateWeeklyClose(body) {
  validateRole('CierresSemanales', body.user, 'CREATE');
  const cierre = Object.assign(
    {
      CierreSemanalID: Utilities.getUuid(),
      EstadoCierre: 'GENERADO',
    },
    body.payload || {},
  );
  upsertRecord('CierresSemanales', cierre, body.user);
  return cierre;
}

function generateLoteClose(body) {
  validateRole('CierreLote', body.user, 'CREATE');
  const cierre = Object.assign(
    {
      CierreLoteID: Utilities.getUuid(),
      EstadoCierre: 'GENERADO',
    },
    body.payload || {},
  );
  upsertRecord('CierreLote', cierre, body.user);
  return cierre;
}

function errorMessage(error) {
  return String(error && error.message ? error.message : error);
}
