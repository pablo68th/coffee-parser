"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  const [filename, setFilename] = useState("");
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleContinue() {
    if (!fileObj) {
      alert("Primero selecciona un PDF.");
      return;
    }

    try {
      setLoading(true);

      // 1) Extraer texto del PDF
      const fd = new FormData();
      fd.append("file", fileObj);

      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: fd,
      });

      const contentType = res.headers.get("content-type") || "";
      const bodyText = await res.text();

      if (!contentType.includes("application/json")) {
        alert(
          `Hubo un problema leyendo el PDF.\n\nStatus: ${res.status}\n\nDetalle:\n${bodyText.slice(
            0,
            200
          )}`
        );
        return;
      }

      const data = JSON.parse(bodyText);

      if (!res.ok) {
        alert(data?.error ?? "Error extrayendo texto");
        return;
      }

      // 2) Subir PDF original a Supabase Storage
      const safeName = fileObj.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "_");

      const path = `pdfs/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("coffee-pdfs")
        .upload(path, fileObj, { contentType: "application/pdf" });

      if (uploadError) {
        alert("No se pudo subir el PDF: " + uploadError.message);
        return;
      }

      // 3) Guardar para /confirm
      localStorage.setItem("last_pdf_text", data.text || "");
      localStorage.setItem("last_pdf_filename", fileObj.name);
      localStorage.setItem("last_pdf_storage_path", path);
      localStorage.setItem("last_pdf_mime", "application/pdf");

      alert("DEBUG home storage_path = " + path);

      // 4) Ir a confirm
      router.push("/confirm");
    } catch (e: any) {
      alert("Error inesperado: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Subir PDF</h1>

      <p style={{ marginTop: 8 }}>Selecciona tu PDF de café (Phase 0: sin OCR).</p>

      {/* Input real (oculto) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          setFileObj(file);
          setFilename(file?.name || "");
        }}
      />

<button
  style={{
    marginTop: 12,
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "1px solid #ccc",
    fontWeight: 900,
    background: "white",
    color: "#000",
  }}
  onClick={() => router.push("/scan")}
>
  Escanear QR →
</button>

      {/* Botón: Seleccionar / Cambiar PDF */}
      <button
        style={{
          marginTop: 16,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontWeight: 900,
          background: "white",
          color: "#000",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
        disabled={loading}
        onClick={() => {
          if (fileInputRef.current) fileInputRef.current.value = ""; // permite re-seleccionar el mismo PDF
          fileInputRef.current?.click();
        }}
      >
        {fileObj ? "Cambiar PDF" : "Seleccionar PDF"}
      </button>

      {filename && (
        <p style={{ marginTop: 12 }}>
          Seleccionado: <strong>{filename}</strong>
        </p>
      )}

      {/* Continuar (se activa cuando ya hay PDF) */}
      <button
        style={{
          marginTop: 12,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontWeight: 800,
          background: "white",
          color: "#000",
          opacity: fileObj && !loading ? 1 : 0.5,
          cursor: fileObj && !loading ? "pointer" : "not-allowed",
        }}
        disabled={!fileObj || loading}
        onClick={handleContinue}
      >
        {loading ? "Procesando..." : "Continuar"}
      </button>

      <button
        style={{
          marginTop: 10,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #eee",
          fontWeight: 800,
          background: "white",
          color: "#000",
        }}
        onClick={() => router.push("/library")}
      >
        Ver biblioteca →
      </button>

      <button
  style={{
    marginTop: 10,
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "1px solid #eee",
    fontWeight: 800,
    background: "white",
    color: "#000",
  }}
  onClick={async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  }}
>
  Cerrar sesión
</button>

    </main> 
  );
        

}