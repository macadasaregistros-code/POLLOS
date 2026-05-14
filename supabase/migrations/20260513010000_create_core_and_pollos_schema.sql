create extension if not exists pgcrypto;

create schema if not exists core;
create schema if not exists pollos;

create or replace function pollos.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core read-only views over MACADASA public tables.
-- These views keep POLLOS decoupled from the physical public table names.
-- ---------------------------------------------------------------------------

create or replace view core.usuarios as
select
  u.id::text as "UsuarioID",
  u.name as "Nombre",
  coalesce(u.email, '') as "Email",
  case
    when upper(coalesce(u.metadata->>'pollos_role', u.metadata->>'role', u.role, '')) in ('ADMIN', 'GALPONERO')
      then upper(coalesce(u.metadata->>'pollos_role', u.metadata->>'role', u.role))
    when coalesce(u.metadata->>'is_pollos_admin', 'false')::boolean then 'ADMIN'
    else 'GALPONERO'
  end as "Rol",
  u.is_active as "Activo",
  coalesce(nullif(u.metadata->>'PuedeEditarHastaMinutos', '')::integer, 60) as "PuedeEditarHastaMinutos"
from public.users u
where u.is_active;

create or replace view core.proveedores as
select
  t.id::text as "ProveedorID",
  t.name as "NombreProveedor",
  case
    when lower(coalesce(t.metadata->>'pollos_tipo_proveedor', '')) in ('pollito', 'alimento', 'cisco', 'gas', 'medicamento', 'vacuna', 'transporte', 'veterinario', 'otro')
      then upper(t.metadata->>'pollos_tipo_proveedor')
    when lower(t.name) like '%incub%' or lower(t.name) like '%pollito%' then 'POLLITO'
    when lower(t.name) like '%alimento%' or lower(t.name) like '%concentr%' then 'ALIMENTO'
    when lower(t.name) like '%gas%' then 'GAS'
    else 'OTRO'
  end as "TipoProveedor",
  coalesce(t.phone, '') as "Telefono",
  coalesce(t.tax_id, '') as "NIT",
  coalesce(t.metadata->>'contacto', '') as "Contacto",
  coalesce(t.metadata->>'producto_principal', '') as "ProductoPrincipal",
  t.is_active as "Activo",
  coalesce(t.metadata->>'observaciones', '') as "Observaciones"
from public.third_parties t
where t.is_active
  and (
    t.third_party_type = 'supplier'
    or exists (
      select 1
      from public.third_party_roles r
      where r.third_party_id = t.id
        and r.role = 'supplier'
        and r.is_active
    )
  );

create or replace view core.clientes as
select
  t.id::text as "ClienteID",
  t.name as "NombreCliente",
  coalesce(t.phone, '') as "Telefono",
  coalesce(t.tax_id, '') as "NIT",
  coalesce(t.metadata->>'tipo_cliente', 'GENERAL') as "TipoCliente",
  t.is_active as "Activo",
  coalesce(t.metadata->>'observaciones', '') as "Observaciones"
from public.third_parties t
where t.is_active
  and (
    t.third_party_type = 'customer'
    or exists (
      select 1
      from public.third_party_roles r
      where r.third_party_id = t.id
        and r.role = 'customer'
        and r.is_active
    )
  );

create or replace view core.alimentos as
select
  i.id::text as "TipoAlimentoID",
  i.name as "Nombre",
  coalesce(nullif(i.metadata->>'etapa_desde_dia', '')::integer, 1) as "EtapaRecomendadaDesdeDia",
  coalesce(nullif(i.metadata->>'etapa_hasta_dia', '')::integer, 60) as "EtapaRecomendadaHastaDia",
  coalesce(nullif(i.metadata->>'kg_por_bulto', '')::numeric, 40) as "KgPorBulto",
  i.is_active as "Activo"
from public.items i
where i.is_active
  and i.item_type = 'feed';

