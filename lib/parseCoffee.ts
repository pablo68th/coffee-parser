export const PARSER_VERSION = "blend_station_pdf_v1";
export const SOURCE_TYPE = "blend_station_pdf";

export type ParsedCoffee = {
  coffee_name?: string;
  country?: string;
  region?: string;
  altitude_m?: number;
  process?: string;
  varietal?: string;
  tasting_notes?: string[];
};

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

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeUnicode(s: string) {
  return s.normalize("NFC");
}

function detectMexicanState(text: string) {
  for (const st of MEXICAN_STATES) {
    const re = new RegExp(`\\b${st.replace(".", "\\.")}\\b`, "i");
    if (re.test(text)) return st;
  }
  return undefined;
}

export function parseCoffeeFromText(raw: string): ParsedCoffee {
  const normalizedRaw = normalizeUnicode(raw || "");
  const text = clean(normalizedRaw);
  const parsed: ParsedCoffee = {};

  // Altura: "Altura 1312 msnm"
  const altMatch = text.match(/Altura\s+(\d{3,4})\s*msnm/i);
  if (altMatch) parsed.altitude_m = Number(altMatch[1]);

  // Proceso: después de "msnm" suele venir el proceso
  const afterAlt = text.split(/msnm/i)[1];
  if (afterAlt) {
    const after = clean(afterAlt);

    // Caso especial: "Natural con Fermentación Anaeróbica"
    const naturalCon = after.match(
      /^Natural\s+con\s+([A-Za-zÁÉÍÓÚÜÑñ\s]+?)(?:\s+Colombia|\s+Perfil|\s+Notas|\s+blendstation|$)/i
    );

    if (naturalCon) {
      parsed.process = clean("Natural con " + naturalCon[1]);
    } else {
      const procMatch = after.match(
        /^(Natural|Lavado|Honey|Purple Honey|Washed|Fermentado)/i
      );
      if (procMatch) parsed.process = clean(procMatch[0]);
    }
  }

  // Región: suele estar justo ANTES de "Altura"
  // Usamos text normalizado para no perder acentos raros
  const beforeAlt = text.split(/Altura/i)[0];
  if (beforeAlt) {
    const stop = new Set([
      "veracruz",
      "chiapas",
      "oaxaca",
      "puebla",
      "guerrero",
      "nayarit",
      "jalisco",
      "michoacán",
      "michoacan",
      "hidalgo",
      "estado",
      "méxico",
      "mexico",
      "cdmx",
      "origen",
      "perfil",
      "sensorial",
      "ubicado",
      "en",
      "la",
      "zona",
      "central",
      "montañosa",
      "montanosa",
      "del",
      "de",
      "msnm",
      "cafe",
      "café",
      "especialidad",
      "blend",
      "station",
    ]);

    const tokens = beforeAlt
      .split(/\s+/)
      .map((t) => t.replace(/[^A-Za-zÁÉÍÓÚÜÑñ\-]/g, ""))
      .filter(Boolean);

    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      const low = t.toLowerCase();
      const looksLikeName = /^[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑñ\-]{2,}$/.test(t);

      if (looksLikeName && !stop.has(low)) {
        parsed.region = t;
        break;
      }
    }
  }

  // País / origen detectado
  const detectedState = detectMexicanState(text);

  if (detectedState) {
    parsed.country = "México";
  } else {
    const detectedCountry = text.match(
      /\b(México|Colombia|Ethiopia|Etiopía|Guatemala|Kenya|Kenia|Brazil|Brasil|Perú)\b/i
    )?.[1];

    if (detectedCountry) {
      parsed.country = detectedCountry;
    }
  }

  // Varietal
  const varietalMatch = text.match(/\b(Typica|Bourbon|Caturra|Mundo Maya)\b/i);
  if (varietalMatch) parsed.varietal = varietalMatch[1];

  // --- coffee_name automático: "Origen (Región) — Proceso" ---
  const origin = detectedState || parsed.country || "Café";

  const regionPart = parsed.region ? ` (${parsed.region})` : "";
  const processPart = parsed.process ? ` — ${parsed.process}` : "";

  parsed.coffee_name = clean(`${origin}${regionPart}${processPart}`);

  return parsed;
}
