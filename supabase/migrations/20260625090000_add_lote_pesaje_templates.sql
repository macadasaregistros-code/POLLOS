insert into pollos.actividades_programadas (
  "ActividadProgramadaID",
  "NombreActividad",
  "Categoria",
  "TipoFrecuencia",
  "DiaLote",
  "HoraSugerida",
  "AplicaDesdeDia",
  "AplicaHastaDia",
  "DiasSemana",
  "OrdenProgramacion",
  "RequiereDato",
  "RequiereFoto",
  "Activa"
)
values
  ('act_lote_pesaje_dia_8', 'Pesaje dia 8.', 'Pesaje', 'SEGUN_DIA_LOTE', 8, '', 8, 8, '{}'::integer[], 8, false, false, true),
  ('act_lote_pesaje_dia_15', 'Pesaje dia 15.', 'Pesaje', 'SEGUN_DIA_LOTE', 15, '', 15, 15, '{}'::integer[], 15, false, false, true),
  ('act_lote_pesaje_dia_22', 'Pesaje dia 22.', 'Pesaje', 'SEGUN_DIA_LOTE', 22, '', 22, 22, '{}'::integer[], 22, false, false, true),
  ('act_lote_pesaje_dia_29', 'Pesaje dia 29.', 'Pesaje', 'SEGUN_DIA_LOTE', 29, '', 29, 29, '{}'::integer[], 29, false, false, true),
  ('act_lote_pesaje_dia_36', 'Pesaje dia 36.', 'Pesaje', 'SEGUN_DIA_LOTE', 36, '', 36, 36, '{}'::integer[], 36, false, false, true),
  ('act_lote_pesaje_dia_43', 'Pesaje dia 43.', 'Pesaje', 'SEGUN_DIA_LOTE', 43, '', 43, 43, '{}'::integer[], 43, false, false, true)
on conflict ("ActividadProgramadaID") do update set
  "NombreActividad" = excluded."NombreActividad",
  "Categoria" = excluded."Categoria",
  "TipoFrecuencia" = excluded."TipoFrecuencia",
  "DiaLote" = excluded."DiaLote",
  "HoraSugerida" = excluded."HoraSugerida",
  "AplicaDesdeDia" = excluded."AplicaDesdeDia",
  "AplicaHastaDia" = excluded."AplicaHastaDia",
  "DiasSemana" = excluded."DiasSemana",
  "OrdenProgramacion" = excluded."OrdenProgramacion",
  "RequiereDato" = excluded."RequiereDato",
  "RequiereFoto" = excluded."RequiereFoto",
  "Activa" = excluded."Activa",
  updated_at = now();

with pesajes as (
  select *
  from (values
    (8, 'Pesaje dia 8.'),
    (15, 'Pesaje dia 15.'),
    (22, 'Pesaje dia 22.'),
    (29, 'Pesaje dia 29.'),
    (36, 'Pesaje dia 36.'),
    (43, 'Pesaje dia 43.')
  ) as p("DiaLote", "NombreActividad")
)
insert into pollos.actividades_lote (
  "ActividadLoteID",
  "LoteID",
  "GalponID",
  "FechaProgramada",
  "DiaLote",
  "NombreActividad",
  "Categoria",
  "Estado",
  "FechaRealizada",
  "RealizadaPor",
  "Observacion",
  "CerradaComoPendiente",
  "EstadoSync"
)
select
  'act_lote_' || gen_random_uuid()::text,
  l."LoteID",
  '',
  l."FechaLlegada" + (p."DiaLote" - 1),
  p."DiaLote",
  p."NombreActividad",
  'Pesaje',
  case when l."FechaLlegada" + (p."DiaLote" - 1) < current_date then 'VENCIDA' else 'PENDIENTE' end,
  null,
  '',
  '',
  false,
  'SINCRONIZADO'
from pollos.lotes l
cross join pesajes p
where l."EstadoLote" = 'ACTIVO'
  and not exists (
    select 1
    from pollos.actividades_lote a
    where a."LoteID" = l."LoteID"
      and a."DiaLote" = p."DiaLote"
      and a."Categoria" = 'Pesaje'
      and a."Estado" <> 'NO_APLICA'
  );
