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

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function parseCoffeeFromText(raw: string): ParsedCoffee {
  const text = clean(raw);
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
  const beforeAlt = text.split(/Altura/i)[0];
  if (beforeAlt) {
    const stop = new Set([
      "veracruz",
      "origen",
      "perfil",
      "sensorial",
      "ubicado",
      "en",
      "la",
      "zona",
      "central",
      "montañosa",
      "del",
      "estado",
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

  // País fijo (por ahora)
  if (text.match(/\bVeracruz\b/i)) parsed.country = "México";

  // Varietal
  const varietalMatch = text.match(/\b(Typica|Bourbon|Caturra|Mundo Maya)\b/i);
  if (varietalMatch) parsed.varietal = varietalMatch[1];

  // --- coffee_name automático: "Origen (Región) — Proceso" ---

  const mexicanStates = [
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

  let detectedState: string | undefined;
  for (const st of mexicanStates) {
    const re = new RegExp(`\\b${st.replace(".", "\\.")}\\b`, "i");
    if (re.test(text)) {
      detectedState = st;
      break;
    }
  }

  const origin =
    detectedState ||
    parsed.country ||
    (text.match(
      /\b(México|Colombia|Ethiopia|Etiopía|Guatemala|Kenya|Kenia|Brazil|Brasil|Perú)\b/i
    )?.[1] as string | undefined) ||
    "Café";

  const regionPart = parsed.region ? ` (${parsed.region})` : "";
  const processPart = parsed.process ? ` — ${parsed.process}` : "";

  parsed.coffee_name = `${origin}${regionPart}${processPart}`.trim();

  return parsed;
}