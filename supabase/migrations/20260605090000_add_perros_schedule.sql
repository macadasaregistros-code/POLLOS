create table if not exists pollos.perros (
  "PerroID" text primary key,
  "NombrePerro" text not null,
  "Activo" boolean not null default true,
  "FechaUltimaRabia" date,
  "FechaUltimaDesparasitacion" date,
  "FrecuenciaRabiaDias" integer not null default 365,
  "FrecuenciaDesparasitacionDias" integer not null default 90,
  "Observaciones" text not null default '',
  "EstadoSync" text not null default 'SINCRONIZADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table pollos.perros_registros
  add column if not exists "PerroID" text not null default '';

create index if not exists pollos_perros_activo_idx on pollos.perros ("Activo", "NombrePerro");
create index if not exists pollos_perros_registros_perro_idx on pollos.perros_registros ("PerroID", "Fecha");

do $$
declare
  table_name text;
  table_names text[] := array[
    'perros',
    'perros_registros'
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
