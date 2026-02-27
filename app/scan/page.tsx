"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5QrcodeScanner } from "html5-qrcode";
import { supabase } from "@/lib/supabaseClient";

export default function ScanPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "scanning" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    setStatus("scanning");

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      async (decodedText) => {
        try {
          setStatus("loading");
          setErrorMsg("");

          // Ya lo leímos: paramos scanner para que no se dispare 20 veces
          await scanner.clear();

          // decodedText debería ser una URL (link al PDF)
          const url = decodedText.trim();

          // 1) Pedir al server que baje el PDF
          const res = await fetch("/api/extract-text/fetch-pdf", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url }),
          });

          if (!res.ok) {
  const raw = await res.text().catch(() => "");
  let msg = `No se pudo bajar el PDF (status ${res.status})`;

  try {
    const j = JSON.parse(raw);
    if (j?.error) msg = j.error;
  } catch {
    if (raw) msg = raw.slice(0, 200);
  }

  throw new Error(msg);
}

          const filename = res.headers.get("x-filename") || "qr.pdf";
          const blob = await res.blob();

          // 2) Convertir a "archivo" y reusar tu flujo actual
          const file = new File([blob], filename, { type: "application/pdf" });

          // Guardamos el archivo en localStorage como si fuera upload normal:
          // OJO: no guardamos el archivo en sí, guardamos el texto después.
          // Entonces: aquí solo mandamos a Home con un truco? No.
          // Mejor: hacemos el flujo completo aquí: extract-text + upload storage.
          // Pero tú ya lo tienes armado en Home.
          //
          // Solución simple: reutilizamos el endpoint /api/extract-text aquí mismo
          const fd = new FormData();
          fd.append("file", file);

          const ex = await fetch("/api/extract-text", { method: "POST", body: fd });
          const exCt = ex.headers.get("content-type") || "";
          const exBody = await ex.text();

          if (!exCt.includes("application/json")) {
            throw new Error("No se pudo extraer texto del PDF (respuesta inválida).");
          }

          const exJson = JSON.parse(exBody);
          if (!ex.ok) {
            throw new Error(exJson?.error ?? "Error extrayendo texto");
          }

          // 3) Guardar para /confirm (igual que Home)
          localStorage.setItem("last_pdf_text", exJson.text || "");
          localStorage.setItem("last_pdf_filename", filename);

          // Nota: storage_path lo genera Home al subir a Storage.
          // Aquí también lo hacemos: subimos el PDF.
          const safeName = file.name
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, "_")
  .replace(/[^a-zA-Z0-9._-]/g, "_");

const path = `pdfs/${Date.now()}_${safeName}`;

const { error: uploadError } = await supabase.storage
  .from("coffee-pdfs")
  .upload(path, file, { contentType: "application/pdf" });

if (uploadError) {
  // No bloqueamos (frictionless), pero avisamos
  console.log("No se pudo subir PDF a Storage:", uploadError.message);
} else {
  localStorage.setItem("last_pdf_storage_path", path);
  localStorage.setItem("last_pdf_mime", "application/pdf");
}

            
          // Necesitas tu supabase client aquí? En /scan no lo importamos.
          // Para mantenerlo simple: NO subimos aquí.
          // Peeero tú quieres guardar el PDF siempre (brief).
          // Entonces lo correcto es subirlo aquí también.

          // 👉 Para subir desde /scan, vamos a pedirte 1 cosa:
          // copiar la subida a Storage desde Home aquí.
          // Te lo pongo como Paso 2B (abajo), para mantenerlo claro.

          // Por ahora, mandamos a confirm y ahí NO creará asset si no hay storage_path.
          // Si quieres cumplir el brief al 100%, hacemos el Paso 2B.
          router.push("/confirm");
        } catch (e: any) {
          setStatus("error");
          setErrorMsg(e?.message ?? "Error leyendo QR");
        }
      },
      () => {
        // errores de lectura constantes se ignoran, si no se vuelve molesto
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [router]);

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Escanear QR</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Apunta la cámara al QR. Cuando lo detecte, descargará el PDF y te llevará a confirmar.
      </p>

      <div
        id="qr-reader"
        style={{
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          overflow: "hidden",
        }}
      />

      {status === "loading" && (
        <div style={{ marginTop: 12, opacity: 0.8, fontWeight: 800 }}>Procesando...</div>
      )}

      {status === "error" && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #f0c36d",
            background: "#fff7e6",
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
          }}
        >
          <strong>No se pudo.</strong>
          <div style={{ marginTop: 6 }}>{errorMsg}</div>
        </div>
      )}

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
        }}
        onClick={() => router.push("/")}
      >
        ← Volver a Home
      </button>
    </main>
  );
}
