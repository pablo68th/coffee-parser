export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    message: "vision endpoint is alive",
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const imageBase64 = body && body.imageBase64;

    if (!imageBase64) {
      return Response.json(
        { error: "No image provided" },
        { status: 400 }
      );
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

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
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
                    "Analyze this coffee bag label and extract structured coffee information. " +
                    "Return ONLY valid JSON with these fields: " +
                    "coffee_name, country, state, region, altitude_m, process, varietal, tasting_notes. " +
                    "Important rules: " +
                    "1) country must be the country, not a state. Example: Mexico. " +
                    "2) state must be the Mexican state when visible. Example: Veracruz, Puebla, Oaxaca, Chiapas. " +
                    "3) region must be the smaller locality or municipality when visible. Example: Cosautlán, Zentla, Mecacalco. " +
                    "4) Do not merge state and region into one field. " +
                    "5) If only one location is visible and it is clearly a state, put it in state and leave region null. " +
                    "6) If only one location is visible and it is clearly a smaller locality, put it in region. " +
                    "7) tasting_notes must be an array of short strings or null. " +
                    "8) altitude_m must be a number or null. " +
                    "9) Always try to extract a meaningful coffee_name. coffee_name should not be null unless absolutely impossible. " +
                    "10) If a clear product name is visible, use it as coffee_name. " +
                    "11) If no explicit product name exists, build coffee_name from the best available origin and/or process information. " +
                    "12) If enough information exists, do not leave coffee_name null. " +
                    "13) If varietals appear together as a known combined name, keep them together as one value. Example: Typica Bourbon. " +
                    "14) Do not split a combined varietal into separate unrelated entries if the label suggests a single combined varietal. " +
                    "15) If a field is missing, return null. " +
                    "16) do not include explanations. " +
                    "17) do not wrap the JSON in markdown.",
                },
                              {
                type: "input_image",
                image_url: "data:image/jpeg;base64," + imageBase64,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          error: (data && data.error && data.error.message) || "OpenAI request failed",
          raw: data,
        },
        { status: response.status }
      );
    }

    const output = data && data.output ? data.output : [];
    let text = "";

    for (const item of output) {
      const content = item && item.content ? item.content : [];
      for (const part of content) {
        if (part && part.type === "output_text" && part.text) {
          text = part.text;
          break;
        }
      }
      if (text) break;
    }

    return Response.json({ ok: true, text: text });
  } catch (err) {
    console.error("VISION API ERROR:", err);

    return Response.json(
      { error: (err && err.message) || "Unknown server error" },
      { status: 500 }
    );
  }
}
