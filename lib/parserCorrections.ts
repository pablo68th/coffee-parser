export function normalizeForLookup(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCorrectionMap(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(input)) {
    out[normalizeForLookup(key)] = value;
  }

  return out;
}

function applyCorrection(
  value: string | undefined,
  corrections: Record<string, string>
): string | undefined {
  if (!value) return value;

  const normalized = normalizeForLookup(value);
  return corrections[normalized] ?? value;
}

function applyRegionCorrection(value: string | undefined): string | undefined {
  if (!value) return value;

  const exact = applyCorrection(value, REGION_CORRECTIONS);
  if (exact && exact !== value) return exact;

  const normalized = normalizeForLookup(value);

  if (normalized.includes("cosautln") || normalized.includes("cosautlan")) {
    return "Cosautlán";
  }

  if (normalized.includes("mecacalco")) {
    return "Mecacalco";
  }

  return value;
}

const REGION_CORRECTIONS = buildCorrectionMap({
  "Ixuatln": "Ixhuatlán",
  "Ixhuatlan": "Ixhuatlán",
  "Ixhuatln": "Ixhuatlán",
  "Cosautlan": "Cosautlán",
  "Cosautln": "Cosautlán",
  "Llave Mecacalco": "Mecacalco",
  "Mecacalco": "Mecacalco",
  "Michoacan": "Michoacán",
});

const COUNTRY_CORRECTIONS = buildCorrectionMap({
  "Mexico": "México",
  "Guatemla": "Guatemala",
  "Etiopia": "Etiopía",
  "Kenia": "Kenya",
  "Panama": "Panamá",
  "Brasil": "Brasil",
  "Peru": "Perú",
});

export function applyParserCorrections<T extends {
  coffee_name?: string;
  region?: string;
  country?: string;
}>(parsed: T): T {
  const correctedRegion = applyRegionCorrection(parsed.region);
  const correctedCountry = applyCorrection(parsed.country, COUNTRY_CORRECTIONS);
  
  let correctedCoffeeName = parsed.coffee_name;

  if (
    correctedCoffeeName &&
    parsed.region &&
    correctedRegion &&
    parsed.region !== correctedRegion
  ) {
    correctedCoffeeName = correctedCoffeeName.replace(parsed.region, correctedRegion);
  }

  if (
    correctedCoffeeName &&
    parsed.country &&
    correctedCountry &&
    parsed.country !== correctedCountry
  ) {
    correctedCoffeeName = correctedCoffeeName.replace(parsed.country, correctedCountry);
  }

  return {
    ...parsed,
    region: correctedRegion,
    country: correctedCountry,
    coffee_name: correctedCoffeeName,
  };
}