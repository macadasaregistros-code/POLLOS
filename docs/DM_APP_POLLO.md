# Documento Maestro - App Pollo

Este documento es el mapa funcional de la app. Su objetivo es que no se pierda ninguna idea importante y que cada nueva decision se pueda ubicar dentro de una estructura clara.

## 1. Objetivo

La app debe servir para operar, registrar, auditar y analizar la produccion de pollo por galpon y por lote.

Debe cubrir:

- Trabajo diario del galponero.
- Seguimiento de galpones ocupados y desocupados.
- Alistamiento antes de recibir pollito.
- Registro diario de alimento, mortalidad y sacrificio.
- Entradas de materiales.
- Actividades sanitarias, bioseguridad y bienestar.
- Inventario y auditoria para administracion.
- Reportes tecnicos, historicos y de costos.
- Sincronizacion offline/online.

## 2. Roles

### Galponero

Rol operativo. Solo registra informacion y consulta lo necesario para trabajar el dia.

Debe ver:

- Actividades.
- Galpones.
- Entrada.

No debe ver:

- Historial completo.
- Existencias calculadas.
- Costos.
- Auditoria administrativa.
- Modulos de administracion.

### Admin

Rol de control, auditoria y analisis.

Debe ver:

- Inicio o tablero general.
- Galpones.
- Lotes.
- Inventario.
- Reportes.
- Auditoria de existencias.
- Costos.
- Proveedores.
- Clientes.
- Cierres.
- Configuracion operativa.

## 3. Navegacion

### Menu Galponero

1. Actividades
2. Galpones
3. Entrada

### Menu Admin

1. Inicio
2. Galpones
3. Lotes
4. Inventario
5. Reportes

## 4. Principios de interfaz

- La app debe sentirse simple, nativa y operativa.
- Evitar pantallas recargadas o decorativas.
- No usar modales para flujos principales.
- Cada formulario importante debe abrir como vista nueva.
- El boton Guardar debe quedar fijo encima del menu inferior.
- El menu inferior no debe tapar acciones ni contenido.
- Las pantallas que puedan caber en una sola vista deben ajustarse para no requerir scroll innecesario.
- Priorizar lectura rapida, botones claros y formularios compactos.
- El galponero debe poder registrar rapido, sin datos administrativos innecesarios.

## 5. Modulo Galponero - Actividades

Pantalla principal del galponero.

Debe mostrar:

- Actividades vencidas.
- Actividades de hoy.
- Actividades proximas.
- Vacunaciones proximas.
- Recordatorios diarios y semanales.

Los registros de actividades deben abrirse como vistas nuevas.

### Tipos de registros en Actividades

#### Vacunacion

Campos:

- Fecha automatica.
- Lote tomado desde la app.
- Galpon tomado desde la app cuando aplique.
- Numero de aves tomado desde la app.
- Edad tomada desde la app.
- Nombre del producto.
- Laboratorio.
- Numero de lote del producto.
- Fecha de vencimiento.
- Via de administracion.
- Cepa.
- Enfermedad.
- Responsable.
- Firma.
- Foto opcional.
- Observaciones.

Via de administracion inicial:

- Agua de bebida.

#### Tratamiento de Agua

Campos:

- Fecha y hora automatica.
- Lote.
- Galpon.
- Lugar de medicion: tanque, linea o nipple.
- Dosificacion: gramos de cloro.
- Verificacion de pH.
- Verificacion de cloro.
- Accion tomada.
- Foto opcional.
- Observaciones.

#### Control Integrado de Plagas

Tipos:

- Roedores.
- Mosca.

Roedores:

- Frecuencia semanal.
- Registrar cuantas estaciones tienen veneno.
- Producto.
- Dosificacion.
- Galpon.
- Foto opcional.
- Observaciones.

Mosca:

- Frecuencia semanal.
- Fumigacion con cipermetrina.
- Producto.
- Dosificacion.
- Galpon.
- Foto opcional.
- Observaciones.

#### Medicamento