create or replace view core.facturas_compra as
select
  d.id::text as "FacturaCompraID",
  d.issue_date::text as "FechaFactura",
  coalesce(d.third_party_id::text, '') as "ProveedorID",
  coalesce(d.document_number, '') as "NumeroFactura",
  coalesce(d.document_subtype, d.document_type, '') as "Categoria",
  greatest(d.total_amount - coalesce(d.metadata->>'tax_amount', '0')::numeric, 0) as "Subtotal",
  coalesce(d.metadata->>'tax_amount', '0')::numeric as "IVA",
  d.total_amount as "Total",
  case when d.status = 'paid' then 'PAGADA' when d.status = 'void' then 'ANULADA' else 'PENDIENTE' end as "EstadoPago",
  coalesce(d.metadata->>'archivo_pdf', '') as "ArchivoPDF",
  coalesce(d.metadata->>'observacion', '') as "Observacion"
from public.financial_documents d
where d.direction = 'payable';

create or replace view core.facturas_venta as
select
  d.id::text as "FacturaVentaID",
  d.issue_date::text as "FechaFactura",
  coalesce(d.third_party_id::text, '') as "ClienteID",
  coalesce(d.document_number, '') as "NumeroFactura",
  greatest(d.total_amount - coalesce(d.metadata->>'tax_amount', '0')::numeric, 0) as "Subtotal",
  coalesce(d.metadata->>'tax_amount', '0')::numeric as "IVA",
  d.total_amount as "Total",
  case when d.status = 'paid' then 'PAGADO' when d.status = 'void' then 'ANULADO' else 'PENDIENTE' end as "EstadoCobro",
  coalesce(d.metadata->>'archivo_pdf', '') as "ArchivoPDF",
  coalesce(d.metadata->>'observacion', '') as "Observacion"
from public.financial_documents d
where d.direction = 'receivable';

create or replace view core.facturas as
select
  d.id::text as "FacturaID",
  d.direction as "Direccion",
  d.document_type as "TipoDocumento",
  coalesce(d.document_number, '') as "NumeroFactura",
  d.issue_date::text as "FechaFactura",
  coalesce(d.third_party_id::text, '') as "TerceroID",
  d.total_amount as "Total",
  d.status as "Estado"
from public.financial_documents d;

-- ---------------------------------------------------------------------------
-- POLLOS operational tables.
-- Column names intentionally match the existing app payload to keep offline
-- sync simple while the app is migrated away from Google Sheets.
-- ---------------------------------------------------------------------------

