export const runtime = "nodejs";

// ✅ Fix para Vercel/Node: pdf.js a veces espera DOMMatrix (API de browser)
if (!(globalThis as any).DOMMatrix) {
  (globalThis as any).DOMMatrix = class {};
}

export async function GET() {
  return Response.json({ ok: true, message: "extract-text endpoint funcionando" });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json(
        { error: "No se recibió un archivo PDF en el campo 'file'." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // pdf.js (legacy build) para Node
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // ✅ En servidor NO usamos worker (evita issues en Vercel)
    const loadingTask = pdfjs.getDocument({ data, disableWorker: true });
    const doc = await loadingTask.promise;

    let fullText = "";
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items.map((it: any) => it.str);
      fullText += strings.join(" ") + "\n";
    }

    return Response.json({
      ok: true,
      text: fullText,
      meta: { pages: doc.numPages },
    });
  } catch (err: any) {
    console.error("ERROR extract-text:", err);
    return Response.json(
      { error: err?.message ?? String(err) ?? "Error desconocido" },
      { status: 500 }
    );
  }
}
