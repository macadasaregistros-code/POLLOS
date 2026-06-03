-- Adds the explicit fields used by the visual water treatment form.
-- Existing columns remain as the canonical operational values; these fields
-- make the UI/audit state available without losing the Spanish legacy fields.

alter table pollos.controles_agua
  add column if not exists "fechaRegistro" date,
  add column if not exists "estado" text not null default 'EN PROCESO',
  add column if not exists "phSeleccionado" numeric(6, 2) not null default 0,
  add column if not exists "phCorrecto" boolean not null default false,
  add column if not exists "cloroAdicionadoGramos" numeric(12, 2) not null default 0,
  add column if not exists "cloroResidualSeleccionado" numeric(8, 3) not null default 0,
  add column if not exists "cloroCorrecto" boolean not null default false;

update pollos.controles_agua
set
  "fechaRegistro" = coalesce("fechaRegistro", "Fecha"),
  "phSeleccionado" = case when "phSeleccionado" = 0 then coalesce("VerificacionPH", "PH", 0) else "phSeleccionado" end,
  "cloroAdicionadoGramos" = case when "cloroAdicionadoGramos" = 0 then coalesce("DosificacionCloroGr", 0) else "cloroAdicionadoGramos" end,
  "cloroResidualSeleccionado" = case when "cloroResidualSeleccionado" = 0 then coalesce("VerificacionCloro", "CloroLibrePPM", 0) else "cloroResidualSeleccionado" end,
  "phCorrecto" = coalesce("phCorrecto", false) or coalesce("VerificacionPH", "PH", 0) in (6, 6.8),
  "cloroCorrecto" = coalesce("cloroCorrecto", false) or coalesce("VerificacionCloro", "CloroLibrePPM", 0) = 3;

alter table pollos.controles_agua
  alter column "fechaRegistro" set default current_date;

notify pgrst, 'reload schema';
