-- Alistamiento is tracked from preparationService and vaccines from plan_vacunal_base.
-- Keep actividades_programadas limited to lote activities and recurring routines.
delete from pollos.actividades_programadas
where "ActividadProgramadaID" ~ '^act_base_[0-9]{2}$';

insert into pollos.actividades_programadas (
  "ActividadProgramadaID",
  "NombreActividad",
  "Categoria",
  "TipoFrecuencia",
  "DiaLote",
  "HoraSugerida",
  "AplicaDesdeDia",
  "AplicaHastaDia",
  "RequiereDato",
  "RequiereFoto",
  "Activa"
)
values
  ('act_lote_ampliacion_dia_3', 'Ampliación día 3.', 'Manejo', 'SEGUN_DIA_LOTE', 3, '', 3, 3, false, false, true),
  ('act_lote_ampliacion_dia_8', 'Ampliación día 8.', 'Manejo', 'SEGUN_DIA_LOTE', 8, '', 8, 8, false, false, true),
  ('act_lote_sacar_bebederos_babies_dia_11', 'Sacar bebederos babies día 11.', 'Manejo', 'SEGUN_DIA_LOTE', 11, '', 11, 11, false, false, true),
  ('act_lote_retirar_calentadoras_dia_15', 'Ampliación y retirada calentadoras día 15.', 'Manejo', 'SEGUN_DIA_LOTE', 15, '', 15, 15, true, false, true),
  ('act_lote_ampliacion_dia_20', 'Ampliación día 20.', 'Manejo', 'SEGUN_DIA_LOTE', 20, '', 20, 20, false, false, true),
  ('act_lote_desencortinar_dia_20', 'Desencortinar día 20.', 'Manejo', 'SEGUN_DIA_LOTE', 20, '', 20, 20, false, false, true),
  ('act_lote_bajar_hembras_dia_21', 'Bajar hembras día 21.', 'Manejo', 'SEGUN_DIA_LOTE', 21, '', 21, 21, false, false, true),
  ('act_rutina_clorar_tanque', 'Clorar tanque principal cada 3 días.', 'Agua', 'CADA_3_DIAS', 3, '', 3, 42, false, false, true),
  ('act_rutina_sulfatar_tanque', 'Sulfatar tanque 24 horas antes de clorar.', 'Agua', 'CADA_3_DIAS', 2, '', 2, 41, false, false, true),
  ('act_rutina_medir_cloro_ph', 'Medir cloro y pH en líneas y tanques.', 'Agua', 'DIARIA', 1, '08:00', 1, 42, false, false, true),
  ('act_rutina_purgar_linea', 'Purgar línea.', 'Agua', 'DIARIA', 1, '08:00', 1, 42, false, false, true),
  ('act_rutina_alimentacion_manana', 'Alimentación mañana 70% (5:00 - 5:30 am).', 'Alimentación', 'DIARIA', 1, '05:00', 1, 42, false, false, true),
  ('act_rutina_alimentacion_tarde', 'Alimentación tarde 30% (3:00 - 4:00 pm).', 'Alimentación', 'DIARIA', 1, '15:00', 1, 42, false, false, true),
  ('act_rutina_fumigacion_9am', 'Fumigación con desinfectante dentro del galpón 9am.', 'Bioseguridad', 'DIARIA', 1, '09:00', 1, 42, false, false, true),
  ('act_rutina_fumigacion_4pm', 'Fumigación con desinfectante dentro del galpón 4pm.', 'Bioseguridad', 'DIARIA', 1, '16:00', 1, 42, false, false, true),
  ('act_rutina_revolcar_cama', 'Revolcar cama.', 'Rutina', 'DIARIA', 1, '10:00', 1, 42, false, false, true),
  ('act_rutina_control_pediluvios', 'Control de pediluvios con creolina.', 'Bioseguridad', 'DIARIA', 1, '08:30', 1, 42, false, false, true),
  ('act_rutina_control_plagas', 'Control de plagas con Cicario / Cipermetrina para la mosca alrededor del galpón.', 'Plagas', 'DIARIA', 1, '17:00', 1, 42, false, false, true),
  ('act_rutina_limpiar_mallas', 'Limpiar mallas y telarañas.', 'Rutina', 'SEMANAL', 7, '', 7, 42, false, false, true),
  ('act_rutina_lavar_filtros', 'Lavar filtros.', 'Rutina', 'SEMANAL', 7, '', 7, 42, false, false, true)
on conflict ("ActividadProgramadaID") do update set
  "NombreActividad" = excluded."NombreActividad",
  "Categoria" = excluded."Categoria",
  "TipoFrecuencia" = excluded."TipoFrecuencia",
  "DiaLote" = excluded."DiaLote",
  "HoraSugerida" = excluded."HoraSugerida",
  "AplicaDesdeDia" = excluded."AplicaDesdeDia",
  "AplicaHastaDia" = excluded."AplicaHastaDia",
  "RequiereDato" = excluded."RequiereDato",
  "RequiereFoto" = excluded."RequiereFoto",
  "Activa" = excluded."Activa",
  updated_at = now();

insert into pollos.plan_vacunal_base (
  "VacunaBaseID",
  "NombreVacuna",
  "DiaProgramado",
  "ViaAplicacion",
  "Activa"
)
values
  ('vac_base_gumboro', 'Gumboro', 8, 'Agua', true),
  ('vac_base_newcastle', 'Newcastle', 10, 'Agua', true)
on conflict ("VacunaBaseID") do update set
  "NombreVacuna" = excluded."NombreVacuna",
  "DiaProgramado" = excluded."DiaProgramado",
  "ViaAplicacion" = excluded."ViaAplicacion",
  "Activa" = excluded."Activa",
  updated_at = now();
