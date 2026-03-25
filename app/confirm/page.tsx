"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  parseCoffeeFromText,
  PARSER_VERSION,
  SOURCE_TYPE,
  type ParsedCoffee,
} from "@/lib/parseCoffee";
import { supabase } from "@/lib/supabaseClient";

type RatingLabel = "favorite" | "liked" | "neutral" | "disliked";
type ConfirmParsed = ParsedCoffee & { state?: string };

function regionFromFilename(filename: string) {
  const base = (filename || "").replace(/\.pdf$/i, "").trim();

  const m1 = base.match(/^Perfil\s+(.+)$/i);
  if (m1?.[1]) return m1[1].trim();

  return "";
}

const MEXICAN_STATES = [
  "Veracruz",
  "Chiapas",
  "Oaxaca",
  "Puebla",
  "Guerrero",
  "Nayarit",
  "Jalisco",
  "Michoacán",
  "Hidalgo",
  "Estado de México",
  "CDMX",
];

function isMexicanState(value: string | undefined) {
  if (!value) return false;
  return MEXICAN_STATES.includes(value);
}

function extractStateFromDisplayName(value: string | undefined) {
  if (!value) return undefined;

  for (const state of MEXICAN_STATES) {
    if (value.startsWith(`${state} (`)) return state;
    if (value.startsWith(`${state} —`)) return state;
  }

  return undefined;
}

function extractRegionFromDisplayName(value: string | undefined) {
  if (!value) return "";

  const match = value.match(/^[^(]+\(([^)]+)\)/);
  return match?.[1]?.trim() || "";
}

function findMexicanStateInText(value: string | undefined) {
  if (!value) return undefined;

  const lower = value.toLowerCase();

  for (const state of MEXICAN_STATES) {
    if (lower.includes(state.toLowerCase())) {
      return state;
    }
  }

  return undefined;
}

function normalizeCountry(value: string | undefined) {
  if (!value) return undefined;

  const lower = value.trim().toLowerCase();

  if (lower === "mexico" || lower === "méxico") return "México";

  return value;
}

function splitVisionRegion(value: string | undefined) {
  if (!value) {
    return { originFromRegion: undefined as string | undefined, cleanRegion: "" };
  }

  const trimmed = value.trim();

  for (const state of MEXICAN_STATES) {
    const lowerValue = trimmed.toLowerCase();
    const lowerState = state.toLowerCase();

    if (lowerValue === lowerState) {
      return {
        originFromRegion: state,
        cleanRegion: "",
      };
    }

    if (lowerValue.startsWith(lowerState + " ")) {
      return {
        originFromRegion: state,
        cleanRegion: trimmed.slice(state.length).trim(),
      };
    }

    if (lowerValue.startsWith(lowerState + ",")) {
      return {
        originFromRegion: state,
        cleanRegion: trimmed.slice(state.length + 1).trim(),
      };
    }
  }

  return {
    originFromRegion: undefined as string | undefined,
    cleanRegion: trimmed,
  };
}

function parseVisionJson(rawText: string): ConfirmParsed | null {
  try {
    const data = JSON.parse(rawText || "");

    return {
      coffee_name:
        typeof data?.coffee_name === "string" ? data.coffee_name : undefined,
      country:
        typeof data?.country === "string" ? data.country : undefined,
      state:
        typeof data?.state === "string" ? data.state : undefined,
      region:
        typeof data?.region === "string" ? data.region : undefined,
      altitude_m:
        typeof data?.altitude_m === "number"
          ? data.altitude_m
          : typeof data?.altitude_m === "string"
          ? Number.isNaN(Number(data.altitude_m))
            ? undefined
            : Number(data.altitude_m)
          : undefined,
      process:
        typeof data?.process === "string" ? data.process : undefined,
      varietal:
        Array.isArray(data?.varietal)
          ? data.varietal.join(" ")
          : typeof data?.varietal === "string"
          ? data.varietal
          : undefined,
      tasting_notes:
        Array.isArray(data?.tasting_notes)
          ? data.tasting_notes.filter((x: unknown) => typeof x === "string")
          : undefined,
    };
  } catch {
    return null;
  }
}

