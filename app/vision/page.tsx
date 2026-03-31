"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function VisionPage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [capturedImage, setCapturedImage] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e: any) {
        setError("No se pudo acceder a la cámara");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setError("");

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL("image/jpeg");
    const base64 = imageDataUrl.split(",")[1];

setCapturedImage(imageDataUrl);
    if (streamRef.current) {
  streamRef.current.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}  

    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error en Vision");
      }

      const text = data.text || "";

      localStorage.setItem("last_pdf_text", text);
      localStorage.setItem("last_pdf_filename", "vision_scan");
      localStorage.setItem("last_pdf_storage_path", "");
      localStorage.setItem("last_pdf_mime", "image/jpeg");

      window.location.href = "/confirm";
    } catch (err: any) {
      setError(err?.message || "Error procesando imagen");
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Escanear etiqueta</h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Apunta la cámara a la bolsa del café y toma una foto.
      </p>

<div
  style={{
    marginTop: 16,
    border: "1px solid #ddd",
    borderRadius: 12,
    overflow: "hidden",
    background: "#000",
  }}
>
  {capturedImage ? (
    <img
      src={capturedImage}
      alt="Foto capturada"
      style={{
        width: "100%",
        display: "block",
        objectFit: "cover",
      }}
    />
  ) : (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{
        width: "100%",
        display: "block",
        objectFit: "cover",
      }}
    />
  )}
</div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <button
        style={{
          marginTop: 16,
          width: "100%",
          padding: 16,
          borderRadius: 12,
          border: "2px solid #111",
          fontWeight: 900,
          background: "#f7f7f7",
          color: "#000",
          fontSize: 16,
        }}
        onClick={capturePhoto}
        disabled={loading}
      >
        {loading ? "Procesando..." : "📸 Tomar foto"}
      </button>

      {error && (
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
          <strong>Error:</strong> {error}
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