"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UrlPage() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/url-extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const raw = await res.text();

      let data: any = null;

      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Respuesta no JSON:\n${raw.slice(0, 500)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Falló extracción");
      }

      const text = data.text || "";

      // 👇 usamos mismo sistema que Vision/PDF
      localStorage.setItem("last_pdf_text", text);
      localStorage.setItem("last_pdf_filename", "url_scan");
      localStorage.setItem("last_pdf_storage_path", "");
      localStorage.setItem("last_pdf_mime", "text/html");

      router.push("/confirm");
    } catch (err: any) {
      setError(err?.message || "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Agregar desde URL</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Pega el link de un café y extraeré la información automáticamente.
      </p>

      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        style={{
          marginTop: 16,
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontSize: 14,
        }}
      />

      <button
        onClick={handleSubmit}
        disabled={loading || !url.trim()}
        style={{
          marginTop: 12,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "2px solid #111",
          fontWeight: 900,
          background: "#f7f7f7",
            color: "#000",  
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Extrayendo..." : "Extraer café"}
      </button>

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
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <button
        style={{
          marginTop: 20,
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontWeight: 800,
          background: "white",
          fontSize: 14,
          color: "#000",    
        }}
        onClick={() => router.push("/")}
      >
        ← Home
      </button>
    </main>
  );
}