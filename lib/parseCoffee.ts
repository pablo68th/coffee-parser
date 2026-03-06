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

const VARIETAL_ALIASES: Array<[string, string[]]> = [
  ["Geisha", ["Geisha", "Gesha", "Geisha 1931", "Gesha 1931"]],
  ["Typica", ["Typica", "Típica"]],
  ["Bourbon", ["Bourbon"]],
  ["Pink Bourbon", ["Pink Bourbon", "Bourbon Rosado", "Pink Bourbón"]],
  ["Red Bourbon", ["Red Bourbon", "Bourbon Rojo"]],
  ["Yellow Bourbon", ["Yellow Bourbon", "Bourbon Amarillo"]],
  ["Caturra", ["Caturra"]],
  ["Catuai", ["Catuai", "Catuaí", "Catuai Amarillo", "Catuaí Amarillo", "Catuai Rojo", "Catuaí Rojo"]],
  ["Mundo Novo", ["Mundo Novo"]],
  ["Mundo Maya", ["Mundo Maya"]],
  ["Pacamara", ["Pacamara"]],
  ["Pacas", ["Pacas"]],
  ["Pache", ["Pache", "Pache Comum"]],
  ["Villa Sarchi", ["Villa Sarchi", "Villa Sarchí"]],
  ["Java", ["Java"]],
  ["Maragogipe", ["Maragogipe"]],
  ["Maracaturra", ["Maracaturra"]],
  ["SL28", ["SL28", "SL 28"]],
  ["SL34", ["SL34", "SL 34"]],
  ["Sudan Rume", ["Sudan Rume", "Rume Sudan"]],
  ["Heirloom", ["Heirloom", "Ethiopian Heirloom", "Ethiopia Heirloom"]],
  ["Wush Wush", ["Wush Wush"]],
  ["Sidra", ["Sidra", "Bourbon Sidra"]],
  ["Chiroso", ["Chiroso"]],
  ["Arusha", ["Arusha"]],
  ["Mokka", ["Mokka", "Moca"]],
  ["Laurina", ["Laurina"]],
  ["Castillo", ["Castillo"]],
  ["Colombia", ["Colombia"]],
  ["Catimor", ["Catimor"]],
  ["Sarchimor", ["Sarchimor"]],
  ["Parainema", ["Parainema"]],
  ["Obata", ["Obata"]],
  ["Marsellesa", ["Marsellesa"]],
  ["Ruiru 11", ["Ruiru 11"]],
  ["Batian", ["Batian"]],
  ["Centroamericano H1", ["Centroamericano H1", "H1"]],
  ["San Ramon", ["San Ramon", "San Ramón"]],
  ["Garnica", ["Garnica"]],
  ["Acaia", ["Acaia"]],
  ["Kent", ["Kent"]],
  ["Blue Mountain", ["Blue Mountain"]],
  ["Tekisic", ["Tekisic"]],
  ["Ombligon", ["Ombligon", "Ombligón"]],
  ["Venecia", ["Venecia"]],
];

