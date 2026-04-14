"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Competitor {
  name: string;
  domain: string;
}

interface Prompt {
  id: string;
  text: string;
}

type ScanStatus = "idle" | "starting" | "scanning" | "completed" | "error";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (!token || token.trim() === "") {
      router.replace("/step-1");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <h1 className="text-2xl font-semibold">Analyse en cours...</h1>
      <p className="text-muted-foreground text-center">
        Nous interrogeons les LLMs, merci de patienter.
      </p>
    </div>
  );
}
