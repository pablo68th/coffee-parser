"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type RatingLabel = "favorite" | "liked" | "neutral" | "disliked";

type CoffeeRow = {
  id: string;
  process: string | null;
  region: string | null;
  varietal: string | null;
  rating_label: RatingLabel | null;
  created_at: string | null;
};

function normalizeKey(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function prettyLabel(s: string) {
  const t = s.trim();
  if (!t) return t;
  return t
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function inc(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export default function ProfilePage() {
  const router = useRouter();
  const [rows, setRows] = useState<CoffeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const {
      data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
      router.push("/auth");
      setLoading(false);
      return;
      }

      const { data, error } = await supabase
      .from("coffees")
      .select("id, process, region, varietal, rating_label, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

      if (error) {
  alert("No se pudo cargar tu perfil: " + error.message);
  setLoading(false);
  return;
}

      setRows((data as CoffeeRow[]) || []);
      setLoading(false);
      
    }

    load();
  }, [router]);

  const stats = useMemo(() => {
    const likedFav = new Set(["liked", "favorite"]);

    const processCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();
    const varietalCounts = new Map<string, number>();
    const displayName = new Map<string, string>();

    for (const r of rows) {
      if (!r.rating_label || !likedFav.has(r.rating_label)) continue;

      if (r.process) {
  const k = normalizeKey(r.process);
  inc(processCounts, k);
  if (!displayName.has(k)) displayName.set(k, prettyLabel(r.process));
}
if (r.region) {
  const k = normalizeKey(r.region);
  inc(regionCounts, k);
  if (!displayName.has(k)) displayName.set(k, prettyLabel(r.region));
}
if (r.varietal) {
  const k = normalizeKey(r.varietal);
  inc(varietalCounts, k);
  if (!displayName.has(k)) displayName.set(k, prettyLabel(r.varietal));
  }}

  const top = (m: Map<string, number>) =>
  Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => [displayName.get(k) ?? k, v] as [string, number]);
    
  const favorites = rows
  .filter((r) => r.rating_label === "favorite")
  .slice(0, 10);

return {
  totalCoffees: rows.length,
  totalFavorites: rows.filter((r) => r.rating_label === "favorite").length,
  totalLiked: rows.filter((r) => r.rating_label === "liked").length,
  topProcesses: top(processCounts),
  topRegions: top(regionCounts),
  topVarietals: top(varietalCounts),
  favorites,
};

  }, [rows]);

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Perfil de sabor</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Se calcula automáticamente con tus cafés favoritos/liked.
      </p>
      <p style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
  Nota: en estos PDFs las notas de sabor vienen en una gráfica (imagen), por eso no siempre aparecen como texto.
</p>

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
        onClick={() => router.push("/library")}
      >
        ← Volver a Library
      </button>
      
{!loading && rows.length > 0 && (
  <div
    style={{
      marginTop: 16,
      border: "1px solid #ddd",
      borderRadius: 12,
      padding: 14,
    }}
  >
    <div style={{ fontWeight: 900 }}>Resumen</div>

    <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Cafés guardados</span>
        <strong>{stats.totalCoffees}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Favorites</span>
        <strong>{stats.totalFavorites}</strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Liked</span>
        <strong>{stats.totalLiked}</strong>
      </div>
    </div>
  </div>
)}

      {!loading && (
        <FavoritesSection rows={rows} />
      )}
      {!loading && rows.length === 0 && (
        <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 14, opacity: 0.8 }}>
          No hay datos todavía. Guarda cafés y vuelve aquí.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <>
          <Section title="Procesos más liked/favorite" items={stats.topProcesses} />
          <Section title="Regiones más liked/favorite" items={stats.topRegions} />
          <Section title="Varietales más liked/favorite" items={stats.topVarietals} />

   </>
      )}
    </main>
  );
}

function Section(props: { title: string; items: Array<[string, number]> }) {
  return (
    <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
      <div style={{ fontWeight: 900 }}>{props.title}</div>

      {props.items.length === 0 ? (
        <div style={{ marginTop: 8, opacity: 0.7, fontSize: 13 }}>—</div>
      ) : (
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {props.items.map(([name, count]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span>{name}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FavoritesSection(props: { rows: CoffeeRow[] }) {

  const favorites = props.rows.filter((r) => r.rating_label === "favorite");
  const liked = props.rows.filter((r) => r.rating_label === "liked");

  if (favorites.length === 0 && liked.length === 0) return null;

  return (
    <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
      <div style={{ fontWeight: 900 }}>Tu gusto hasta ahora</div>

      {favorites.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 13, opacity: 0.85 }}>⭐ Favorites</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {favorites.map((f) => (
                            <div key={f.id} style={{ fontSize: 14 }}>
                <div style={{ fontWeight: 700 }}>{f.region || "Café"}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                  {f.process || "—"}{f.varietal ? ` · ${f.varietal}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {liked.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, opacity: 0.85 }}>🙂 Liked</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {liked.slice(0, 10).map((f) => (
                            <div key={f.id} style={{ fontSize: 14 }}>
                <div style={{ fontWeight: 700 }}>{f.region || "Café"}</div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
                  {f.process || "—"}{f.varietal ? ` · ${f.varietal}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}