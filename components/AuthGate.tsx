"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // /auth siempre debe quedar libre
      if (!session && pathname !== "/auth") {
        router.replace("/auth");
        return;
      }

      // si ya hay sesión y el usuario está en /auth, mándalo a home
      if (session && pathname === "/auth") {
        router.replace("/");
        return;
      }

      setChecking(false);
    }

    checkSession();
  }, [pathname, router]);

  if (checking) {
    return (
      <main
        style={{
          maxWidth: 420,
          margin: "0 auto",
          padding: 16,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            marginTop: 24,
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 14,
            fontWeight: 800,
          }}
        >
          Cargando...
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