Campos:

- Fecha automatica.
- Lote.
- Galpon.
- Producto.
- Dosis.
- Via de administracion.
- Motivo.
- Responsable.
- Periodo de retiro si aplica.
- Foto opcional.
- Observaciones.

#### Compostaje

Debe llevar control visual por cajon.

Reglas:

- Hay un cajon activo.
- Cuando se empieza a llenar, se registra fecha de inicio.
- Fin de llenado: 20 dias despues del inicio.
- Volteo: 30 dias despues.
- Retiro: 30 dias despues del volteo.
- La mortalidad diaria registrada debe sumarse automaticamente al cajon activo.

Debe mostrar:

- Cajon activo.
- Fecha inicio.
- Fecha fin de llenado.
- Fecha de volteo.
- Fecha de retiro.
- Aves acumuladas.
- Ultimos registros agregados.
- Alertas cuando toque volteo o retiro.

#### Perros

Registros:

- Vacuna contra rabia.
- Desparasitacion.

Campos:

- Fecha automatica.
- Nombre del perro.
- Tipo de registro.
- Producto.
- Laboratorio.
- Lote del producto.
- Fecha de vencimiento.
- Responsable.
- Firma.
- Foto opcional.
- Observaciones.

#### Capacitaciones

Campos:

- Fecha automatica.
- Tema.
- Capacitador.
- Firma del capacitador.
- Asistentes.
- Nombre de cada asistente.
- Firma de cada asistente.
- Observaciones.

## 6. Modulo Galponero - Galpones

Debe mostrar los 6 galpones en una sola pagina.

Cada galpon debe ser clickeable.

### Si el galpon tiene pollo

Al tocarlo, abre vista completa de registro diario.

Debe mostrar:

- Galpon.
- Lote.
- Dia del lote.
- Aves vivas.
- Mortalidad acumulada.

Formulario diario:

#### Alimentacion

Campos:

- Tipo de alimento.
- Bultos consumidos.

Tipos de alimento:

- Preiniciador.
- Iniciador.
- Engorde.

Regla:

- Debe aparecer preseleccionado el ultimo tipo de alimento usado para ese lote.
- Kilogramos consumidos no se digitan.
- Kg consumidos se calculan como bultos x 40 kg.

#### Mortalidad

Campos:

- Machos.
- Hembras.

Interfaz:

- Contadores tipo boton.
- Machos y hembras uno al lado del otro.

Regla:

- La mortalidad registrada se suma automaticamente al compostaje activo.

#### Sacrificio

Reglas:

- Solo se puede activar si el lote tiene mas de 35 dias.
- Una vez activado para ese lote, queda activo para los dias siguientes.
- No se vuelve a preguntar.
- Si ya hubo sacrificio registrado, debe seguir apareciendo.

Campos:

- Machos.
- Hembras.
- Observacion.

Interfaz:

- Machos y hembras uno al lado del otro.

### Si el galpon esta desocupado

Al tocarlo, abre vista completa de alistamiento.

Debe avanzar por categorias tipo tracker.

## 7. Alistamiento del Galpon

Categorias y actividades definitivas.

### Retiro

1. Recoger Equipo.
2. Barrer Pluma.
3. Sacar Caracha.
4. Amontonar Cama durante 8 dias.
5. Retiro de Pollinaza Reusada en Exceso.

Regla especial:

- En "Amontonar Cama" se debe registrar temperatura interna de la pila de pollinaza por lo menos una vez al dia.

### Desinfeccion

6. Fumiga Coquito 1.
7. Fumiga Coquito 2.
8. Lavar Equipo: Bebederos / Comederos.
9. Barrer / Lavado Galpon.
10. Barrer Malla y Limpiar Techo.
11. Reparaciones Locativas.
12. Lavar Tanques de Agua y Purgar Lineas.
13. Calear.
14. Fumiga Desinfectante.

### Instalacion

