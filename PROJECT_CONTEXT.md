Aquí tienes una **versión actualizada y completa** del `PROJECT_CONTEXT.md`, ya con **todo lo que traemos hasta hoy**, incluyendo el **nuevo flujo de QR**, el **estado real**, los **bugs** y el **punto exacto donde estamos atorados** (Vercel + pdfjs worker).

Puedes copiar/pegar esto tal cual en un chat nuevo y yo voy a entender exactamente dónde quedamos.

---

# 🧠 PROJECT CONTEXT — Coffee PDF Parser (Phase 0 + QR)

## 0) Resumen ejecutivo

Estamos construyendo una app personal (POC Phase 0) para guardar cafés a partir de PDFs tipo Blend Station de forma ultra frictionless:

* Upload PDF o Escanear QR → bajar PDF
* Extraer texto (sin OCR)
* Parsear campos determinísticos
* Usuario solo elige rating (favorite/liked/neutral/disliked)
* Guardar café en Supabase + guardar PDF en Storage + guardar extracción para debug futuro
* Ver biblioteca y perfil de sabor por agregación simple (no ML)

**Principios no negociables (Brief):**

1. Frictionless sobre todo
2. Guardar jamás se bloquea por datos faltantes
3. Una acción principal por pantalla
4. Mobile-first, uso con una mano
5. Sin forms largos (nunca)
6. Sistema hace el trabajo, usuario solo confirma

---

## 1) Project Goal (Phase 0)

Aplicación para:

* subir PDFs de perfiles de café (Blend Station style)
* (nuevo) escanear QR que redirige a un PDF → bajarlo → procesarlo igual
* extraer texto automáticamente (PDF con texto embebido, sin OCR)
* parsear información estructurada
* guardar en Supabase
* construir biblioteca personal
* generar perfil de sabor del usuario (agregación simple)

---

## 2) Stack actual

Frontend:

* Next.js App Router (Next 16.x con Turbopack)
* TypeScript
* React Client Components

Backend:

* Next API Routes en `app/api/.../route.ts`
* Endpoint de extracción usa **pdfjs-dist** (se migró desde pdf-parse durante debugging en Vercel)

DB:

* Supabase Postgres

Storage:

* Supabase Storage bucket: `coffee-pdfs`
* Path: `pdfs/{timestamp}_{sanitized_filename}.pdf`
* Sanitización storage keys: quitar acentos, unicode, etc.

---

## 3) Estructura de la app (rutas)

### Home `/`

Objetivo: subir PDF (por ahora con botón “Seleccionar PDF” + “Continuar” como acción principal).

Flujo:

1. seleccionar PDF
2. POST `/api/extract-text` con FormData(file)
3. subir PDF a Supabase Storage bucket `coffee-pdfs` con path sanitizado
4. guardar en localStorage:

   * `last_pdf_text`
   * `last_pdf_filename`
   * `last_pdf_storage_path`
   * `last_pdf_mime`
5. push a `/confirm`

UI: se han removido la mayoría de debugs; solo errores.

---

### Scan `/scan` (NUEVO)

Objetivo: escanear QR desde el teléfono.

Flujo:

1. `html5-qrcode` detecta QR
2. QR contiene una URL (en la práctica suele ser Google Drive `.../file/d/<id>/view`)
3. La app llama un endpoint server: `POST /api/extract-text/fetch-pdf` para bajar el PDF (porque desde el browser hay CORS/Drive issues)
4. Una vez obtenido el PDF como blob:

   * Se manda a `/api/extract-text` para extraer texto
   * Se sube el PDF a Supabase Storage (ideal: siempre)
   * Se setean los mismos localStorage keys que en Home
   * Se redirige a `/confirm`

Estado: la ruta existe y ya no es 404/405; el problema actual es el parsing en Vercel (pdf.js worker / DOMMatrix).

---

### API `/api/extract-text` (CRÍTICO)

Responsabilidad:

* recibir FormData con `file`
* convertir a bytes
* extraer texto
* retornar JSON `{ ok: true, text, meta }`

