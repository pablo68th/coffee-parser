"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCoffeeFromText, PARSER_VERSION, SOURCE_TYPE } from "@/lib/parseCoffee";
import { supabase } from "@/lib/supabaseClient";


type RatingLabel = "favorite" | "liked" | "neutral" | "disliked";

function regionFromFilename(filename: string) {
  const base = (filename || "").replace(/\.pdf$/i, "").trim();

  // Ej: "Perfil Cosautlán" -> "Cosautlán"
  const m1 = base.match(/^Perfil\s+(.+)$/i);
  if (m1?.[1]) return m1[1].trim();

  // Ej: "Finca las Ranas" (si algún día quieres usarlo)
  return "";
}

export default function ConfirmPage() {
  const router = useRouter();

  const [rating, setRating] = useState<RatingLabel | null>(null);
  const [rawText, setRawText] = useState("");
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

useEffect(() => {
  setRawText(localStorage.getItem("last_pdf_text") || "");
  setFilename(localStorage.getItem("last_pdf_filename") || "");
  setRating(null); // ✅ siempre arrancar sin rating
}, []);

const parsed = parseCoffeeFromText(rawText);

const prettyRegion = regionFromFilename(filename);
const fixedRegion =
  parsed.region || prettyRegion || "";

  const fixedCoffeeName = (() => {
  // Respeta tu lógica: origen (región) — proceso
  const origin = parsed.coffee_name?.split("(")[0]?.trim() || parsed.country || "Café";
  const regionPart = fixedRegion ? ` (${fixedRegion})` : "";
  const processPart = parsed.process ? ` — ${parsed.process}` : "";
  return `${origin}${regionPart}${processPart}`.trim();
})();

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
    // Debug: texto extraído
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

      {/* Coffee card mock */}
      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>
        {displayCoffeeName}
        </div>

        <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>
          <div><strong>País:</strong> {parsed.country || "—"}</div>
          <div><strong>Región:</strong> {fixedRegion || "—"}</div>
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

// ✅ Anti-duplicados REAL (por raw_text en extractions)
// Normalizamos el texto para que pequeños cambios de espacios no rompan el match
const normalizedRawText = (rawText || "").replace(/\s+/g, " ").trim();

if (normalizedRawText) {
  const { data: existing, error: dupError } = await supabase
    .from("extractions")
    .select("id")
    .eq("raw_text", normalizedRawText)
    .limit(1);

  if (dupError) {
    // Si falla el check, NO bloqueamos (brief: frictionless)
    console.log("No pude checar duplicados (extractions):", dupError);
  } else if (existing && existing.length > 0) {
    // 🧹 limpiamos datos temporales del último PDF

localStorage.removeItem("last_pdf_text");
localStorage.removeItem("last_pdf_filename");
localStorage.removeItem("last_pdf_storage_path");
localStorage.removeItem("last_pdf_mime");

    router.push("/library");
    setSaving(false);
return;
  }
}

  // fetch authenticated user and guard against null
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
      region: fixedRegion ?? null,
      country: parsed.country ?? null,
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
  fixedRegion ?? "",
  parsed.country ?? "",
  parsed.process ?? "",
  parsed.varietal ?? "",
  ...(parsed.tasting_notes ?? []),
]
  .join(" ")
  .replace(/\s+/g, " ")
  .trim(),    })
    .select("id");

    if (error) {
      alert("Error Supabase (coffees): " + error.message);
      setSaving(false);
      return;
    }

  const coffee_id = coffeeRows?.[0]?.id;

  // Regla: nunca bloquear guardado por datos faltantes
  // Entonces: si no hay storage_path, igual dejamos guardar el café y seguimos.
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
      // NO retornamos; seguimos a library aunque falle assets
    } else {
      
    }
  } else {
 }

  // 3) Guardar extracción (rawText + parsed) para debug futuro
  // Importante: si esto falla, NO debe bloquear el guardado del café.
// 3) Guardar extracción (rawText + parsed) para debug futuro
try {
  if (coffee_id) {
const payload = {
  user_id: user.id,
  coffee_id: coffee_id,
  parser_version: PARSER_VERSION,
  raw_text: (rawText || "").replace(/\s+/g, " ").trim(),
  parsed_json: parsed,
};

  const { data, error } = await supabase
  .from("extractions")
  .insert(payload)
  .select("id");

if (error) {
  alert("❌ Error insertando extraction: " + error.message);
  console.log("EXTRACTIONS ERROR:", error);
} else {
 
}
  } else {
    
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

{/* Debug discreto */}
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

