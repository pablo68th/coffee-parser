# 🧠 PROJECT CONTEXT — Coffee Tracker App (Phase 0 → MVP Transition)

## 0) Executive Summary

We are building a **personal coffee tracking app** focused on a **frictionless logging experience**.

Current supported inputs:

* PDF upload
* QR scan
* **Vision / label scan from coffee bag image** ← newest major addition

Core flow:

* Input coffee source
* Extract / infer structured data
* Show Confirm screen
* User only selects rating
* Save to Supabase
* View in Library
* Build Flavor Profile automatically

### Non-negotiable product principles

1. Frictionless above all else
2. Saving must never be blocked by missing data
3. One primary action per screen
4. Mobile-first
5. No long forms
6. System does the work, user only confirms

---

# 1) Current Product Goal

The app is evolving from a **PDF-based POC** into a **multi-input coffee ingestion system**.

Original Phase 0 goal:

* Parse Blend Station PDFs and save coffees

Current broader direction:

* Support multiple input methods
* Reduce dependency on third-party PDFs
* Move toward **label scanning as the primary ingestion method**
* Keep the same Confirm → Save UX regardless of input

---

# 2) Current Stack

Frontend:

* Next.js App Router
* React
* TypeScript
* Client Components

Backend:

* Next route handlers in `app/api/...`

Infra:

* Supabase

  * Postgres
  * Storage
  * Auth

Parsing:

* Deterministic parser for PDFs (`lib/parseCoffee.ts`)
* Vision-based structured extraction via OpenAI API

PDF extraction:

* `pdfjs-dist`

QR:

* `html5-qrcode`

Deploy:

* Vercel

---

# 3) Current App Routes

## `/`

Home screen

Now acts as the **main ingestion hub**.

Current / intended options:

* Upload PDF
* Scan QR
* **Scan label / vision**
* Go to Library

Recommended wording:

* Title should be more like `Agregar café` instead of `Subir PDF`

---

## `/scan`

QR scanning flow

Flow:

1. Scan QR
2. QR resolves to URL
3. Server downloads PDF through `fetch-pdf`
4. PDF gets parsed
5. Data goes to Confirm
6. Save

Status:

* Works, but QR is no longer considered a strategic primary input
* Blend Station appears to be moving away from QR in newer packaging

Conclusion:

* Keep as fallback / legacy support
* Not primary MVP direction

---

## `/vision`

**New Vision / label scan route**

Current behavior:

* User uploads a coffee bag image
* App sends image to `/api/vision`
* OpenAI Vision returns structured JSON
* Result is stored in localStorage
* Redirects to `/confirm`

This is now the **most promising ingestion path for the MVP**.

---

## `/confirm`

Central confirmation screen

This screen now supports **two different input modes**:

### PDF mode

* Uses `parseCoffeeFromText(rawText)`

### Vision mode

* Detects `filename === "vision_scan"`
* Parses structured JSON via `parseVisionJson(rawText)`

Then the screen:

* normalizes country / state / region
* builds a normalized coffee display name
* shows country / state / region / altitude / process / varietal / notes
* asks only for rating
* saves coffee

### Confirm naming rule

Normalized name format should be consistent across all ingestion methods:

```text
Estado (Región) — Proceso
```

Examples:

* `Veracruz (Mecacalco) — Purple Honey`
* `Veracruz (Cosautlán) — Natural Fermentado`

Fallback for special coffees with no location:

* If no state/region available, use best available coffee name
* Example:

  * `Jack Daniel's Amazing Coffee — Barrel Aged`

### Confirm state handling

A derived `Estado` line is shown when possible.

State is inferred from:

* explicit vision `state`
* region patterns
* coffee_name
* final display name

This lets Confirm show:

```text
País: México
Estado: Veracruz
Región: Cosautlán
```

without requiring a DB schema change yet.

---

## `/library`

Personal coffee library

Current features:

* Load coffees from Supabase
* Load assets separately and merge
* Search via `search_text`
* Delete single coffee
* Reset library
* Change rating
* Open stored PDF when available

### Current display

Each coffee card shows:

* normalized coffee_name
* rating
* country
* region
* altitude
* process
* varietal
* **tasting notes now visible**

### Notes

Notes are now being rendered and already confirmed working.

### Pending / partially implemented

* Derived `Estado` should also be visible in Library when it can be inferred from `coffee_name` or region structure
* This has been partially attempted and may still need final polish

---

## `/profile`

Flavor Profile

Current aggregation uses:

* favorite
* liked

Sections currently supported:

* top processes
* top states
* top regions
* top varietals
* top tasting notes

### Important recent improvement

Profile now includes **tasting notes**, which was missing before.

### Important recent fix

Profile now uses the real `coffee_name` in favorites/liked cards, instead of falling back to just region or `"Café"`.

This fixed cases like:

* Jack Daniel’s coffee showing as `"Café"` before
* now should show real saved coffee name

### Pending / partially implemented

* confirm that derived `Estado` is consistently shown or reflected where needed
* ensure Library and Profile stay consistent for naming / state / region formatting

---

# 4) Supabase Schema

## `coffees`

Current fields used:

* `id`
* `user_id`
* `created_at`
* `source_type`
* `parser_version`
* `coffee_name`
* `country`
* `region`
* `altitude_m`
* `process`
* `varietal`
* `tasting_notes`
* `rating_label`
* `rating_score`
* `is_favorite`
* `search_text`

### Important note

There is **no dedicated `state` column yet**.

For now:

* state is derived in UI and from naming logic
* region stores the true locality/region when possible
* coffee_name encodes state + region for consistency

Possible future DB improvement:

* add `state` or `origin_state` field