Situación:

* Antes se usaba `pdf-parse`.
* Se migró a `pdfjs-dist/legacy/build/pdf.mjs` durante debugging de Vercel.
* Problemas encontrados:

  * `DOMMatrix is not defined` (pdf.js intenta API de browser)
  * “Setting up fake worker failed: Cannot find module ... pdf.worker.mjs in .next/chunks”
  * “Cannot find module pdfjs-dist/legacy/build/pdf.js” (no existe en esa versión instalada)
  * Error Turbopack: `require.resolve(...)` regresa número tipo 65956 en lugar de ruta

**Estado actual:** endpoint aún inestable en Vercel por worker/paths; se estaban probando soluciones para forzar worker en Node.

---

### API `/api/extract-text/fetch-pdf` (NUEVO)

Responsabilidad:

* Recibir `{ url }`
* Si es Google Drive, extraer `fileId`
* Probar bajar PDF con:

  * `drive.usercontent.google.com/download?id=...&export=download`
  * `drive.google.com/uc?export=download&id=...`
* Manejar HTML de confirm (token `confirm=`) + cookies
* Retornar PDF como `application/pdf` + header `x-filename`

Estado:

* Ya responde (ya no 404)
* Antes devolvía “Drive respondió status 500” con links de Drive
* Se endureció con fallback y confirm token
* El bloqueo principal ahora no es descarga, es el parsing del PDF en `/api/extract-text`

---

### Confirm `/confirm`

Responsabilidad:

* leer localStorage (`last_pdf_text`, `last_pdf_filename`, `last_pdf_storage_path`, `last_pdf_mime`)
* `parseCoffeeFromText(rawText)` produce objeto parsed
* mostrar card
* usuario elige rating: `favorite | liked | neutral | disliked`
* Guardar:

**Guardar en DB:**

1. insert `coffees` con:

   * `coffee_name` generado (estado (región) — proceso)
   * `country, region, altitude_m, process, varietal, tasting_notes`
   * rating_label/score, is_favorite
   * `source_type`, `parser_version`
   * `search_text`
2. insert en `assets` si hay `storage_path`:

   * `coffee_id`, `asset_type="pdf"`, `storage_path`, `original_filename`, `mime_type`
3. insert en `extractions` (debug parsing futuro):

   * `coffee_id`, `raw_text`, `parsed_json`, `parser_version`
   * Si falla, NO bloquea.

Anti-duplicados:

* Se implementó control para evitar duplicados (hubo bug donde se guardaba 3 veces).
* En algún momento se hizo check por raw_text en extractions para no duplicar.

UI:

* Se movieron/ocultaron debugs. Debug de “texto extraído” se pidió que quede al final, discreto (expandible).

---

### Library `/library`

Carga:

* `supabase.from("coffees").select("*, assets(...)").order("created_at", { ascending: false })`

Features:

* search (usando `search_text`)
* delete individual
* reset library (confirm dialog)
* abrir PDF desde Storage (`getPublicUrl`)
* (nuevo) cambiar rating desde library (update)

  * hubo error “Too many re-renders” por `setToast` fuera de handlers; se corrigió después moviéndolo dentro del flujo correcto
  * se eliminó debug (id visible etc.)

---

### Profile `/profile`

Agregación simple basada en coffees:

* top procesos liked/favorite
* top regiones liked/favorite
* top varietales liked/favorite

Sin ML.

---

## 4) Supabase Schema

### Table: coffees

Campos:

* id (uuid)
* coffee_name
* country
* region
* altitude_m
* process
* varietal
* tasting_notes (array / json)
* rating_label
* rating_score
* is_favorite
* source_type
* parser_version
* search_text
* created_at

### Table: assets

Campos:

* id
* coffee_id (FK)
* asset_type = "pdf"
* storage_path
* original_filename
* mime_type
* created_at

### Table: extractions (YA CREADA)

Campos recomendados (ajustado a errores previos):

* id
* coffee_id (FK)
* parser_version
* raw_text
* parsed_json
* created_at

