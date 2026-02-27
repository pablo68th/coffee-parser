# 🧠 PROJECT CONTEXT — Coffee PDF Parser

---

## 1️⃣ Project Goal

Aplicación para:

* subir PDFs de perfiles de café (Blend Station style)
* extraer texto automáticamente
* parsear información estructurada
* guardar en Supabase
* construir biblioteca personal de cafés
* generar perfil de sabor del usuario.

---

## 2️⃣ Stack

Frontend:

* Next.js App Router
* TypeScript
* React Client Components

Backend:

* Next API routes
* pdf-parse

Database:

* Supabase (Postgres)

Storage:

* Supabase Storage bucket:

```
coffee-pdfs
```

---

## 3️⃣ App Structure

---

### Home `/`

Funciones:

* subir PDF
* POST → `/api/extract-text`
* extraer texto
* guardar en localStorage:

```
last_pdf_text
last_pdf_filename
last_pdf_storage_path
last_pdf_mime
```

---

### API `/api/extract-text`

Responsabilidad:

* recibir FormData
* leer PDF
* usar pdf-parse
* retornar JSON con text

---

### Confirm `/confirm`

Responsabilidad:

* parseCoffeeFromText(rawText)
* mostrar card
* usuario selecciona rating:

```
favorite
liked
neutral
disliked
```

Guardar:

1️⃣ insert en table `coffees`
2️⃣ obtener id con:

```
.select("id")
```

3️⃣ insert en table `assets`

---

### Library `/library`

Carga:

```
supabase.from("coffees").select("*")
```

Features:

* search
* delete individual
* reset library (con confirm dialog)
* abrir PDF desde storage

---

### Profile `/profile`

Calcula:

* procesos favoritos
* regiones
* varietales

(agregación basada en coffees)

---

## 4️⃣ Supabase Schema

---

### Table: coffees

Campos:

* id (uuid)
* coffee_name
* country
* region
* altitude_m
* process
* varietal
* tasting_notes (array)
* rating_label
* rating_score
* is_favorite
* source_type
* parser_version
* search_text
* created_at

---

### Table: assets

Campos:

* id
* coffee_id (FK)
* asset_type = "pdf"
* storage_path
* original_filename
* mime_type

---

## 5️⃣ Storage Rules

Bucket:

```
coffee-pdfs
```

Path:

```
pdfs/{timestamp}_{sanitized_filename}.pdf
```

Sanitización necesaria:

* remover acentos
* evitar unicode en keys

---

## 6️⃣ Parser Rules (parseCoffee.ts)

Detección:

* altura:

```
Altura XXXX msnm
```

* proceso:

```
Natural con Fermentación Anaeróbica
Natural
Lavado
Honey
```

* región:

estado seguido por región:

```
Veracruz Cosautlán Altura ...
```

* origen:

prioridad:

```
estado mexicano > país detectado > fallback
```

coffee_name generado:

```
Origen (Región) — Proceso
```

---

## 7️⃣ Bugs ya resueltos

🔥 acentos rompiendo storage keys → sanitize filename
🔥 doble guardado → controlado
🔥 región no parseada → regex actualizado
🔥 confirm dialog antes de borrar
🔥 insert assets usando returned coffee id
🔥 supabase env variables missing

---

## 8️⃣ Estado actual (WORKING)

Funciona:

✅ upload PDF
✅ extract text
✅ parse fields
✅ guardar coffee
✅ guardar asset
✅ ver library
✅ abrir PDF
✅ delete entries
✅ reset library

---

## 9️⃣ Próximo paso planeado

Crear tabla:

```
extractions
```

Para guardar:

* rawText
* parsed_json
* parser_version
* debug future parsing

Objetivo:

* mejorar parser sin perder histórico.

---

## 🔟 Mental Model del flujo

```
Upload → Extract → Parse → Confirm → Save coffee → Save asset → Library
```



Continuemos desde este PROJECT_CONTEXT:
