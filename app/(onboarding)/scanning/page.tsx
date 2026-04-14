"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
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
  const [pollData, setPollData] = useState<{
    status: string;
    progressPct: number;
    completedLlms: string[];
    failedLlms: string[];
  } | null>(null);

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

  // Polling effect — starts once auditData is available
  useEffect(() => {
    if (!auditData) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/audit/${auditData.auditId}/status`);
        if (!res.ok) {
          console.error("[polling] non-2xx response:", res.status);
          return;
        }
        const json: unknown = await res.json();

        const payload =
          json !== null &&
          typeof json === "object" &&
          "data" in json
            ? (json as { data: unknown }).data
            : json;

        if (payload === null || typeof payload !== "object") return;

        const p = payload as Record<string, unknown>;
        const status = typeof p["status"] === "string" ? p["status"] : "";
        const progressPct =
          typeof p["progress_pct"] === "number" ? p["progress_pct"] : 0;
        const completedLlms = Array.isArray(p["completed_llms"])
          ? (p["completed_llms"] as unknown[]).filter(
              (x): x is string => typeof x === "string"
            )
          : [];
        const failedLlms = Array.isArray(p["failed_llms"])
          ? (p["failed_llms"] as unknown[]).filter(
              (x): x is string => typeof x === "string"
            )
          : [];

        setPollData({ status, progressPct, completedLlms, failedLlms });

        if (status === "completed") {
          clearInterval(intervalId);
          router.replace("/dashboard");
        }
      } catch (err) {
        console.error("[polling] fetch error:", err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [auditData, router]);

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

  const LLM_LABELS: { key: string; label: string }[] = [
    { key: "gpt-4o", label: "GPT-4o" },
    { key: "claude-sonnet", label: "Claude" },
    { key: "gemini-pro", label: "Gemini" },
  ];

  const totalCalls = (auditData?.prompts.length ?? 0) * 3;
  const progressPct = pollData?.progressPct ?? 0;

  function LlmBadge({ llmKey, label }: { llmKey: string; label: string }) {
    const done = pollData?.completedLlms.includes(llmKey) ?? false;
    const failed = pollData?.failedLlms.includes(llmKey) ?? false;

    return (
      <div className="flex flex-col items-center gap-1">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : failed ? (
          <XCircle className="h-5 w-5 text-destructive" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
        )}
        <span
          className={
            done
              ? "text-xs font-medium text-green-600"
              : failed
                ? "text-xs font-medium text-destructive"
                : "text-xs text-muted-foreground"
          }
        >
          {label}
        </span>
      </div>
    );
  }

  let statusText: string;
  if (timedOut) {
    statusText =
      "Délai dépassé — certains résultats sont peut-être incomplets.";
  } else if (!pollData) {
    statusText = "Initialisation de l'analyse...";
  } else {
    statusText = `Interrogation des LLMs... (${completedCalls} / ${totalCalls} prompts traités)`;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      {/* A — Brand + LLM logos row */}
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-full bg-primary/10 px-5 py-2 text-base font-semibold text-primary ring-1 ring-primary/20">
          {sessionData?.brandName ?? "…"}
        </div>
        <div className="flex gap-6">
          {LLM_LABELS.map(({ key, label }) => (
            <LlmBadge key={key} llmKey={key} label={label} />
          ))}
        </div>
      </div>

      {/* B — Progress bar */}
      <div className="w-full max-w-sm">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>Progression</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* C — Status text */}
      <p className="text-center text-sm text-muted-foreground max-w-xs">
        {statusText}
      </p>

      {/* D — Timeout warning */}
      {timedOut && (
        <div className="w-full max-w-sm rounded-lg border border-amber-300 bg-amber-50 p-4 text-center">
          <p className="mb-3 text-sm text-amber-800">
            L&apos;analyse a pris trop de temps. Les résultats partiels sont
            disponibles.
          </p>
          <Button
            variant="outline"
            onClick={() => router.replace("/dashboard")}
          >
            Voir les résultats
          </Button>
        </div>
      )}
    </div>
  );
}