const PROCESS_ALIASES: Array<[string, string[]]> = [
  ["Natural con Fermentación Anaeróbica", [
    "Natural con Fermentación Anaeróbica",
    "Natural con Fermentacion Anaerobica",
    "Natural Anaeróbico",
    "Natural Anaerobico",
  ]],
  ["Lavado", [
    "Lavado",
    "Washed",
    "Fully Washed",
    "Wet Process",
  ]],
  ["Natural", [
    "Natural",
    "Seco",
    "Dry Process",
  ]],
  ["Honey", [
    "Honey",
    "Yellow Honey",
    "Red Honey",
    "Black Honey",
    "White Honey",
  ]],
  ["Pulped Natural", [
    "Pulped Natural",
    "Semi Washed",
    "Semi-Washed",
    "Semiwashed",
    "Semi Lavado",
    "Semi-lavado",
  ]],
  ["Wet Hulled", [
    "Wet Hulled",
    "Giling Basah",
  ]],
  ["Anaeróbico", [
    "Anaerobic",
    "Anaeróbico",
    "Anaerobico",
    "Anaerobic Fermentation",
    "Fermentación Anaeróbica",
    "Fermentacion Anaerobica",
  ]],
  ["Carbonic Maceration", [
    "Carbonic Maceration",
    "Maceración Carbónica",
    "Maceracion Carbonica",
  ]],
  ["Lactic Fermentation", [
    "Lactic Fermentation",
    "Lactic",
    "Fermentación Láctica",
    "Fermentacion Lactica",
  ]],
  ["Extended Fermentation", [
    "Extended Fermentation",
    "Long Fermentation",
    "Fermentación Extendida",
    "Fermentacion Extendida",
  ]],
  ["Double Fermentation", [
    "Double Fermentation",
    "Doble Fermentación",
    "Doble Fermentacion",
  ]],
  ["Thermal Shock", [
    "Thermal Shock",
    "Choque Térmico",
    "Choque Termico",
  ]],
  ["Yeast Inoculated", [
    "Yeast Inoculated",
    "Inoculated Yeast",
    "Cultured Yeast",
    "Levadura Inoculada",
  ]],
  ["Koji", ["Koji"]],
  ["ASD", [
    "ASD",
    "Anaerobic Slow Dry",
  ]],
  ["Infused", [
    "Infused",
    "Infusion",
    "Infusión",
    "Infusionado",
  ]],
  ["Fermentado", [
    "Fermentado",
    "Fermented",
  ]],
];

function clean(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function normalizeUnicode(s: string) {
  return s.normalize("NFC");
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectMexicanState(text: string) {
  for (const st of MEXICAN_STATES) {
    const re = new RegExp(`\\b${escapeRegex(st)}\\b`, "i");
    if (re.test(text)) return st;
  }
  return undefined;
}

function findCanonicalFromAliases(
  text: string,
  aliases: Array<[string, string[]]>
): string | undefined {
  const sorted = aliases
    .flatMap(([canonical, names]) => names.map((name) => ({ canonical, name })))
    .sort((a, b) => b.name.length - a.name.length);

  for (const item of sorted) {
    const re = new RegExp(`\\b${escapeRegex(item.name)}\\b`, "i");
    if (re.test(text)) return item.canonical;
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

  // Proceso: primero intentamos la lógica original alrededor de "msnm"
  const afterAlt = text.split(/msnm/i)[1];
  if (afterAlt) {
    const after = clean(afterAlt);

    const naturalCon = after.match(
      /^Natural\s+con\s+([A-Za-zÁÉÍÓÚÜÑñ\s]+?)(?:\s+Colombia|\s+Perfil|\s+Notas|\s+blendstation|$)/i
    );

    if (naturalCon) {
      parsed.process = clean("Natural con " + naturalCon[1]);
    } else {
      parsed.process = findCanonicalFromAliases(after, PROCESS_ALIASES);
    }
  }

  // Fallback global para proceso
  if (!parsed.process) {
    parsed.process = findCanonicalFromAliases(text, PROCESS_ALIASES);
  }

  // Región: suele estar justo ANTES de "Altura"
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
      /\b(México|Colombia|Ethiopia|Etiopía|Guatemala|Kenya|Kenia|Brazil|Brasil|Perú|Panamá|Panama|El Salvador|Costa Rica|Honduras|Nicaragua|Rwanda|Burundi)\b/i
    )?.[1];

    if (detectedCountry) {
      parsed.country = detectedCountry;
    }
  }

  // Varietal
  parsed.varietal = findCanonicalFromAliases(text, VARIETAL_ALIASES);

  // --- coffee_name automático: "Origen (Región) — Proceso" ---
  const origin = detectedState || parsed.country || "Café";
  const regionPart = parsed.region ? ` (${parsed.region})` : "";
  const processPart = parsed.process ? ` — ${parsed.process}` : "";

  parsed.coffee_name = clean(`${origin}${regionPart}${processPart}`);

  return parsed;
}
