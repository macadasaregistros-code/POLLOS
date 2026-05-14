# Google Apps Script Web App para POLLOS

El archivo `Code.gs` contiene el backend completo para que POLLOS sincronice contra Google Sheets sin exponer credenciales en el frontend.

## Configuración

1. Crea un Google Sheet para POLLOS.
2. Copia el ID del Sheet desde la URL:

   ```text
   https://docs.google.com/spreadsheets/d/SHEET_ID/edit
   ```

3. Crea un proyecto en Apps Script.
4. Pega el contenido de `Code.gs`.
5. En Apps Script abre `Project Settings` y agrega una Script Property:

   ```text
   POLLOS_SHEET_ID = TU_SHEET_ID
   ```

6. Opcional, pero recomendado antes de usar datos reales: agrega una segunda Script Property para proteger el Web App con token:

   ```text
   POLLOS_API_TOKEN = TU_TOKEN_PRIVADO
   ```

   Si esta propiedad no existe, el backend queda abierto para pruebas.

   También puedes reemplazar la constante `SHEET_ID`, pero la propiedad es más cómoda para cambiar de hoja sin tocar código.

## Publicación como Web App

1. En Apps Script haz clic en `Deploy` > `New deployment`.
2. En `Select type`, elige `Web app`.
3. En `Execute as`, selecciona `Me`.
4. En `Who has access`, selecciona el nivel que usarás para tu granja. Para una PWA pública normalmente se usa `Anyone`, pero valida esta decisión antes de producción.
5. Haz clic en `Deploy`.
6. Autoriza permisos para leer/escribir el Google Sheet.
7. Copia la URL que termina en `/exec`.

Para pruebas rápidas puedes usar `Deploy` > `Test deployments`, pero esa URL termina en `/dev` y está pensada para desarrollo.

## Endpoints

Todos devuelven JSON con esta forma:

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "meta": {
    "schemaVersion": 1,
    "serverTime": "2026-05-07T00:00:00.000Z"
  }
}
```

Endpoints implementados:

- `GET ?action=health`
- `GET ?action=bootstrap&userId=user_admin&role=ADMIN`
- `GET ?action=lotes&userId=user_admin&role=ADMIN`
- `GET ?action=dashboard&userId=user_admin&role=ADMIN`
- `POST ?action=sync`
- `POST ?action=create`
- `POST ?action=update`
- `POST ?action=generate-weekly-close`
- `POST ?action=generate-lote-close`

## Conectar el frontend

Crea `.env` en la raíz del proyecto:

```bash
VITE_SHEETS_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
VITE_SYNC_MODE=remote
VITE_SHEETS_API_TOKEN=TU_TOKEN_PRIVADO
```

Luego reinicia Vite:

```bash
npm.cmd run dev
```

El frontend solo usa la URL pública del Web App. No usa credenciales de Google Sheets ni OAuth en el navegador.
