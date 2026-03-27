"use client";

import { useRef, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

export default function VisionPage() {
  const router = useRouter();

  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    setError("");
    setResult("");

    const reader = new FileReader();

    reader.onloadend = async () => {
      try {
        const base64 = String(reader.result).split(",")[1];

        const res = await fetch("/api/vision", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        const raw = await res.text();

        let data: any = null;

        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(`Respuesta no JSON desde /api/vision:\n${raw.slice(0, 500)}`);
        }

        if (!res.ok) {
          throw new Error(data?.error || "Falló la extracción con Vision");
        }

        const text = data.text || "";

        localStorage.setItem("last_pdf_text", text);
        localStorage.setItem("last_pdf_filename", "vision_scan");
        localStorage.setItem("last_pdf_storage_path", "");
        localStorage.setItem("last_pdf_mime", file.type || "image/jpeg");

        setResult(text);

        window.location.href = "/confirm";
      } catch (err: any) {
        setError(err?.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(file);
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Escanear etiqueta</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Sube una foto de la bolsa y extraeré automáticamente la información del café.
      </p>

      <p style={{ marginTop: 6, fontSize: 13, opacity: 0.65 }}>
        Idealmente toma la foto de frente, con buena luz y texto legible.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      <button
        style={{
          marginTop: 16,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "2px solid #111",
          fontWeight: 900,
          background: "#f7f7f7",
          color: "#000",
          fontSize: 16,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
        disabled={loading}
        onClick={() => {
          if (inputRef.current) inputRef.current.value = "";
          inputRef.current?.click();
        }}
      >
        {loading ? "Analizando imagen..." : "Seleccionar foto"}
      </button>

      {filename && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          Seleccionado: <strong>{filename}</strong>
        </p>
      )}

      {previewUrl && (
        <div
          style={{
            marginTop: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 10,
            background: "white",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#000" }}>
            Vista previa
          </div>
          <img
            src={previewUrl}
            alt="Vista previa de la etiqueta"
            style={{
              width: "100%",
              borderRadius: 10,
              display: "block",
              objectFit: "cover",
            }}
          />
        </div>
      )}

      {loading && (
        <div
         style={{
              marginTop: 16,
              fontSize: 13,
              opacity: 0.7,
              fontStyle: "italic",
            }}
        >
          Analizando imagen y preparando datos para confirmar...
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 16,
            border: "1px solid #f3b3b3",
            background: "#fff5f5",
            color: "#8a1f1f",
            borderRadius: 12,
            padding: 12,
            fontSize: 14,
            lineHeight: 1.4,
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

        {!!result && !loading && (
          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              opacity: 0.7,
              fontStyle: "italic",
            }}
          >
            Extracción completada. Redirigiendo a confirmación...
          </p>
        )}

      <button
        style={{
          marginTop: 10,
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontWeight: 800,
          background: "white",
          color: "#000",
        }}
        onClick={() => router.push("/")}
      >
        ← Home
      </button>

    </main>
    
  );
}