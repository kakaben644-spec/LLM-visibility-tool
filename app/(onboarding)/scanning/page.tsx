"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Competitor {
  name: string;
  domain: string;
}

interface Prompt {
  id: string;
  text: string;
  category: string | null;
}

type ScanStatus = "idle" | "starting" | "scanning" | "completed" | "error";

export default function Page() {
  const router = useRouter();

  const [sessionData, setSessionData] = useState<{
    brandName: string;
    competitors: Competitor[];
  } | null>(null);
  const [auditData, setAuditData] = useState<{
    auditId: string;
    prompts: Prompt[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedCalls, setCompletedCalls] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    if (!token || token.trim() === "") {
      router.replace("/step-1");
      return;
    }

    async function run() {
      // Phase 1 — Fetch the onboarding session
      let sessionRes: Response;
      try {
        sessionRes = await fetch(
          `/api/onboarding/session?token=${encodeURIComponent(token as string)}`
        );
      } catch {
        setError("Impossible de récupérer la session. Vérifie ta connexion et réessaie.");
        return;
      }

      if (!sessionRes.ok) {
        setError("Session introuvable ou expirée. Merci de recommencer l'onboarding.");
        return;
      }

      let sessionJson: unknown;
      try {
        sessionJson = await sessionRes.json();
      } catch {
        setError("Réponse invalide du serveur. Merci de réessayer.");
        return;
      }

      const sessionPayload =
        sessionJson !== null &&
        typeof sessionJson === "object" &&
        "data" in sessionJson
          ? (sessionJson as { data: unknown }).data
          : sessionJson;

      if (
        sessionPayload === null ||
        typeof sessionPayload !== "object" ||
        !("brand_name" in sessionPayload)
      ) {
        setError("Données de session invalides. Merci de recommencer l'onboarding.");
        return;
      }

      const raw = sessionPayload as Record<string, unknown>;

      const brandName = raw["brand_name"];
      if (typeof brandName !== "string" || brandName.trim() === "") {
        setError("Marque introuvable dans la session. Merci de recommencer depuis l'étape 1.");
        return;
      }

      const rawCompetitors = Array.isArray(raw["competitors"])
        ? raw["competitors"]
        : [];

      const competitors: Competitor[] = rawCompetitors.flatMap((item) => {
        if (
          item !== null &&
          typeof item === "object" &&
          "name" in item &&
          "domain" in item &&
          typeof (item as Record<string, unknown>)["name"] === "string" &&
          typeof (item as Record<string, unknown>)["domain"] === "string" &&
          ((item as Record<string, unknown>)["name"] as string).trim() !== "" &&
          ((item as Record<string, unknown>)["domain"] as string).trim() !== ""
        ) {
          return [
            {
              name: (item as Record<string, unknown>)["name"] as string,
              domain: (item as Record<string, unknown>)["domain"] as string,
            },
          ];
        }
        return [];
      });

      setSessionData({ brandName: brandName.trim(), competitors });

      // Phase 2 — Start the audit
      let auditRes: Response;
      try {
        auditRes = await fetch("/api/audit/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: token }),
        });
      } catch {
        setError("Impossible de démarrer l'audit. Vérifie ta connexion et réessaie.");
        return;
      }

      if (!auditRes.ok) {
        setError("Erreur lors du démarrage de l'audit. Merci de réessayer.");
        return;
      }

      let auditJson: unknown;
      try {
        auditJson = await auditRes.json();
      } catch {
        setError("Réponse invalide du serveur lors du démarrage de l'audit.");
        return;
      }

      const auditPayload =
        auditJson !== null &&
        typeof auditJson === "object" &&
        "data" in auditJson
          ? (auditJson as { data: unknown }).data
          : auditJson;

      if (auditPayload === null || typeof auditPayload !== "object") {
        setError("Données d'audit invalides reçues du serveur.");
        return;
      }

      const auditRaw = auditPayload as Record<string, unknown>;
      const auditId = auditRaw["audit_id"];

      if (typeof auditId !== "string" || auditId.trim() === "") {
        setError("Identifiant d'audit manquant. Merci de réessayer.");
        return;
      }

      const rawPrompts = Array.isArray(auditRaw["prompts"])
        ? auditRaw["prompts"]
        : [];

      const prompts: Prompt[] = rawPrompts.flatMap((item) => {
        if (
          item !== null &&
          typeof item === "object" &&
          "id" in item &&
          "text" in item &&
          typeof (item as Record<string, unknown>)["id"] === "string" &&
          typeof (item as Record<string, unknown>)["text"] === "string"
        ) {
          const p = item as Record<string, unknown>;
          return [
            {
              id: p["id"] as string,
              text: p["text"] as string,
              category:
                typeof p["category"] === "string" ? p["category"] : null,
            },
          ];
        }
        return [];
      });

      if (prompts.length === 0) {
        setError("Aucun prompt disponible pour l'audit. Merci de revenir à l'étape 2.");
        return;
      }

      const resolvedAuditId = auditId.trim();
      const resolvedSessionData = { brandName: brandName.trim(), competitors };
      localStorage.setItem("llmv_current_audit", resolvedAuditId);
      setAuditData({ auditId: resolvedAuditId, prompts });

      await startScan(resolvedAuditId, prompts, resolvedSessionData);
    }

    const LLM_NAMES = ["gpt-4o", "claude-sonnet", "gemini-pro"] as const;
    const GLOBAL_TIMEOUT_MS = 60_000;

    async function startScan(
      auditId: string,
      prompts: Prompt[],
      sd: { brandName: string; competitors: Competitor[] }
    ) {
      const startTime = Date.now();

      for (const prompt of prompts) {
        for (const llm of LLM_NAMES) {
          if (Date.now() - startTime >= GLOBAL_TIMEOUT_MS) {
            setTimedOut(true);
            return;
          }

          try {
            await fetch("/api/audit/run-llm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audit_id: auditId,
                prompt_id: prompt.id,
                prompt_text: prompt.text,
                llm_name: llm,
                brand_name: sd.brandName,
                competitors: sd.competitors,
              }),
            });
          } catch (err) {
            console.error(
              `[startScan] Error for prompt ${prompt.id} / ${llm}:`,
              err
            );
          }

          setCompletedCalls((prev) => prev + 1);
        }
      }
    }

    run();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-center text-destructive max-w-sm">{error}</p>
        <Button variant="outline" onClick={() => router.replace("/step-1")}>
          Recommencer
        </Button>
      </div>
    );
  }

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
