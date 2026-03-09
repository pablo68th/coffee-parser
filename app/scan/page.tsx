"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/lib/supabaseClient";

export default function ScanPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "scanning" | "loading" | "error">("idle");
  const [statusText, setStatusText] = useState("Preparando cámara...");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const html5QrCode = new Html5Qrcode("qr-reader");

    async function startScanner() {
      try {
        setStatus("scanning");
        setStatusText("Escaneando QR...");
        setErrorMsg("");

        const config = {
          fps: 10,
          qrbox: 250,
          aspectRatio: 1,
        };

        const onScanSuccess = async (decodedText: string) => {
          try {
            if (!isMounted) return;

            setStatus("loading");
            setStatusText("QR detectado. Descargando PDF...");
            setErrorMsg("");

            // Ya lo leímos: paramos scanner para que no se dispare varias veces
            await html5QrCode.stop().catch(() => {});

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

            setStatusText("PDF descargado. Extrayendo texto...");

            // 2) Convertir a "archivo" y reusar tu flujo actual
            const file = new File([blob], filename, { type: "application/pdf" });

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
              throw new Error("No se pudo subir el PDF a Storage: " + uploadError.message);
            }

            localStorage.setItem("last_pdf_storage_path", path);
            localStorage.setItem("last_pdf_mime", "application/pdf");

            setStatusText("Abriendo confirmación...");
            router.push("/confirm");
          } catch (e: any) {
            if (!isMounted) return;
            setStatus("error");
            setErrorMsg(e?.message ?? "Error leyendo QR");
          }
        };

        const onScanFailure = () => {
          // ignoramos fallos de lectura continuos para no molestar
        };

        // 1) Intento fuerte: forzar trasera
        try {
          await html5QrCode.start(
            { facingMode: { exact: "environment" } },
            config,
            onScanSuccess,
            onScanFailure
          );
        } catch {
          // 2) Fallback más flexible: preferir trasera
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
          );
        }
      } catch (e: any) {
        if (!isMounted) return;
        setStatus("error");
        setErrorMsg(e?.message ?? "No se pudo iniciar la cámara");
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      html5QrCode
        .stop()
        .catch(() => {})
        .finally(() => {
          html5QrCode.clear();
        });
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
  <div
    style={{
      marginTop: 12,
      border: "1px solid #ddd",
      borderRadius: 12,
      padding: 12,
      fontSize: 14,
      fontWeight: 800,
      background: "white",
    }}
  >
    {statusText}
  </div>
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

    <button
      style={{
        marginTop: 12,
        width: "100%",
        padding: 12,
        borderRadius: 12,
        border: "1px solid #ccc",
        fontWeight: 800,
        background: "white",
        color: "#000",
      }}
      onClick={() => router.refresh()}
    >
      Escanear otro
    </button>
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
