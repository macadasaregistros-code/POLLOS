-- Rutinas generales de granja are stored in actividades_lote without a lote.
-- Real lote activities still keep the existing FK when LoteID is present.
alter table pollos.actividades_lote
  alter column "LoteID" drop not null;