export default function ConfirmPage() {
  const router = useRouter();

  const [rating, setRating] = useState<RatingLabel | null>(null);
  const [rawText, setRawText] = useState("");
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedText = localStorage.getItem("last_pdf_text") || "";
    const storedFilename = localStorage.getItem("last_pdf_filename") || "";

    setRawText(storedText);
    setFilename(storedFilename);
    setRating(null);
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Confirmar café</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          Cargando datos del PDF...
        </p>
      </main>
    );
  }

  const isVisionScan = filename === "vision_scan";

  const parsed: ConfirmParsed =
    isVisionScan
      ? parseVisionJson(rawText) || {}
      : parseCoffeeFromText(rawText);

  const prettyRegion = regionFromFilename(filename);

  const visionRegionParts = isVisionScan
    ? splitVisionRegion(parsed.region)
    : { originFromRegion: undefined as string | undefined, cleanRegion: parsed.region || prettyRegion || "" };

  const normalizedCountry = normalizeCountry(parsed.country);

  const stateFromParsed = isVisionScan && parsed.state && isMexicanState(parsed.state)
    ? parsed.state
    : undefined;

  const stateFromCountry = isMexicanState(parsed.country)
    ? parsed.country
    : undefined;

  const stateFromCoffeeName = findMexicanStateInText(parsed.coffee_name);

  const fixedRegion = isVisionScan
    ? (visionRegionParts.cleanRegion || prettyRegion || "")
    : (parsed.region || prettyRegion || "");

  const fixedCoffeeName = (() => {
    if (isVisionScan) {
      const normalizedState =
        stateFromParsed ||
        visionRegionParts.originFromRegion ||
        stateFromCoffeeName ||
        stateFromCountry;

      const normalizedRegion = fixedRegion || "";

    if (normalizedState || normalizedRegion) {
      const originBase =
        normalizedState ||
        (normalizedCountry && normalizedCountry !== "México" ? normalizedCountry : "Café");

      const regionPart = normalizedRegion ? ` (${normalizedRegion})` : "";
      const processPart = parsed.process ? ` — ${parsed.process}` : "";

      const rawVisionName = (parsed.coffee_name || "").trim();

      const lowerVisionName = rawVisionName.toLowerCase();
      const isRedundantVisionName =
        !rawVisionName ||
        lowerVisionName === originBase.toLowerCase() ||
        lowerVisionName === normalizedRegion.toLowerCase() ||
        lowerVisionName === parsed.process?.toLowerCase() ||
        lowerVisionName.includes(originBase.toLowerCase()) ||
        (normalizedRegion && lowerVisionName.includes(normalizedRegion.toLowerCase()));

      const qualifierPart = !isRedundantVisionName ? ` — ${rawVisionName}` : "";

      return `${originBase}${regionPart}${processPart}${qualifierPart}`.trim();
    }

      if (parsed.coffee_name) {
        const processPart = parsed.process ? ` — ${parsed.process}` : "";
        return `${parsed.coffee_name}${processPart}`.trim();
      }

      if (parsed.process) {
        return parsed.process;
      }

      return "Café";
    }

    const originBase = parsed.coffee_name
      ? parsed.coffee_name.split("(")[0]?.trim()
      : parsed.country || "Café";

    const regionPart = fixedRegion ? ` (${fixedRegion})` : "";
    const processPart = parsed.process ? ` — ${parsed.process}` : "";

    return `${originBase}${regionPart}${processPart}`.trim();
  })();

  const displayState =
    extractStateFromDisplayName(fixedCoffeeName) ||
    stateFromParsed ||
    visionRegionParts.originFromRegion ||
    stateFromCoffeeName ||
    stateFromCountry ||
    undefined;

  const displayRegion =
    fixedRegion || extractRegionFromDisplayName(fixedCoffeeName) || "";

  const displayCountry =
    isVisionScan && (normalizedCountry === "México" || displayState)
      ? "México"
      : normalizedCountry || "—";

  const hasText = !!rawText?.trim();

  const displayCoffeeName = hasText
    ? (fixedCoffeeName || parsed.coffee_name || "Café")
    : "Café (sin texto) — PDF";

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Confirmar café</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        El sistema propone una ficha. Tú solo eliges un rating y guardas.
      </p>

      {showDebug && (
        <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>Texto extraído (debug)</div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Archivo: <strong>{filename || "—"}</strong>
          </div>
          <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 220, overflow: "auto" }}>
            {rawText || "No hay texto. (Este PDF podría ser escaneado/imagen y requerir OCR)."}
          </pre>
        </div>
      )}

      {!rawText?.trim() && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #f0c36d",
            background: "#fff7e6",
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          <strong>Este PDF parece escaneado (imagen).</strong>
          <div style={{ marginTop: 6 }}>
            En Phase 0 la app solo lee texto embebido (sin OCR), así que puede no detectar datos.
            Igual puedes guardar el café con rating.
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          {displayCoffeeName}
        </div>

        <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>
          <div>
            <strong>País:</strong> {displayCountry}
          </div>
          {displayState ? (
            <div>
              <strong>Estado:</strong> {displayState}
            </div>
          ) : null}
          <div>
            <strong>Región:</strong> {displayRegion || "—"}
          </div>
          <div><strong>Altitud:</strong> {parsed.altitude_m ?? "—"} m</div>
          <div><strong>Proceso:</strong> {parsed.process || "—"}</div>
          <div><strong>Varietal:</strong> {parsed.varietal || "—"}</div>
          <div style={{ marginTop: 8 }}>
            <strong>Notas:</strong>{" "}
            {parsed.tasting_notes?.length ? parsed.tasting_notes.join(", ") : "—"}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tu rating</div>

        <div style={{ display: "grid", gap: 8 }}>
          <RatingButton label="favorite" selected={rating === "favorite"} onClick={() => setRating("favorite")} />
          <RatingButton label="liked" selected={rating === "liked"} onClick={() => setRating("liked")} />
          <RatingButton label="neutral" selected={rating === "neutral"} onClick={() => setRating("neutral")} />
          <RatingButton label="disliked" selected={rating === "disliked"} onClick={() => setRating("disliked")} />
        </div>
      </div>

      <button
        style={{
          marginTop: 16,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontWeight: 800,
          background: "white",
          color: "#000",
          opacity: rating && !saving ? 1 : 0.5,
          cursor: rating && !saving ? "pointer" : "not-allowed",
        }}
        disabled={!rating || saving}
        onClick={async () => {
          if (!rating) return;
          if (saving) return;

          setSaving(true);

          const storage_path = localStorage.getItem("last_pdf_storage_path");
          const original_filename =
            filename || localStorage.getItem("last_pdf_filename") || null;

          const normalizedRawText = (rawText || "").replace(/\s+/g, " ").trim();

          if (normalizedRawText) {
            const { data: existing, error: dupError } = await supabase
              .from("extractions")
              .select("id")
              .eq("raw_text", normalizedRawText)
              .limit(1);

            if (dupError) {
              console.log("No pude checar duplicados (extractions):", dupError);
            } else if (existing && existing.length > 0) {
              localStorage.removeItem("last_pdf_text");
              localStorage.removeItem("last_pdf_filename");
              localStorage.removeItem("last_pdf_storage_path");
              localStorage.removeItem("last_pdf_mime");

              router.push("/library");
              setSaving(false);
              return;
            }
          }

          const { data } = await supabase.auth.getUser();
          const user = data?.user;

          if (!user) {
            console.error("No authenticated user");
            setSaving(false);
            return;
          }

          const { data: coffeeRows, error } = await supabase
            .from("coffees")
            .insert({
              user_id: user.id,
              coffee_name: displayCoffeeName ?? null,
              region: displayRegion ?? null,
              country: (normalizedCountry ?? parsed.country) ?? null,
              altitude_m: parsed.altitude_m ?? null,
              process: parsed.process ?? null,
              varietal: parsed.varietal ?? null,
              tasting_notes: parsed.tasting_notes ?? [],
              rating_label: rating,
              rating_score:
                rating === "favorite"
                  ? 3
                  : rating === "liked"
                  ? 2
                  : rating === "neutral"
                  ? 1
                  : 0,
              is_favorite: rating === "favorite",
              source_type: SOURCE_TYPE,
              parser_version: PARSER_VERSION,
              search_text: [
                fixedCoffeeName ?? "",
                displayState ?? "",
                displayRegion ?? "",
                normalizedCountry ?? parsed.country ?? "",
                parsed.process ?? "",
                parsed.varietal ?? "",
                ...(parsed.tasting_notes ?? []),
              ]
                .join(" ")
                .replace(/\s+/g, " ")
                .trim(),
            })
            .select("id");

          if (error) {
            alert("Error Supabase (coffees): " + error.message);
            setSaving(false);
            return;
          }

          const coffee_id = coffeeRows?.[0]?.id;

          if (coffee_id && storage_path) {
            const { error: assetError } = await supabase.from("assets").insert({
              user_id: user.id,
              coffee_id,
              asset_type: "pdf",
              storage_path,
              original_filename,
              mime_type: localStorage.getItem("last_pdf_mime") ?? "application/pdf",
            });

            if (assetError) {
              alert("ERROR insertando en assets: " + assetError.message);
            }
          }

          try {
            if (coffee_id) {
              const payload = {
                user_id: user.id,
                coffee_id,
                parser_version: PARSER_VERSION,
                raw_text: (rawText || "").replace(/\s+/g, " ").trim(),
                parsed_json: parsed,
              };

              const { error: extractionError } = await supabase
                .from("extractions")
                .insert(payload)
                .select("id");

              if (extractionError) {
                alert("❌ Error insertando extraction: " + extractionError.message);
                console.log("EXTRACTIONS ERROR:", extractionError);
              }
            }
          } catch (e: any) {
            alert("❌ Excepción rara guardando extraction (ver consola).");
            console.log("EXTRACTIONS EXCEPTION:", e);
          }

          localStorage.removeItem("last_pdf_text");
          localStorage.removeItem("last_pdf_filename");
          localStorage.removeItem("last_pdf_storage_path");
          localStorage.removeItem("last_pdf_mime");
          setSaving(false);

          router.push("/library");
        }}
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>

      <div style={{ marginTop: 32, fontSize: 12, color: "#888", textAlign: "center" }}>
        <span
          style={{ cursor: "pointer", textDecoration: "underline" }}
          onClick={() => setShowDebug((prev) => !prev)}
        >
          {showDebug ? "Ocultar texto extraído (debug)" : "Ver texto extraído (debug)"}
        </span>
      </div>

      {showDebug && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            maxHeight: 250,
            overflow: "auto",
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Archivo: {filename || "—"}
          </div>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {rawText || "No hay texto. (Este PDF podría requerir OCR)."}
          </pre>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Regla del producto: aunque falten datos, guardar nunca se bloquea.
      </p>
    </main>
  );
}

function RatingButton(props: {
  label: RatingLabel;
  selected: boolean;
  onClick: () => void;
}) {
  const pretty =
    props.label === "favorite" ? "⭐ Favorite" :
    props.label === "liked" ? "🙂 Liked" :
    props.label === "neutral" ? "😐 Neutral" :
    "🙃 Disliked";

  return (
    <button
      onClick={props.onClick}
      style={{
        textAlign: "left",
        padding: 14,
        borderRadius: 12,
        border: props.selected ? "2px solid #111" : "1px solid #ddd",
        background: props.selected ? "#f7f7f7" : "white",
        fontWeight: props.selected ? 800 : 600,
        color: "#000",
      }}
    >
      {pretty}
    </button>
  );
}