15. Cisco Nuevo en la mitad sin cama usada.
16. Divisiones.
17. Encortinar.
18. Instalar Calentadoras.
19. Meter Bebederos de Volteo y Comederos Babies.
20. Retirar / lavar cortinas cuando salen calentadoras.

### Recibimiento

21. Precalentar 8h antes de la llegada.
22. Purgar Lineas.
23. Neutrar el Agua de Bebida.
24. Verificar Temperatura.
25. Llegada del Pollito.

## 8. Modulo Galponero - Entrada

Pantalla para registrar entradas de materiales.

Debe mostrar tarjetas:

- Alimento.
- Cisco.
- Gas.

Al tocar una tarjeta, abre vista nueva de formulario.

### Entrada de Alimento

Campos:

- Fecha automatica.
- Tipo de alimento.
- Cantidad de bultos.
- Observaciones.

Tipos:

- Preiniciador.
- Iniciador.
- Engorde.

### Entrada de Cisco

Campos:

- Fecha automatica.
- Cantidad de pacas.
- Observaciones.

### Entrada de Gas

Campos:

- Fecha automatica.
- Cantidad de cilindros.
- Observaciones.

Regla:

- El galponero no ve existencias calculadas.
- Solo registra entradas.

## 9. Recordatorios Operativos

### Diarios

- Fumigacion diaria a las 4pm.
- Cambio diario de pediluvios con creolina.
- Purgar linea a diario.

### Semanales

- Limpiar malla y telaranas.
- Barrer bodegas.
- Control de roedores.
- Control de mosca con cipermetrina.

## 10. Modulo Admin - Inicio

Debe ser tablero general.

Debe mostrar:

- Resumen del dia.
- Alertas.
- Pendientes criticos.
- Estado de sincronizacion.
- Acciones urgentes.
- Galpones activos.
- Lotes activos.
- Incidencias.

## 11. Modulo Admin - Galpones

Debe permitir:

- Ver mapa/lista de galpones.
- Entrar a detalle de cada galpon.
- Revisar estado: ocupado, vacio, limpieza, descanso sanitario, preparacion, recibimiento.
- Revisar alistamiento.
- Revisar lote asociado.
- Revisar registros diarios del galpon.

## 12. Modulo Admin - Lotes

Debe permitir:

- Ver lotes activos.
- Ver lotes historicos.
- Crear lote.
- Asignar galpones.
- Consultar indicadores tecnicos.
- Revisar registros por dia.
- Revisar actividades del lote.
- Revisar vacunas.
- Revisar salidas.
- Cerrar lote.

Indicadores:

- Dia del lote.
- Aves recibidas.
- Aves vivas.
- Mortalidad acumulada.
- Consumo alimento.
- Conversion alimenticia.
- Peso promedio.
- Uniformidad si aplica.
- Salidas / sacrificio.
- Estado del lote.

## 13. Modulo Admin - Inventario

Debe manejar:

- Alimento.
- Cisco.
- Gas.
- Entradas.
- Consumos.
- Ajustes.
- Existencias calculadas.
- Auditoria.

Regla:

- Existencias calculadas solo para Admin/Auditoria.

Calculos:

- Alimento disponible = entradas - consumos - ajustes.
- Cisco disponible = entradas - consumos/asignaciones - ajustes.
- Gas disponible = entradas - consumos/asignaciones - ajustes.

## 14. Modulo Admin - Reportes

Debe incluir:

- Graficas.
- Analisis tecnico.
- Cierres semanales.
- Cierre final de lote.
- Costos.
- Proveedores.
- Clientes.
- Alertas.
- Modulos administrativos segun rol.

Reportes posibles:

- Mortalidad por lote.
- Mortalidad por galpon.
- Consumo de alimento.
- Conversion alimenticia.
- Peso promedio.
- Actividades vencidas.
- Vacunaciones aplicadas.
- Medicamentos aplicados.
- Plagas.
- Agua.
- Compostaje.
- Inventario.
- Costos por lote.
- Costos por kg producido.
- Ventas / salidas.

## 15. Datos y Entidades

