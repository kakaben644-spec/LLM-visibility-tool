"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function PostSignUpPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (!userId) {
      router.replace("/sign-up");
      return;
    }

    const migrate = async () => {
      const sessionToken =
        typeof window !== "undefined"
          ? localStorage.getItem("llmv_session")
          : null;

      if (sessionToken) {
        await fetch("/api/auth/migrate-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        }).catch(() => {
          // Migration best-effort : on redirige quoi qu'il arrive
        });
        localStorage.removeItem("llmv_session");
      }

      router.replace("/recommandations");
    };

    migrate();
  }, [isLoaded, userId, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-white/60 text-sm animate-pulse">Chargement…</p>
    </div>
  );
}
