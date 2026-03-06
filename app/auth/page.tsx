"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleAuth() {
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setMessage("Escribe tu correo y contraseña.");
      return;
    }

    try {
      setLoading(true);

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        setMessage(
          "Cuenta creada. Revisa tu correo si Supabase te pide confirmación."
        );
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.push("/");
    } catch (e: any) {
      setMessage(e?.message ?? "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "0 auto",
        padding: 16,
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>
        {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
      </h1>

      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Cada usuario tendrá su propia biblioteca y perfil de sabor.
      </p>

      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          marginTop: 16,
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontSize: 14,
        }}
      />

      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          marginTop: 12,
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontSize: 14,
        }}
      />

      <button
        onClick={handleAuth}
        disabled={loading}
        style={{
          marginTop: 16,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontWeight: 800,
          background: "white",
          color: "#000",
          opacity: loading ? 0.6 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading
          ? "Procesando..."
          : mode === "login"
          ? "Entrar"
          : "Crear cuenta"}
      </button>

      <button
        onClick={() =>
          setMode((prev) => (prev === "login" ? "signup" : "login"))
        }
        style={{
          marginTop: 10,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #eee",
          fontWeight: 700,
          background: "white",
          color: "#000",
        }}
      >
        {mode === "login"
          ? "No tengo cuenta"
          : "Ya tengo cuenta, iniciar sesión"}
      </button>

      {message && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            background: "white",
          }}
        >
          {message}
        </div>
      )}
    </main>
  );
}
