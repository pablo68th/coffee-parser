export const runtime = "nodejs";

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html: string, name: string) {
  const regex = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  return html.match(regex)?.[1]?.trim() || "";
}

function extractTitle(html: string) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
}

function normalizeLoose(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractExplicitProcess(sourceText: string) {
  const text = sourceText || "";

  const patterns = [
    /proceso\s*[:\-]\s*([^\n\r]+)/i,
    /process\s*[:\-]\s*([^\n\r]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const raw = match[1]
      .replace(/\s+/g, " ")
      .trim();

    if (!raw) continue;

    // cortar si viene pegado con otros campos
    const cleaned = raw
      .split(/(?:varietal|variedad|altura|altitud|notas|notes|finca|producción|produccion|origen)\s*[:\-]/i)[0]
      .trim();

    if (cleaned) return cleaned;
  }

  return "";
}

function improveProcessFromText(params: {
  process?: string | null;
  coffee_name?: string | null;
  sourceText: string;
}) {
  const currentProcess = (params.process || "").trim();
  const coffeeName = (params.coffee_name || "").trim();
  const sourceText = params.sourceText || "";

  // 1) Primero: si la página dice explícitamente "Proceso: X", eso gana.
  const explicitProcess = extractExplicitProcess(sourceText);
  if (explicitProcess) {
    return explicitProcess;
  }

  // 2) Si no hay campo explícito, usamos inferencia por texto.
  const haystack = normalizeLoose(`${coffeeName} ${sourceText}`);

  const knownCompoundProcesses = [
    "natural con maceración",
    "natural con fermentación anaeróbica",
    "natural fermentado",
    "purple honey",
    "red honey",
    "yellow honey",
    "black honey",
    "honey",
    "washed",
    "lavado",
    "barrel aged",
    "natural",
  ];

  for (const candidate of knownCompoundProcesses) {
    if (haystack.includes(normalizeLoose(candidate))) {
      return candidate;
    }
  }

  return currentProcess || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawUrl = body?.url;

    if (!rawUrl || typeof rawUrl !== "string") {
      return Response.json({ error: "No URL provided" }, { status: 400 });
    }

    let targetUrl: URL;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return Response.json({ error: "URL inválida" }, { status: 400 });
    }

    if (!/^https?:$/.test(targetUrl.protocol)) {
      return Response.json({ error: "La URL debe empezar con http o https" }, { status: 400 });
    }

if (!process.env.OPENAI_API_KEY) {
  return Response.json(
    {
      error: "Missing OPENAI_API_KEY in environment",
      debug: {
        vercelEnv: process.env.VERCEL_ENV || null,
        nodeEnv: process.env.NODE_ENV || null,
        hasOpenAiKey: !!process.env.OPENAI_API_KEY,
      },
    },
    { status: 500 }
  );
}

    const pageRes = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!pageRes.ok) {
      return Response.json(
        { error: `No se pudo abrir la página (status ${pageRes.status})` },
        { status: 400 }
      );
    }

    const html = await pageRes.text();

    const title = extractTitle(html);
    const metaDescription =
      extractMetaContent(html, "description") ||
      extractMetaContent(html, "og:description") ||
      "";
    const ogTitle = extractMetaContent(html, "og:title") || "";
    const visibleText = stripHtml(html).slice(0, 12000);

    const pageText = [
      title ? `TITLE: ${title}` : "",
      ogTitle ? `OG_TITLE: ${ogTitle}` : "",
      metaDescription ? `DESCRIPTION: ${metaDescription}` : "",
      visibleText ? `PAGE_TEXT: ${visibleText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Analyze this coffee product webpage text and extract structured coffee information. " +
                  "Return ONLY valid JSON with these fields: " +
                  "coffee_name, country, state, region, altitude_m, process, varietal, tasting_notes. " +
                  "Important rules: " +
                  "1) country must be the country, not a state. " +
                  "2) state must be the Mexican state when visible. Example: Veracruz, Puebla, Oaxaca, Chiapas. " +
                  "3) region must be the smaller locality or municipality when visible. Example: Cosautlán, Zentla, Mecacalco. " +
                  "4) Do not merge state and region into one field. " +
                  "5) tasting_notes must be an array of short strings or null. " +
                  "6) altitude_m must be a number or null. " +
                  "7) Always try to extract a meaningful coffee_name. " +
                  "8) If varietals appear together as a known combined name, keep them together as one value. " +
                  "8.1) Preserve compound or multi-word processes exactly when present, such as 'Natural con Maceración', 'Natural con Fermentación Anaeróbica', 'Purple Honey', or similar. Do not shorten them to just 'Natural' or 'Honey'. " +
                  "9) If a field is missing, return null. " +
                  "10) Do not include explanations. " +
                  "11) Do not wrap the JSON in markdown. " +
                  "12) Ignore marketing fluff unless it helps identify the coffee. " +
                  "13) Use only information actually present in the webpage text.\n\n" +
                  pageText,
              },
            ],
          },
        ],
      }),
    });

    const openaiData = await openaiRes.json();

    if (!openaiRes.ok) {
      return Response.json(
        {
          error: openaiData?.error?.message || "OpenAI request failed",
          raw: openaiData,
        },
        { status: openaiRes.status }
      );
    }

    const output = openaiData?.output || [];
    let text = "";

    for (const item of output) {
      const content = item?.content || [];
      for (const part of content) {
        if (part?.type === "output_text" && part?.text) {
          text = part.text;
          break;
        }
      }
      if (text) break;
    }

let finalText = text;

try {
  const parsed = JSON.parse(text || "{}");

  const correctedProcess = improveProcessFromText({
    process: parsed?.process,
    coffee_name: parsed?.coffee_name,
    sourceText: pageText,
  });

  const corrected = {
    ...parsed,
    process: correctedProcess,
  };

  finalText = JSON.stringify(corrected, null, 2);
} catch {
  // si no se puede parsear, devolvemos el texto original
}

return Response.json({
  ok: true,
  text: finalText,
  debug: {
    title,
    metaDescription,
    sourceUrl: targetUrl.toString(),
  },
});

  } catch (err: any) {
    console.error("URL EXTRACT ERROR:", err);

    return Response.json(
      { error: err?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}