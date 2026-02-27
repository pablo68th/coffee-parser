import { NextResponse } from "next/server";

function looksLikePdf(bytes: Uint8Array) {
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  return head === "%PDF-";
}

function extractDriveFileId(url: string): string | null {
  try {
    const u = new URL(url);
    const m1 = u.pathname.match(/\/file\/d\/([^/]+)/); // /file/d/<id>/
    if (m1?.[1]) return m1[1];
    const id = u.searchParams.get("id"); // open?id=<id>
    if (id) return id;
    return null;
  } catch {
    return null;
  }
}

function findConfirmToken(html: string): string | null {
  // Drive suele meter "confirm=XXXX" en algún lado del HTML
  const m = html.match(/confirm=([0-9A-Za-z_]+)&/);
  if (m?.[1]) return m[1];
  const m2 = html.match(/name="confirm"\s+value="([^"]+)"/);
  if (m2?.[1]) return m2[1];
  return null;
}

// Next/Node a veces maneja set-cookie como múltiples headers
function getSetCookies(res: Response): string[] {
  const anyHeaders: any = res.headers as any;
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie(); // Next.js/undici helper
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookiesToHeader(setCookies: string[]) {
  // Nos quedamos con "name=value" de cada Set-Cookie
  const pairs = setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean);
  return pairs.join("; ");
}

async function fetchAsBrowser(url: string, cookie?: string) {
  return fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      accept:
        "application/pdf,application/octet-stream,text/html;q=0.9,*/*;q=0.8",
      ...(cookie ? { cookie } : {}),
    },
  });
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Falta url" }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 });
    }

    const isDrive = /drive\.google\.com/i.test(url);
    if (!isDrive) {
      return NextResponse.json(
        { error: "Este endpoint está configurado para Google Drive por ahora." },
        { status: 400 }
      );
    }

    const fileId = extractDriveFileId(url);
    if (!fileId) {
      return NextResponse.json(
        { error: "No pude extraer el fileId de Google Drive." },
        { status: 400 }
      );
    }

    // ✅ Endpoint nuevo (muchas veces más directo que drive.google.com/uc)
    const base = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;

    // 1) Primer intento
    const res1 = await fetchAsBrowser(base);

    if (!res1.ok) {
      return NextResponse.json(
        { error: `Drive respondió status ${res1.status}` },
        { status: 400 }
      );
    }

    const ct1 = (res1.headers.get("content-type") || "").toLowerCase();

    // Si ya es PDF/bytes, listo
    const ab1 = await res1.arrayBuffer();
    const u81 = new Uint8Array(ab1);

    const isPdf1 = ct1.includes("application/pdf") || looksLikePdf(u81);
    if (isPdf1) {
      return new NextResponse(ab1, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "x-filename": "qr.pdf",
          "cache-control": "no-store",
        },
      });
    }

    // 2) Si no parece PDF, casi seguro Drive devolvió HTML con token confirm
    const html = new TextDecoder().decode(u81);
    const confirm = findConfirmToken(html);

    if (!confirm) {
      return NextResponse.json(
        {
          error:
            "Drive no devolvió PDF ni token de confirmación. Esto suele pasar si el archivo NO es público (Cualquiera con el vínculo) o Drive bloqueó la descarga.",
        },
        { status: 400 }
      );
    }

    // 3) Guardar cookies del primer response y reintentar con confirm + cookies
    const setCookies = getSetCookies(res1);
    const cookieHeader = cookiesToHeader(setCookies);

    const url2 = `${base}&confirm=${confirm}`;
    const res2 = await fetchAsBrowser(url2, cookieHeader || undefined);

    if (!res2.ok) {
      const ct2 = res2.headers.get("content-type") || "";
      return NextResponse.json(
        { error: `Drive confirm falló. Status ${res2.status}. content-type: ${ct2 || "—"}` },
        { status: 400 }
      );
    }

    const ab2 = await res2.arrayBuffer();
    const u82 = new Uint8Array(ab2);

    if (!looksLikePdf(u82)) {
      return NextResponse.json(
        { error: "Descargué algo pero no parece PDF válido (no inicia con %PDF-)." },
        { status: 400 }
      );
    }

    return new NextResponse(ab2, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "x-filename": "qr.pdf",
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Error inesperado" },
      { status: 500 }
    );
  }
}
