"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type CoffeeItem = {
  id: string;
  coffee_name?: string;
  country?: string;
  region?: string;
  altitude_m?: number;
  process?: string;
  varietal?: string;
  tasting_notes?: string[];
  search_text?: string;
  rating_label?: "favorite" | "liked" | "neutral" | "disliked";
  created_at?: number;
  assets?: { id: string; storage_path: string; original_filename: string | null }[];
};

function prettyRating(r?: CoffeeItem["rating_label"]) {
  if (r === "favorite") return "⭐ Favorite";
  if (r === "liked") return "🙂 Liked";
  if (r === "neutral") return "😐 Neutral";
  if (r === "disliked") return "🙃 Disliked";
  return "—";
}

export default function LibraryPage() {
  const router = useRouter();
  const [items, setItems] = useState<CoffeeItem[]>([]);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function loadFromDB() {
      const { data, error } = await supabase
        .from("coffees")
        .select("*, assets(id, storage_path, original_filename)")
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Error cargando coffees:", error);
        return;
      }

      setItems(data || []);
    }

    loadFromDB();
  }, []);

  // ✅ auto-hide del toast (sin loops)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1000);
    return () => clearTimeout(t);
  }, [toast]);

  async function updateRating(id: string, newRating: CoffeeItem["rating_label"]) {
    const ratingScore =
      newRating === "favorite"
        ? 3
        : newRating === "liked"
        ? 2
        : newRating === "neutral"
        ? 1
        : 0;

    const { error } = await supabase
      .from("coffees")
      .update({
        rating_label: newRating,
        rating_score: ratingScore,
        is_favorite: newRating === "favorite",
      })
      .eq("id", id);

    if (error) {
      alert("No se pudo actualizar rating: " + error.message);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              rating_label: newRating,
            }
          : item
      )
    );

    setToast("✅ Actualizado");
  }

  const filtered: CoffeeItem[] = items.filter((c) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;

    const hay = (c.search_text || "").toLowerCase().replace(/\s+/g, " ").trim();
    return hay.includes(q);
  });

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Tu biblioteca</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>Aquí viven tus cafés guardados (Phase 0).</p>

      {toast && (
        <div
          style={{
            marginTop: 12,
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 10,
            fontSize: 13,
            fontWeight: 800,
            background: "white",
          }}
        >
          {toast}
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por región, proceso, varietal…"
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
        style={{
          marginTop: 12,
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
        ← Home
      </button>

      <button
        style={{
          marginTop: 10,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontWeight: 800,
          background: "white",
          color: "#000",
        }}
        onClick={() => router.push("/profile")}
      >
        Ver perfil de sabor →
      </button>

      <button
        style={{
          marginTop: 10,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          border: "1px solid #ccc",
          fontWeight: 900,
          background: "white",
          color: "#000",
        }}
        onClick={async () => {
          const ok = confirm(
            "⚠️ ¿Seguro que quieres borrar TODA tu biblioteca?\n\nEsto eliminará todos los cafés de Supabase."
          );
          if (!ok) return;

          const { error } = await supabase.from("coffees").delete().not("id", "is", null);

          if (error) {
            alert("No se pudo vaciar: " + error.message);
            return;
          }

          setItems([]);
          alert("Listo. Biblioteca borrada.");
        }}
      >
        Vaciar biblioteca (reset)
      </button>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14, opacity: 0.8 }}>
            {items.length === 0 ? "No hay cafés guardados todavía." : `No hay resultados para: "${query.trim()}"`}
          </div>
        ) : (
          filtered
            .slice()
            .reverse()
            .map((c: CoffeeItem) => (
              <div key={c.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
                <div style={{ fontWeight: 900 }}>
                  {c.coffee_name || (c.region ? `Café de ${c.region}` : "Café sin nombre")}
                </div>

                <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>
                  <div>
                    <strong>Rating:</strong> {prettyRating(c.rating_label)}
                  </div>
                  <div>
                    <strong>País:</strong> {c.country || "—"}
                  </div>
                  <div>
                    <strong>Región:</strong> {c.region || "—"}
                  </div>
                  <div>
                    <strong>Altitud:</strong> {c.altitude_m ?? "—"} m
                  </div>
                  <div>
                    <strong>Proceso:</strong> {c.process || "—"}
                  </div>
                  <div>
                    <strong>Varietal:</strong> {c.varietal || "—"}
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Cambiar rating:</div>

                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {(["favorite", "liked", "neutral", "disliked"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => updateRating(c.id, r)}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: c.rating_label === r ? "2px solid #111" : "1px solid #ddd",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        {r === "favorite" && "⭐"}
                        {r === "liked" && "🙂"}
                        {r === "neutral" && "😐"}
                        {r === "disliked" && "🙃"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  style={{
                    marginTop: 10,
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #eee",
                    fontWeight: 800,
                    background: "white",
                    color: "#000",
                  }}
                  onClick={async () => {
                    const ok = confirm("¿Eliminar este café? (se borrará de la base de datos)");
                    if (!ok) return;

                    const { error } = await supabase.from("coffees").delete().eq("id", c.id);

                    if (error) {
                      alert("No se pudo borrar: " + error.message);
                      return;
                    }

                    setItems((prev) => prev.filter((x) => x.id !== c.id));
                  }}
                >
                  Eliminar
                </button>

                {c.assets?.[0]?.storage_path && (
                  <button
                    style={{
                      marginTop: 10,
                      width: "100%",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid #eee",
                      fontWeight: 800,
                      background: "white",
                      color: "#000",
                    }}
                    onClick={() => {
                      const { data } = supabase.storage.from("coffee-pdfs").getPublicUrl(c.assets![0].storage_path);
                      window.open(data.publicUrl, "_blank");
                    }}
                  >
                    Ver PDF →
                  </button>
                )}
              </div>
            ))
        )}
      </div>
    </main>
  );
}