---

## `assets`

Used to store original file references:

* pdf only for now

Fields:

* `id`
* `user_id`
* `coffee_id`
* `asset_type`
* `storage_path`
* `original_filename`
* `mime_type`
* `created_at`

---

## `extractions`

Used for debugging and future parser evolution

Fields:

* `id`
* `user_id`
* `coffee_id`
* `parser_version`
* `raw_text`
* `parsed_json`
* `created_at`

---

# 5) Current Parsing System

## PDF parsing

Main file:

* `lib/parseCoffee.ts`

Handles:

* altitude
* process
* region
* country
* varietal
* tasting notes when available as text

Includes:

* correction layer
* canonical aliases
* compound processes
* compound varietals
* normalized naming

Examples of fixed cases:

* `Ixhuatlán`
* `Cosautlán`
* `Mecacalco`
* `Purple Honey`
* `Natural Fermentado`
* `Typica Bourbon`
* `Barrel Aged Jack Daniel's`

---

## Vision parsing

Current route:

* `app/api/vision/route.js`

Current test page:

* `app/vision/page.tsx`

Vision flow:

1. image upload
2. send image to OpenAI Responses API
3. ask for structured JSON:

   * `coffee_name`
   * `country`
   * `state`
   * `region`
   * `altitude_m`
   * `process`
   * `varietal`
   * `tasting_notes`
4. localStorage
5. redirect to Confirm

### Important current insight

Vision is now viable enough to be considered the **primary ingestion path for MVP**, with:

* QR as fallback
* URL parsing as possible secondary path
* PDF as legacy support

---

# 6) Multi-Input Product Direction

The product is no longer “just a PDF parser”.

Current intended architecture:

```text
Scan Label / Scan QR / Paste URL / Upload PDF
↓
Extraction layer
↓
Structured Coffee Object
↓
Confirm
↓
Save
↓
Library / Profile
```

### Strategic recommendation from spike

Primary input:

* **Label scanning (Vision)**

Secondary:

* URL parsing

Legacy / fallback:

* QR
* PDF

Why:

* PDFs are high-risk because they depend on third-party behavior
* QR usage appears to be decreasing
* labels always exist on the physical product
* Vision best matches frictionless UX

---

# 7) Spike Results (Important Product Context)

## Label scanning

Tested with real coffee bags.

Result:

* highly viable
* structured coffee information is visible on packaging
* confirm step can correct small mistakes
* best frictionless candidate

## QR

Findings:

* Blend Station QR historically pointed to Drive PDFs
* newer packaging may not include QR anymore
* owner apparently is not changing this despite customer complaints

Conclusion:

* QR is not strategic as primary ingestion

## URL parsing

Still in plan as secondary method

* viable when product page exists
* lower friction than manual entry, but less frictionless than label scan
* not yet fully implemented

---

# 8) Current Known Behavior / Edge Cases

## Working well

* Vision → Confirm → Save flow
* Notes save and now appear in Profile
* Real coffee names appear in Profile instead of generic fallback
* Vision can correctly infer coffee data from real bags

## Special case handling

### Jack Daniel’s / barrel aged coffee

* may not have state/region/altitude/notes
* should still save correctly
* if no location exists, use best available `coffee_name`
* Example desired behavior:

  * `Jack Daniel's Amazing Coffee — Barrel Aged`

### Location structure

Desired representation:

* `País: México`
* `Estado: Veracruz`
* `Región: Cosautlán`

Not:

* `Región: Veracruz, Cosautlán`

State should be separate whenever possible.

---

# 9) Current Bugs / Pending UI Polish

## Confirm

* Confirm state display was broken at one point, then fixed by deriving state from normalized display name
* currently expected to show Estado when derivable

## Library

* tasting notes now confirmed working
* **Estado display may still need final polish / verification**

## Profile

* coffee_name display fixed
* notes now included
* state section included
* needs consistency check against Library / Confirm

## Vision UI

Current `/vision` route is functional but basic.
It still needs:

* nicer UX
* buttons / layout at the level of QR scan screen
* image upload/preview polish
* more polished loading and result handling

This is **in the queue**, but not the current highest priority until extraction is fully validated across real bags.

---

# 10) Home / Entry Point Status

Home currently exists but needs product-level polish.

Recommended Home should expose:

* `Escanear etiqueta`
* `Escanear QR`
* `Seleccionar PDF`
* `Ver biblioteca`

Vision should be easier to access from Home instead of manually typing `/vision`.

This has been discussed and should be implemented soon.

---

# 11) Immediate Current Priorities

## Highest priority now

1. Test Vision with all real coffee bags
2. Report edge cases
3. Improve prompt / normalization / fallbacks
4. Confirm consistency across Confirm / Library / Profile

## Next after that

5. Add polished Vision UI similar to QR UI
6. Surface Vision clearly on Home
7. Continue multi-input architecture cleanup

## Later

8. URL parsing
9. Potential DB support for `state`
10. camera-native Vision UI (instead of only file upload)

---

# 12) Current Instruction Style Preference

When continuing this project:

* explain step by step
* always say exactly which file to open
* exactly what to replace
* avoid assuming advanced dev knowledge
* speak plainly
* avoid vague “you can just...” wording

---

# 13) Recommended Next Action in New Conversation

Continue from:

* **Vision real-bag testing**
* then fix remaining extraction / normalization edge cases
* then move into Vision UI polish + Home integration

---

# 14) Important Reminder

After meaningful stable changes, remind me to run:

```bash
git add .
git commit -m "message"
git push
```

because I often forget to update GitHub unless explicitly reminded.

---

Continuemos donde lo dejamos, por favor