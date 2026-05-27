-- Adds the Galponero operational records introduced in the native mobile flow.
-- The app keeps column names aligned with the local IndexedDB payloads.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'pollos'
      and table_name = 'consumo_alimento_lote'
      and column_name = U&'PorcentajeMa\00C3\00B1ana'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'pollos'
      and table_name = 'consumo_alimento_lote'
      and column_name = U&'PorcentajeMa\00F1ana'
  ) then
    alter table pollos.consumo_alimento_lote
      rename column U&"PorcentajeMa\00C3\00B1ana" to U&"PorcentajeMa\00F1ana";
  end if;
end;
$$;

alter table pollos.consumo_alimento_lote
  add column if not exists U&"PorcentajeMa\00F1ana" numeric(7, 2) not null default 0;

alter table pollos.vacunas_lote
  add column if not exists "GalponID" text not null default '',
  add column if not exists "Producto" text not null default '',
  add column if not exists "Laboratorio" text not null default '',
  add column if not exists "LoteProducto" text not null default '',
  add column if not exists "FechaVencimientoProducto" date,
  add column if not exists "ViaAdministracion" text not null default '',
  add column if not exists "Cepa" text not null default '',
  add column if not exists "Enfermedad" text not null default '',
  add column if not exists "NumeroAves" integer not null default 0,
  add column if not exists "EdadDias" integer not null default 0,
  add column if not exists "Responsable" text not null default '',
  add column if not exists "FirmaResponsable" text not null default '',
  add column if not exists "Foto" text not null default '';

update pollos.vacunas_lote
set
  "Producto" = case when "Producto" = '' then "NombreVacuna" else "Producto" end,
  "ViaAdministracion" = case when "ViaAdministracion" = '' then 'Agua de bebida' else "ViaAdministracion" end,
  "Enfermedad" = case when "Enfermedad" = '' then "NombreVacuna" else "Enfermedad" end,
  "EdadDias" = case when "EdadDias" = 0 then "DiaProgramado" else "EdadDias" end;

alter table pollos.controles_agua
  add column if not exists "FechaHoraRegistro" timestamptz not null default now(),
  add column if not exists "DosificacionCloroGr" numeric(12, 2) not null default 0,
  add column if not exists "VerificacionPH" numeric(6, 2) not null default 0,
  add column if not exists "VerificacionCloro" numeric(8, 3) not null default 0,
  add column if not exists "Foto" text not null default '';

create table if not exists pollos.entradas_material (
  "EntradaMaterialID" text primary key,
  "Fecha" date not null,
  "FechaHoraRegistro" timestamptz not null default now(),
  "TipoMaterial" text not null,
  "Cantidad" numeric(12, 2) not null default 0,
  "Unidad" text not null default '',
  "ProveedorID" text not null default '',
  "FacturaID" text not null default '',
  "PrecioUnitario" numeric(14, 2) not null default 0,
  "EstadoAdmin" text not null default 'PENDIENTE_PROVEEDOR',
  "RegistradoPor" text not null default '',
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.inventario_material (
  "InventarioMaterialID" text primary key,
  "TipoMaterial" text not null unique,
  "CantidadDisponible" numeric(12, 2) not null default 0,
  "Unidad" text not null default '',
  "UltimaActualizacion" timestamptz not null default now(),
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.movimientos_inventario_material (
  "MovimientoMaterialID" text primary key,
  "Fecha" date not null,
  "TipoMovimiento" text not null,
  "TipoMaterial" text not null,
  "Cantidad" numeric(12, 2) not null default 0,
  "Unidad" text not null default '',
  "LoteID" text not null default '',
  "GalponID" text not null default '',
  "ProveedorID" text not null default '',
  "FacturaID" text not null default '',
  "Origen" text not null default '',
  "Destino" text not null default '',
  "RegistradoPor" text not null default '',
  "Observacion" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.registros_plaga (
  "RegistroPlagaID" text primary key,
  "Fecha" date not null,
  "FechaHoraRegistro" timestamptz not null default now(),
  "TipoPlaga" text not null,
  "GalponID" text not null default '',
  "Producto" text not null default '',
  "Dosificacion" text not null default '',
  "EstacionesVeneno" integer not null default 0,
  "Responsable" text not null default '',
  "Foto" text not null default '',
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.compostaje_cajones (
  "CajonID" text primary key,
  "CodigoCajon" text not null,
  "Estado" text not null default 'ACTIVO',
  "FechaInicio" date not null,
  "FechaFinLlenado" date not null,
  "FechaVolteo" date not null,
  "FechaRetiro" date not null,
  "AvesAcumuladas" integer not null default 0,
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.compostaje_registros (
  "RegistroCompostajeID" text primary key,
  "CajonID" text not null references pollos.compostaje_cajones("CajonID") on delete cascade,
  "Fecha" date not null,
  "FechaHoraRegistro" timestamptz not null default now(),
  "LoteID" text not null default '',
  "GalponID" text not null default '',
  "RegistroDiarioID" text not null default '',
  "MuertosMachos" integer not null default 0,
  "MuertosHembras" integer not null default 0,
  "MuertosSinClasificar" integer not null default 0,
  "TotalAves" integer not null default 0,
  "Fuente" text not null default 'MORTALIDAD_DIARIA',
  "RegistradoPor" text not null default '',
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.medicamentos (
  "MedicamentoID" text primary key,
  "Fecha" date not null,
  "FechaHoraRegistro" timestamptz not null default now(),
  "LoteID" text not null default '',
  "GalponID" text not null default '',
  "Producto" text not null default '',
  "Dosis" text not null default '',
  "ViaAdministracion" text not null default '',
  "Motivo" text not null default '',
  "Responsable" text not null default '',
  "PeriodoRetiroDias" integer not null default 0,
  "Foto" text not null default '',
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.perros_registros (
  "PerroRegistroID" text primary key,
  "Fecha" date not null,
  "FechaHoraRegistro" timestamptz not null default now(),
  "NombrePerro" text not null default '',
  "TipoRegistro" text not null,
  "Producto" text not null default '',
  "Laboratorio" text not null default '',
  "LoteProducto" text not null default '',
  "FechaVencimiento" date,
  "Responsable" text not null default '',
  "FirmaResponsable" text not null default '',
  "Foto" text not null default '',
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.capacitaciones (
  "CapacitacionID" text primary key,
  "Fecha" date not null,
  "FechaHoraRegistro" timestamptz not null default now(),
  "Tema" text not null default '',
  "Capacitador" text not null default '',
  "FirmaCapacitador" text not null default '',
  "Observaciones" text not null default '',
  "RegistradoPor" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pollos.capacitacion_asistentes (
  "AsistenteID" text primary key,
  "CapacitacionID" text not null references pollos.capacitaciones("CapacitacionID") on delete cascade,
  "Nombre" text not null default '',
  "Firma" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pollos_entradas_material_tipo_idx on pollos.entradas_material ("TipoMaterial", "Fecha");
create index if not exists pollos_movimientos_material_tipo_idx on pollos.movimientos_inventario_material ("TipoMaterial", "Fecha");
create index if not exists pollos_registros_plaga_tipo_idx on pollos.registros_plaga ("TipoPlaga", "Fecha");
create index if not exists pollos_compostaje_registros_cajon_idx on pollos.compostaje_registros ("CajonID", "Fecha");
create index if not exists pollos_medicamentos_lote_idx on pollos.medicamentos ("LoteID", "Fecha");
create index if not exists pollos_perros_fecha_idx on pollos.perros_registros ("NombrePerro", "Fecha");
create index if not exists pollos_capacitacion_asistentes_idx on pollos.capacitacion_asistentes ("CapacitacionID");

do $$
declare
  table_name text;
  table_names text[] := array[
    'entradas_material',
    'inventario_material',
    'movimientos_inventario_material',
    'registros_plaga',
    'compostaje_cajones',
    'compostaje_registros',
    'medicamentos',
    'perros_registros',
    'capacitaciones',
    'capacitacion_asistentes'
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

grant select, insert, update, delete on all tables in schema pollos to authenticated;
grant select, insert, update, delete on all tables in schema pollos to service_role;

notify pgrst, 'reload schema';
