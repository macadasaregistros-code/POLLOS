insert into pollos.galpones ("GalponID", "NombreGalpon", "Capacidad", "EstadoActual", "Observaciones", "Activo")
values
  ('galpon_1A', '1A', 750, 'VACIO', '', true),
  ('galpon_1B', '1B', 750, 'VACIO', '', true),
  ('galpon_2A', '2A', 750, 'VACIO', '', true),
  ('galpon_2B', '2B', 750, 'VACIO', '', true),
  ('galpon_3A', '3A', 2500, 'VACIO', '', true),
  ('galpon_3B', '3B', 2500, 'VACIO', '', true)
on conflict ("GalponID") do update set
  "NombreGalpon" = excluded."NombreGalpon",
  "Capacidad" = excluded."Capacidad",
  "Activo" = true,
  updated_at = now();
