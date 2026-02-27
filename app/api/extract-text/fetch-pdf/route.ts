import { NextResponse } from "next/server";

export const runtime = "nodejs"; // importante en Vercel

function looksLikePdf(bytes: Uint8Array) {
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  return head === "%PDF-";
}

function extractDriveFileId(url: string): string | null {
  try {
    const u = new URL(url);
    const m1 = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m1?.[1]) return m1[1];
    const id = u.searchParams.get("id");
    if (id) return id;
    return null;
  } catch {
    return null;
  }
}

function getSetCookies(res: Response): string[] {
  const anyHeaders: any = res.headers as any;
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookiesToHeader(setCookies: string[]) {
  return setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function findConfirmToken(html: string) {
  // confirm=XXXX&  o  name="confirm" value="XXXX"
  const m1 = html.match(/confirm=([0-9A-Za-z_]+)&/);
  if (m1?.[1]) return m1[1];
  const m2 = html.match(/name="confirm"\s+value="([^"]+)"/);
  return m2?.[1] ?? null;
}

async function fetchAsBrowser(url: string, cookie?: string) {
  return fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      accept: "application/pdf,application/octet-stream,text/html;q=0.9,*/*;q=0.8",
      ...(cookie ? { cookie } : {}),
    },
  });
}

async function tryDownload(url: string) {
  const res = await fetchAsBrowser(url);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const ab = await res.arrayBuffer();
  const u8 = new Uint8Array(ab);

  return { res, ct, ab, u8 };
}

export async function GET() {
  // healthcheck para que puedas abrirlo en navegador y confirmar que existe
  return NextResponse.json({ ok: true, msg: "fetch-pdf alive" });
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Falta url" }, { status: 400 });
    }

    if (!/drive\.google\.com/i.test(url)) {
      return NextResponse.json({ error: "Por ahora solo soportamos links de Google Drive." }, { status: 400 });
    }

    const fileId = extractDriveFileId(url);
    if (!fileId) {
      return NextResponse.json({ error: "No pude extraer el fileId del link de Drive." }, { status: 400 });
    }

    // ✅ Intento A (muchas veces funciona mejor)
    const A = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;

    // ✅ Intento B (fallback clásico)
    const B = `https://drive.google.com/uc?export=download&id=${fileId}`;

    // Reintentos simples (Drive a veces da 500 random)
    const candidates = [A, B];

    for (const base of candidates) {
      // 1) primer intento
      const first = await tryDownload(base);

      if (!first.res.ok) {
        // si es 500/503, probamos siguiente candidato
        if ([500, 502, 503, 504].includes(first.res.status)) continue;

        const snippet = new TextDecoder().decode(first.u8.slice(0, 200));
        return NextResponse.json(
          { error: `Drive respondió status ${first.res.status}. content-type: ${first.ct || "—"}. snippet: ${snippet}` },
          { status: 400 }
        );
      }

      // Si ya parece PDF, listo
      if (first.ct.includes("application/pdf") || looksLikePdf(first.u8)) {
        return new NextResponse(first.ab, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "x-filename": "qr.pdf",
            "cache-control": "no-store",
          },
        });
      }

      // Si no es PDF, probablemente HTML con confirm
      if (first.ct.includes("text/html")) {
        const html = new TextDecoder().decode(first.u8);
        const token = findConfirmToken(html);

        if (!token) {
          // si no hay token, puede ser bloqueo raro; probamos siguiente candidato
          continue;
        }

        const cookies = cookiesToHeader(getSetCookies(first.res));
        const confirmUrl = `${base}&confirm=${token}`;

        const second = await tryDownload(confirmUrl);

        // IMPORTANTE: re-fetch con cookies
        const res2 = await fetchAsBrowser(confirmUrl, cookies || undefined);
        const ct2 = (res2.headers.get("content-type") || "").toLowerCase();
        const ab2 = await res2.arrayBuffer();
        const u82 = new Uint8Array(ab2);

        if (!res2.ok) {
          if ([500, 502, 503, 504].includes(res2.status)) continue;
          const snippet2 = new TextDecoder().decode(u82.slice(0, 200));
          return NextResponse.json(
            { error: `Drive confirm falló. status ${res2.status}. content-type: ${ct2 || "—"}. snippet: ${snippet2}` },
            { status: 400 }
          );
        }

        if (!looksLikePdf(u82)) {
          // no es PDF; probamos siguiente candidato
          continue;
        }

        return new NextResponse(ab2, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "x-filename": "qr.pdf",
            "cache-control": "no-store",
          },
        });
      }
    }

    return NextResponse.json(
      { error: "Drive falló (500 intermitente o bloqueo). Probé 2 rutas de descarga y confirm, sin éxito." },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Error inesperado" }, { status: 500 });
  }
}
