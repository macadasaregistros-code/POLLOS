# POLLOS

PWA offline-first para operación y administración de lotes de pollo de engorde. Esta primera entrega crea la arquitectura base con React, TypeScript, Vite, IndexedDB/Dexie, cola local de sincronización, roles simulados y código base para Google Apps Script como API intermedia hacia Google Sheets.

## Stack

- React + TypeScript + Vite
- PWA con `manifest.webmanifest` y service worker
- IndexedDB con Dexie
- Cola offline de sincronización
- Recharts para gráficas
- jsPDF para reportes PDF locales
- Google Apps Script Web App como intermediario hacia Google Sheets

## Instalación

```bash
npm.cmd install
npm.cmd run dev
```

En PowerShell de esta máquina se usa `npm.cmd` porque la política local puede bloquear `npm.ps1`.

## Variables de entorno

Copia `.env.example` a `.env` y ajusta:

```bash
VITE_SHEETS_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
VITE_SYNC_MODE=mock
VITE_SHEETS_API_TOKEN=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Con `VITE_SYNC_MODE=mock`, la app simula sincronización y marca la cola como sincronizada sin llamar a Google.

## Funcionalidad incluida

- Datos demo iniciales para abrir y probar sin internet.
- Rol `GALPONERO`:
  - Pantalla móvil con lote activo.
  - Registrar día offline.
  - Registrar pesaje guiado 50 machos + 50 hembras.
  - Actividades de hoy con cierre del día.
  - Vacunas.
  - Entrada de alimento.
  - Venta / salida.
  - Agua.
  - Evento sanitario.
  - Inventario básico visible sin costos.
- Rol `ADMIN`:
  - Dashboard básico.
  - Crear lote.
  - Indicadores técnicos.
  - Gráficas de consumo, mortalidad y peso.
  - Inventario alimento.
  - Alertas.
  - Reporte PDF local por lote.
  - Predicción básica de salida.
- Servicios separados:
  - `localDbService`
  - `syncService`
  - `sheetsApiService`
  - `authService`
  - `reportsService`
  - `alertsService`
  - `calculationsService`

## Google Apps Script

El backend completo está en `google-apps-script/Code.gs` y las instrucciones específicas están en `google-apps-script/README.md`.

Pasos:

1. Crea un Google Sheet nuevo.
2. Copia su ID.
3. Crea un proyecto de Apps Script.
4. Pega el contenido de `google-apps-script/Code.gs`.
5. Configura `POLLOS_SHEET_ID` en `Project Settings` > `Script Properties`.
6. Implementa como Web App: `Deploy` > `New deployment` > `Web app`.
7. Usa `Execute as: Me`.
8. Define `Who has access` según tu política. Para una PWA sin login de Google normalmente se usa `Anyone`.
9. Autoriza permisos y copia la URL que termina en `/exec`.
10. Copia la URL del deployment en `VITE_SHEETS_API_URL`.
11. Cambia `VITE_SYNC_MODE=remote`.

Endpoints por `action`:

- `GET ?action=health`
- `GET ?action=bootstrap`
- `POST ?action=sync`
- `POST ?action=create`
- `POST ?action=update`
- `GET ?action=lotes`
- `GET ?action=dashboard`
- `POST ?action=generate-weekly-close`
- `POST ?action=generate-lote-close`

La app envía `POST` como `text/plain` para evitar exponer credenciales y reducir problemas de preflight. El frontend nunca se conecta directo a Google Sheets.

Ejemplo de `.env` conectado al Web App:

```bash
VITE_SHEETS_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
VITE_SYNC_MODE=remote
VITE_SHEETS_API_TOKEN=TOKEN_CONFIGURADO_EN_APPS_SCRIPT
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Para usar Supabase como backend principal de POLLOS, configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Si esas dos variables existen y `VITE_SYNC_MODE` no es `mock`, la cola offline sincroniza contra Supabase en vez de Apps Script.

El endpoint `sync` es idempotente para `CREATE`: si el ID local ya existe en la hoja, actualiza esa fila en vez de duplicarla. Las operaciones `UPDATE` buscan la fila por la primera columna de la tabla, que siempre es el ID definido en el modelo.

## Seguridad

Esta entrega usa roles simulados en el cliente para separar vistas. Apps Script valida operaciones básicas por rol, pero para producción debes agregar autenticación real, tokens firmados o validación por Google Workspace antes de exponer datos económicos.

## PWA

El service worker se registra en build/preview de producción. Para probar instalación:

```bash
npm.cmd run build
npm.cmd run preview
```

Luego abre la URL en el navegador móvil o de escritorio compatible.