create table if not exists pollos.galpones (
  "GalponID" text primary key,
  "NombreGalpon" text not null,
  "Capacidad" integer not null default 0,
  "EstadoActual" text not null default 'VACIO',
  "Observaciones" text not null default '',
  "Activo" boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.lotes (
  "LoteID" text primary key,
  "CodigoLote" text not null unique,
  "FechaLlegada" date not null,
  "CantidadInicialMachos" integer not null default 0,
  "CantidadInicialHembras" integer not null default 0,
  "CantidadInicialTotal" integer not null default 0,
  "ProveedorPollitoID" text not null default '',
  "FacturaPollitoID" text not null default '',
  "EstadoLote" text not null default 'ACTIVO',
  "LineaGenetica" text not null default '',
  "Observaciones" text not null default '',
  "CreadoPor" text not null default '',
  "FechaCreacion" timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.lote_galpones (
  "LoteGalponID" text primary key,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "GalponID" text not null references pollos.galpones("GalponID") on delete restrict,
  "Sexo" text not null default 'MIXTO',
  "FechaInicio" date not null,
  "FechaFin" date,
  "DiaInicio" integer not null default 1,
  "DiaFin" integer not null default 0,
  "CantidadEntrada" integer not null default 0,
  "CantidadSalida" integer not null default 0,
  "Estado" text not null default 'ACTIVO',
  "Observaciones" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.movimientos_entre_galpones (
  "MovimientoID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "GalponOrigenID" text not null,
  "GalponDestinoID" text not null,
  "Sexo" text not null,
  "CantidadMovida" integer not null default 0,
  "Motivo" text not null default '',
  "RegistradoPor" text not null default '',
  "FechaHoraRegistro" timestamptz not null default now(),
  "Observaciones" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.registro_diario_lote (
  "RegistroDiarioID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "DiaLote" integer not null,
  "TipoAlimentoID" text not null default '',
  "BultosConsumidos" numeric(12, 2) not null default 0,
  "KgConsumidos" numeric(12, 2) not null default 0,
  "MuertosMachos" integer not null default 0,
  "MuertosHembras" integer not null default 0,
  "MuertosSinClasificar" integer not null default 0,
  "SacrificadosMachos" integer not null default 0,
  "SacrificadosHembras" integer not null default 0,
  "VendidosMachos" integer not null default 0,
  "VendidosHembras" integer not null default 0,
  "Observaciones" text not null default '',
  "RegistradoPor" text not null default '',
  "FechaHoraRegistro" timestamptz not null default now(),
  "FechaHoraUltimaEdicion" timestamptz,
  "EditadoPor" text not null default '',
  "Bloqueado" boolean not null default false,
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.pesajes (
  "PesajeID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "DiaLote" integer not null,
  "SemanaLote" integer not null,
  "CantidadMachosPesados" integer not null default 0,
  "CantidadHembrasPesadas" integer not null default 0,
  "PesoPromedioMachos" numeric(12, 4) not null default 0,
  "PesoPromedioHembras" numeric(12, 4) not null default 0,
  "PesoPromedioGeneral" numeric(12, 4) not null default 0,
  "PesoMinimoMachos" numeric(12, 4) not null default 0,
  "PesoMaximoMachos" numeric(12, 4) not null default 0,
  "PesoMinimoHembras" numeric(12, 4) not null default 0,
  "PesoMaximoHembras" numeric(12, 4) not null default 0,
  "UniformidadMachos" numeric(8, 4) not null default 0,
  "UniformidadHembras" numeric(8, 4) not null default 0,
  "RegistradoPor" text not null default '',
  "FechaHoraRegistro" timestamptz not null default now(),
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.pesaje_detalle (
  "PesajeDetalleID" text primary key,
  "PesajeID" text not null references pollos.pesajes("PesajeID") on delete cascade,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "Sexo" text not null,
  "NumeroAve" integer not null,
  "PesoGramos" numeric(12, 4) not null,
  "FechaHoraRegistro" timestamptz not null default now(),
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.salidas_pollo (
  "SalidaID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "TipoSalida" text not null,
  "Sexo" text not null default 'MIXTO',
  "CantidadAves" integer not null default 0,
  "PesoTotalKg" numeric(12, 2) not null default 0,
  "PesoPromedioKg" numeric(12, 4) not null default 0,
  "ClienteID" text not null default '',
  "PrecioKg" numeric(14, 2) not null default 0,
  "ValorTotal" numeric(14, 2) not null default 0,
  "FacturaVentaID" text not null default '',
  "EstadoAdministrativo" text not null default 'PENDIENTE_PRECIO',
  "RegistradoPor" text not null default '',
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.actividades_programadas (
  "ActividadProgramadaID" text primary key,
  "NombreActividad" text not null,
  "Categoria" text not null default '',
  "TipoFrecuencia" text not null,
  "DiaLote" integer not null default 0,
  "HoraSugerida" text not null default '',
  "AplicaDesdeDia" integer not null default 1,
  "AplicaHastaDia" integer not null default 60,
  "RequiereDato" boolean not null default false,
  "RequiereFoto" boolean not null default false,
  "Activa" boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.actividades_lote (
  "ActividadLoteID" text primary key,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "GalponID" text not null default '',
  "FechaProgramada" date not null,
  "DiaLote" integer not null,
  "NombreActividad" text not null,
  "Categoria" text not null default '',
  "Estado" text not null default 'PENDIENTE',
  "FechaRealizada" timestamptz,
  "RealizadaPor" text not null default '',
  "Observacion" text not null default '',
  "CerradaComoPendiente" boolean not null default false,
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.plan_vacunal_base (
  "VacunaBaseID" text primary key,
  "NombreVacuna" text not null,
  "DiaProgramado" integer not null,
  "ViaAplicacion" text not null default '',
  "Activa" boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.vacunas_lote (
  "VacunaLoteID" text primary key,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "NombreVacuna" text not null,
  "DiaProgramado" integer not null,
  "FechaProgramada" date not null,
  "Estado" text not null default 'PENDIENTE',
  "FechaAplicacion" timestamptz,
  "AplicadaPor" text not null default '',
  "Observacion" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.entradas_alimento (
  "EntradaAlimentoID" text primary key,
  "Fecha" date not null,
  "TipoAlimentoID" text not null default '',
  "CantidadBultos" numeric(12, 2) not null default 0,
  "KgPorBulto" numeric(12, 2) not null default 0,
  "KgTotal" numeric(12, 2) not null default 0,
  "ProveedorID" text not null default '',
  "FacturaID" text not null default '',
  "PrecioUnitario" numeric(14, 2) not null default 0,
  "EstadoAdmin" text not null default 'PENDIENTE_FACTURA',
  "RegistradoPor" text not null default '',
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.consumo_alimento_lote (
  "ConsumoID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "TipoAlimentoID" text not null default '',
  "BultosConsumidos" numeric(12, 2) not null default 0,
  "KgConsumidos" numeric(12, 2) not null default 0,
  "PorcentajeMaÃ±ana" numeric(7, 2) not null default 0,
  "PorcentajeTarde" numeric(7, 2) not null default 0,
  "RegistradoPor" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.materiales_lote (
  "MaterialLoteID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "GalponID" text not null default '',
  "TipoMaterial" text not null,
  "Cantidad" numeric(12, 2) not null default 0,
  "Unidad" text not null default '',
  "ProveedorID" text not null default '',
  "PrecioUnitario" numeric(14, 2) not null default 0,
  "FacturaID" text not null default '',
  "EstadoAdmin" text not null default 'PENDIENTE_PRECIO',
  "RegistradoPor" text not null default '',
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.controles_agua (
  "ControlAguaID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "GalponID" text not null default '',
  "PH" numeric(6, 2) not null default 0,
  "CloroLibrePPM" numeric(8, 3) not null default 0,
  "LugarMedicion" text not null default '',
  "AccionTomada" text not null default '',
  "Observacion" text not null default '',
  "RegistradoPor" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.eventos_sanitarios (
  "EventoSanitarioID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "GalponID" text not null default '',
  "TipoEvento" text not null,
  "Severidad" text not null,
  "Descripcion" text not null default '',
  "Fotos" text not null default '',
  "RegistradoPor" text not null default '',
  "Estado" text not null default 'ABIERTO',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.tratamientos_veterinarios (
  "TratamientoID" text primary key,
  "FechaInicio" date not null,
  "FechaFin" date,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "Producto" text not null default '',
  "Dosis" text not null default '',
  "ViaAplicacion" text not null default '',
  "Motivo" text not null default '',
  "VeterinarioResponsable" text not null default '',
  "PeriodoRetiroDias" integer not null default 0,
  "Estado" text not null default 'ACTIVO',
  "Observaciones" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.costos_lote (
  "CostoID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "CategoriaCosto" text not null,
  "Concepto" text not null default '',
  "Cantidad" numeric(12, 2) not null default 0,
  "Unidad" text not null default '',
  "ValorUnitario" numeric(14, 2) not null default 0,
  "ValorTotal" numeric(14, 2) not null default 0,
  "ProveedorID" text not null default '',
  "FacturaID" text not null default '',
  "Estado" text not null default 'PENDIENTE_FACTURA',
  "Observacion" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.inventario_alimento (
  "InventarioID" text primary key,
  "TipoAlimentoID" text not null default '',
  "BultosDisponibles" numeric(12, 2) not null default 0,
  "KgDisponibles" numeric(12, 2) not null default 0,
  "UltimaActualizacion" timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.movimientos_inventario_alimento (
  "MovimientoInventarioID" text primary key,
  "Fecha" date not null,
  "TipoMovimiento" text not null,
  "TipoAlimentoID" text not null default '',
  "CantidadBultos" numeric(12, 2) not null default 0,
  "KgTotal" numeric(12, 2) not null default 0,
  "LoteID" text not null default '',
  "ProveedorID" text not null default '',
  "FacturaID" text not null default '',
  "Origen" text not null default '',
  "Destino" text not null default '',
  "RegistradoPor" text not null default '',
  "Observacion" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.curvas_estandar (
  "CurvaID" text primary key,
  "LineaGenetica" text not null default '',
  "Sexo" text not null,
  "DiaLote" integer not null,
  "PesoEsperadoGr" numeric(12, 4) not null default 0,
  "ConsumoDiarioEsperadoGrAve" numeric(12, 4) not null default 0,
  "ConsumoAcumuladoEsperadoGrAve" numeric(12, 4) not null default 0,
  "ConversionEsperada" numeric(12, 4) not null default 0,
  "MortalidadMaximaAcumulada" numeric(8, 4) not null default 0,
  "GananciaDiariaEsperada" numeric(12, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.cierres_semanales (
  "CierreSemanalID" text primary key,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "SemanaLote" integer not null,
  "FechaInicio" date not null,
  "FechaFin" date not null,
  "AvesInicialSemana" integer not null default 0,
  "AvesFinalSemana" integer not null default 0,
  "MuertosSemana" integer not null default 0,
  "MortalidadSemana" numeric(8, 4) not null default 0,
  "MortalidadAcumulada" numeric(8, 4) not null default 0,
  "ConsumoSemanaKg" numeric(12, 2) not null default 0,
  "ConsumoAcumuladoKg" numeric(12, 2) not null default 0,
  "PesoPromedioMacho" numeric(12, 4) not null default 0,
  "PesoPromedioHembra" numeric(12, 4) not null default 0,
  "PesoPromedioGeneral" numeric(12, 4) not null default 0,
  "GananciaDiariaMacho" numeric(12, 4) not null default 0,
  "GananciaDiariaHembra" numeric(12, 4) not null default 0,
  "ConversionSemana" numeric(12, 4) not null default 0,
  "ConversionAcumulada" numeric(12, 4) not null default 0,
  "CostoSemana" numeric(14, 2) not null default 0,
  "CostoAcumulado" numeric(14, 2) not null default 0,
  "ActividadesNoRealizadas" integer not null default 0,
  "AlertasGeneradas" integer not null default 0,
  "EstadoCierre" text not null default 'GENERADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.cierre_lote (
  "CierreLoteID" text primary key,
  "LoteID" text not null references pollos.lotes("LoteID") on delete cascade,
  "FechaCierre" date not null,
  "CantidadInicial" integer not null default 0,
  "CantidadVendida" integer not null default 0,
  "CantidadMuerta" integer not null default 0,
  "MortalidadFinal" numeric(8, 4) not null default 0,
  "KgVendidos" numeric(12, 2) not null default 0,
  "IngresoTotal" numeric(14, 2) not null default 0,
  "CostoTotal" numeric(14, 2) not null default 0,
  "UtilidadBruta" numeric(14, 2) not null default 0,
  "CostoPorAveInicial" numeric(14, 4) not null default 0,
  "CostoPorAveVendida" numeric(14, 4) not null default 0,
  "CostoPorKg" numeric(14, 4) not null default 0,
  "IngresoPorKg" numeric(14, 4) not null default 0,
  "UtilidadPorKg" numeric(14, 4) not null default 0,
  "Margen" numeric(8, 4) not null default 0,
  "ConversionFinal" numeric(12, 4) not null default 0,
  "PesoPromedioFinal" numeric(12, 4) not null default 0,
  "EdadFinal" integer not null default 0,
  "EstadoCierre" text not null default 'GENERADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.alertas (
  "AlertaID" text primary key,
  "Fecha" date not null,
  "LoteID" text not null default '',
  "TipoAlerta" text not null default '',
  "Nivel" text not null default 'INFORMATIVA',
  "Mensaje" text not null default '',
  "Estado" text not null default 'ABIERTA',
  "Responsable" text not null default '',
  "FechaResuelta" timestamptz,
  "Observacion" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.historial_cambios (
  "CambioID" text primary key,
  "Tabla" text not null,
  "RegistroID" text not null,
  "CampoEditado" text not null,
  "ValorAnterior" text not null default '',
  "ValorNuevo" text not null default '',
  "EditadoPor" text not null default '',
  "FechaHoraCambio" timestamptz not null default now(),
  "Motivo" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.reportes_pdf (
  "ReporteID" text primary key,
  "LoteID" text not null default '',
  "FechaGeneracion" timestamptz not null default now(),
  "TipoReporte" text not null,
  "URLArchivo" text not null default '',
  "GeneradoPor" text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pollos_lotes_estado_idx on pollos.lotes ("EstadoLote");
create index if not exists pollos_lote_galpones_lote_idx on pollos.lote_galpones ("LoteID");
create index if not exists pollos_registro_diario_lote_idx on pollos.registro_diario_lote ("LoteID", "Fecha");
create index if not exists pollos_pesajes_lote_idx on pollos.pesajes ("LoteID", "Fecha");
create index if not exists pollos_actividades_lote_idx on pollos.actividades_lote ("LoteID", "FechaProgramada");
create index if not exists pollos_vacunas_lote_idx on pollos.vacunas_lote ("LoteID", "FechaProgramada");
create index if not exists pollos_salidas_lote_idx on pollos.salidas_pollo ("LoteID", "Fecha");

do $$
declare
  table_name text;
  table_names text[] := array[
    'galpones',
    'lotes',
    'lote_galpones',
    'movimientos_entre_galpones',
    'registro_diario_lote',
    'pesajes',
    'pesaje_detalle',
    'salidas_pollo',
    'actividades_programadas',
    'actividades_lote',
    'plan_vacunal_base',
    'vacunas_lote',
    'entradas_alimento',
    'consumo_alimento_lote',
    'materiales_lote',
    'controles_agua',
    'eventos_sanitarios',
    'tratamientos_veterinarios',
    'costos_lote',
    'inventario_alimento',
    'movimientos_inventario_alimento',
    'curvas_estandar',
    'cierres_semanales',
    'cierre_lote',
    'alertas',
    'historial_cambios',
    'reportes_pdf'
  ];
begin
  foreach table_name in array table_names loop
    execute format('drop trigger if exists set_%I_updated_at on pollos.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on pollos.%I for each row execute function pollos.set_updated_at()', table_name, table_name);

    execute format('alter table pollos.%I enable row level security', table_name);

    execute format('drop policy if exists pollos_authenticated_select on pollos.%I', table_name);
    execute format('drop policy if exists pollos_authenticated_insert on pollos.%I', table_name);
    execute format('drop policy if exists pollos_authenticated_update on pollos.%I', table_name);
    execute format('drop policy if exists pollos_authenticated_delete on pollos.%I', table_name);

    execute format('create policy pollos_authenticated_select on pollos.%I for select to authenticated using (true)', table_name);
    execute format('create policy pollos_authenticated_insert on pollos.%I for insert to authenticated with check (true)', table_name);
    execute format('create policy pollos_authenticated_update on pollos.%I for update to authenticated using (true) with check (true)', table_name);
    execute format('create policy pollos_authenticated_delete on pollos.%I for delete to authenticated using (true)', table_name);
  end loop;
end;
$$;

grant usage on schema core to authenticated;
grant usage on schema pollos to authenticated;
grant usage on schema core to service_role;
grant usage on schema pollos to service_role;
grant select on all tables in schema core to authenticated;
grant select, insert, update, delete on all tables in schema pollos to authenticated;
grant select on all tables in schema core to service_role;
grant select, insert, update, delete on all tables in schema pollos to service_role;

alter default privileges in schema core grant select on tables to authenticated;
alter default privileges in schema pollos grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema core grant select on tables to service_role;
alter default privileges in schema pollos grant select, insert, update, delete on tables to service_role;

alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,core,pollos';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
