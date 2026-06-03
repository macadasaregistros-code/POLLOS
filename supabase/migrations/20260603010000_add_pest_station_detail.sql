alter table pollos.registros_plaga
  add column if not exists "EstacionesVenenoDetalle" text not null default '';

notify pgrst, 'reload schema';
