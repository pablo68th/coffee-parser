"use client";

import { useState, ChangeEvent } from "react";

export default function VisionPage() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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
        throw new Error(`Non-JSON response from /api/vision:\n${raw.slice(0, 500)}`);
        }

        if (!res.ok) {
        throw new Error(data?.error || "Vision request failed");
        }

        setResult(data.text || "No result returned");
      } catch (err: any) {
        setError(err?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    reader.readAsDataURL(file);
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Vision Test</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Upload a coffee bag image and test AI extraction.
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ marginTop: 16 }}
      />

      {loading && (
        <p style={{ marginTop: 16 }}>Analyzing image...</p>
      )}

      {error && (
        <p style={{ marginTop: 16, color: "crimson" }}>
          Error: {error}
        </p>
      )}

      {result && (
        <pre
          style={{
            marginTop: 20,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
            whiteSpace: "pre-wrap",
            overflowX: "auto",
          }}
        >
          {result}
        </pre>
      )}
    </main>
  );
}
