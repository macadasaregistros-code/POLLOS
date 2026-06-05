alter table pollos.medicamentos
  add column if not exists "Estado" text not null default 'EN PROCESO',
  add column if not exists "LoteProducto" text not null default '',
  add column if not exists "FechaVencimiento" date,
  add column if not exists "EdadDias" integer not null default 0,
  add column if not exists "NumeroAnimalesTratados" integer not null default 0;

update pollos.medicamentos
set "Estado" = 'EN PROCESO'
where coalesce("Estado", '') = '';