Notas:

* Hubo errores de schema cache porque se intentó insertar columnas que NO existían (`mime_type`, `original_filename`). Se arregló alineando columnas.

---

## 5) Parser (lib/parseCoffee.ts)

Exports:

* `PARSER_VERSION = "blend_station_pdf_v1"`
* `SOURCE_TYPE = "blend_station_pdf"`
* `parseCoffeeFromText(raw)`

Reglas:

* Altura: `Altura XXXX msnm`
* Proceso: Natural / Lavado / Honey / “Natural con Fermentación Anaeróbica”
* Región: suele venir antes de “Altura”; regex/tokens
* Origen: estado mexicano > país detectado > fallback
* coffee_name: `Origen (Región) — Proceso`

Notas:

* Tasting notes: los PDFs nuevos NO traen notas en texto (están en gráfica/imagen). Entonces `tasting_notes` a veces será vacío y eso está OK (brief: no bloquear).

---

## 6) Bugs y fixes históricos relevantes

Resueltos:

* acentos rompiendo keys de Storage → filename sanitization
* doble/triple guardado → controlado
* región no parseada → regex actualizado
* confirm dialog antes de borrar
* insert assets usando returned coffee id
* env vars supabase missing
* errores de `extractions` por columnas inexistentes → schema alineado
* search_text migration: hubo error `array_to_string(jsonb...)` y se corrigió (casting)

Pendientes/actuales (HOY):

* **QR flow funciona hasta descargar, pero Vercel falla al extraer texto**:

  * `DOMMatrix is not defined`
  * `Setting up fake worker failed: cannot find pdf.worker.mjs in .next/chunks`
  * intentos de arreglar worker path con `require.resolve` fallaron porque Turbopack regresaba número
  * intento de usar `pdf.js` legacy .js falló porque no existe en esa versión instalada

---

## 7) Deploy / Mobile testing

* Se desplegó en Vercel: `https://coffee-parser.vercel.app`
* Motivo: cámara en iPhone requiere HTTPS (no HTTP local IP)
* GitHub deploy ya conectado
* Problema recurrente: cambios sí deployan (Ready), pero se prueba en phone con query param `?v=N` para evitar cache.

---

## 8) Estado actual (WORKING vs BROKEN)

WORKING:

* Upload PDF desde Home → Confirm → Save coffee/assets/extractions → Library/Profile
* Library/Profile limpias sin debugs
* Search funcionando con `search_text`
* Update rating desde library (ya se buscó implementar)

BROKEN / In progress:

* Scan QR end-to-end en producción:

  * descarga de Drive ya se atacó con endpoint fetch-pdf
  * el parsing/extract-text en Vercel es el bloqueo principal (pdfjs worker/DOMMatrix)

---

## 9) Next steps (prioridad)

P0 (bloqueante):

1. estabilizar `/api/extract-text` en Vercel para que funcione con PDFs descargados de Drive

   * solución ideal: extracción sin worker o empaquetado correcto del worker en serverless

P1:
2) UI mejor: Home con selección + botón continuar habilitado; confirm con debug discreto al final
3) mejorar naming consistente (sin depender de filename)
4) permitir re-calificar un café (update rating) sin borrar y resubir

---

## 🔟 Mental model del flujo

### Upload:

`Home Upload → /api/extract-text → Storage upload → localStorage → Confirm → Save coffees/assets/extractions → Library/Profile`

### QR:

`Scan QR → /api/extract-text/fetch-pdf → /api/extract-text → Storage upload → localStorage → Confirm → Save ...`

---

## Información clave adicional (para continuar rápido)

* Repo tiene `app/api/extract-text/route.ts`
* Y `app/api/extract-text/fetch-pdf/route.ts`
* Actualmente fetch desde scan debe llamar `/api/extract-text/fetch-pdf` (no `/api/fetch-pdf`)
* Error actual visto en teléfono: problemas de worker / DOMMatrix durante extract-text.

---

Continuemos donde lo dejamos, por favor