Entidades principales:

- Usuarios.
- Galpones.
- Lotes.
- LoteGalpon.
- RegistroDiarioLote.
- ConsumosAlimentoLote.
- TiposAlimento.
- EntradasAlimento.
- EntradasMaterial.
- InventarioMaterial.
- ActividadesLote.
- VacunasLote.
- ControlAgua.
- ControlPlagas.
- Medicamentos.
- CompostajeCajones.
- CompostajeRegistros.
- PerrosRegistros.
- Capacitaciones.
- SalidasPollo.
- Pesajes.
- EventosSanitarios.
- Costos.
- Proveedores.
- Clientes.
- SyncQueue.

## 16. Reglas Generales de Registro

Todos los registros deben guardar:

- Fecha.
- Hora o fecha/hora cuando aplique.
- Usuario que registra.
- Observaciones.
- Estado de sincronizacion.

Cuando aplique:

- Lote.
- Galpon.
- Foto.
- Firma.
- Responsable.

## 17. Sincronizacion

La app debe funcionar offline.

Flujo:

1. El usuario registra datos en local.
2. El registro entra a cola de sincronizacion.
3. Cuando hay conexion, se sincroniza con backend.
4. La app muestra pendientes por sincronizar.
5. Si falla, el registro queda pendiente y se reintenta.

Debe evitar:

- Perder registros.
- Duplicar registros.
- Mostrar como sincronizado algo que fallo.

## 18. Estados de Galpon

Estados esperados:

- Vacio.
- Limpieza.
- Descanso sanitario.
- Preparacion.
- Recibimiento.
- Ocupado.

Transicion:

- Vacio -> Retiro/Limpieza.
- Limpieza -> Desinfeccion.
- Desinfeccion -> Instalacion/Preparacion.
- Preparacion -> Recibimiento.
- Recibimiento -> Ocupado.
- Ocupado -> Vacio al cerrar lote o retirar pollo.

## 19. Estados de Lote

Estados esperados:

- Programado.
- Activo.
- En sacrificio.
- Cerrado.

Reglas:

- Un lote activo puede estar en uno o varios galpones.
- El sacrificio aparece desde dia 36 o cuando ya fue activado.
- El historial y cierres pertenecen al Admin.

## 20. Pendientes por Definir

- Si el sacrificio se registra como parte del registro diario, como salida formal o ambos.
- Si las firmas seran texto, dibujo en pantalla o foto.
- Si las fotos se guardan localmente, en Supabase Storage o en otra ubicacion.
- Si los recordatorios generaran alertas automaticas o solo se mostraran como lista.
- Si compostaje tendra varios cajones activos o solo uno activo a la vez.
- Como se registrara consumo de gas.
- Como se registrara consumo/asignacion de cisco.
- Si el Admin podra corregir registros del galponero.
- Permisos exactos de auditoria.
- Estructura final de costos.
- Reportes prioritarios para la primera version.

## 21. Versiones de Trabajo

### Version 1 - Operacion Galponero

- Menu Galponero.
- Galpones clickeables.
- Registro diario.
- Alistamiento.
- Entrada de alimento/cisco/gas.
- Actividades basicas.
- Sync offline/online.

### Version 2 - Sanidad y Bioseguridad Completa

- Vacunacion ampliada.
- Agua.
- Plagas.
- Medicamentos.
- Perros.
- Capacitaciones.
- Compostaje visual.

### Version 3 - Admin y Auditoria

- Inventario calculado.
- Auditoria de entradas y consumos.
- Lotes historicos.
- Reportes.
- Costos.
- Proveedores/clientes.
- Cierres.

## 22. Criterio de Calidad

La app debe cumplir:

- Rapida para registrar.
- Simple para galponero.
- Completa para Admin.
- Offline confiable.
- Formularios compactos.
- Sin botones ocultos por el menu.
- Sin pantallas decorativas innecesarias.
- Datos suficientes para auditoria.
- Reportes utiles para tomar decisiones.
