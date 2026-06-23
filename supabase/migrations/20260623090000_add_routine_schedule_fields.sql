alter table pollos.actividades_programadas
  add column if not exists "DiasSemana" integer[] not null default '{}'::integer[],
  add column if not exists "OrdenProgramacion" integer not null default 999;

update pollos.actividades_programadas
set
  "DiasSemana" = array[1, 2, 3, 4, 5, 6, 7],
  "OrdenProgramacion" = case "ActividadProgramadaID"
    when 'act_rutina_clorar_tanque' then 1
    when 'act_rutina_sulfatar_tanque' then 2
    when 'act_rutina_medir_cloro_ph' then 3
    when 'act_rutina_purgar_linea' then 4
    when 'act_rutina_alimentacion_manana' then 5
    when 'act_rutina_alimentacion_tarde' then 6
    when 'act_rutina_fumigacion_9am' then 7
    when 'act_rutina_fumigacion_4pm' then 8
    when 'act_rutina_revolcar_cama' then 9
    when 'act_rutina_control_pediluvios' then 10
    else "OrdenProgramacion"
  end,
  updated_at = now()
where "ActividadProgramadaID" in (
  'act_rutina_clorar_tanque',
  'act_rutina_sulfatar_tanque',
  'act_rutina_medir_cloro_ph',
  'act_rutina_purgar_linea',
  'act_rutina_alimentacion_manana',
  'act_rutina_alimentacion_tarde',
  'act_rutina_fumigacion_9am',
  'act_rutina_fumigacion_4pm',
  'act_rutina_revolcar_cama',
  'act_rutina_control_pediluvios'
);

update pollos.actividades_programadas
set
  "NombreActividad" = 'Tratamiento de agua.',
  "TipoFrecuencia" = 'DIARIA',
  "DiasSemana" = array[1, 2, 3, 4, 5, 6, 7],
  "OrdenProgramacion" = 3,
  "HoraSugerida" = '08:00',
  updated_at = now()
where "ActividadProgramadaID" = 'act_rutina_medir_cloro_ph';

update pollos.actividades_programadas
set
  "NombreActividad" = 'Control de plagas.',
  "TipoFrecuencia" = 'SEMANAL',
  "DiasSemana" = array[2],
  "OrdenProgramacion" = 11,
  "HoraSugerida" = '17:00',
  updated_at = now()
where "ActividadProgramadaID" = 'act_rutina_control_plagas';

