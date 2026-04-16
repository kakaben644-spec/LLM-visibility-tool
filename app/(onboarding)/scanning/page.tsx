"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Competitor {
  name: string;
  url: string;
}

interface Prompt {
  id: string;
  text: string;
}

type ScanStatus = "init" | "running" | "done" | "error" | "timeout";

const LLMS = ["gpt-4o", "claude-sonnet", "gemini-pro"] as const;
type LlmName = (typeof LLMS)[number];

const LLM_LABELS: Record<LlmName, string> = {
  "gpt-4o": "GPT-4o",
  "claude-sonnet": "Claude",
  "gemini-pro": "Gemini",
};

export default function ScanningPage() {
  const router = useRouter();
  const [status, setStatus] = useState<ScanStatus>("init");
  const [progressPct, setProgressPct] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("Initialisation...");
  const [completedLlms, setCompletedLlms] = useState<Set<LlmName>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const doneRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sessionToken = localStorage.getItem("llmv_session");
    if (!sessionToken) {
      router.push("/step-1");
      return;
    }

    const cleanup = () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const run = async () => {
      try {
        // 1. Get session
        const sessionRes = await fetch(
          `/api/onboarding/session?token=${sessionToken}`
        );
        if (!sessionRes.ok) throw new Error("Session introuvable");
        const sessionData = await sessionRes.json() as {
          brand_name: string;
          competitors: Competitor[];
        };
        const { brand_name, competitors } = sessionData;

        // 2. Start audit
        setCurrentLabel("Démarrage de l'audit...");
        const startRes = await fetch("/api/audit/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        });
        if (!startRes.ok) throw new Error("Impossible de démarrer l'audit");
        const startData = await startRes.json() as {
          data: { audit_id: string; prompts: Prompt[] };
        };
        const { audit_id, prompts } = startData.data;
        localStorage.setItem("llmv_current_audit", audit_id);

        // 3. Start polling
        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/audit/${audit_id}/status`);
            if (!statusRes.ok) return;
            const statusData = await statusRes.json() as {
              data: { status: string; progress_pct: number };
            };
            const { status: auditStatus, progress_pct } = statusData.data;
            setProgressPct(progress_pct ?? 0);
            if (auditStatus === "completed" && !doneRef.current) {
              doneRef.current = true;
              cleanup();
              router.push("/dashboard");
            }
          } catch {
            // silent
          }
        }, 2000);

        // 4. Global timeout 60s
        timeoutRef.current = setTimeout(() => {
          if (!doneRef.current) {
            doneRef.current = true;
            cleanup();
            setStatus("timeout");
          }
        }, 60000);

        // 5. Sequential LLM calls
        setStatus("running");
        const totalCalls = LLMS.length * prompts.length;
        let completed = 0;

        for (const llm of LLMS) {
          setCurrentLabel(`Interrogation de ${LLM_LABELS[llm]}...`);
          for (const prompt of prompts) {
            if (doneRef.current) break;
            try {
              await fetch("/api/audit/run-llm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audit_id,
                  prompt_id: prompt.id,
                  prompt_text: prompt.text,
                  llm_name: llm,
                  brand_name,
                  competitors: competitors.map((c) => ({
                    name: c.name,
                    domain: c.url,
                  })),
                }),
              });
            } catch {
              // silent failure, continue
            }
            completed++;
            setCurrentLabel(
              `Interrogation de ${LLM_LABELS[llm]}... (${completed}/${totalCalls} prompts)`
            );
          }
          setCompletedLlms((prev) => new Set([...prev, llm]));
        }
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Erreur inconnue"
        );
        setStatus("error");
      }
    };

    void run();
    return cleanup;
  }, [router]);

  if (status === "error") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0F0F1A] text-white">
        <p className="text-lg font-semibold">Une erreur est survenue</p>
        <p className="text-sm text-white/60">{errorMessage}</p>
        <button
          onClick={() => router.push("/step-1")}
          className="rounded-lg bg-[#6B54FA] px-6 py-2 text-sm font-medium hover:bg-[#5a44e0]"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (status === "timeout") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0F0F1A] text-white">
        <p className="text-lg font-semibold">Délai dépassé</p>
        <p className="text-sm text-white/60">
          L&apos;analyse a pris trop de temps. Merci de réessayer.
        </p>
        <button
          onClick={() => router.push("/step-1")}
          className="rounded-lg bg-[#6B54FA] px-6 py-2 text-sm font-medium hover:bg-[#5a44e0]"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8 bg-[#0F0F1A] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#6B54FA] border-t-transparent" />
        <p className="text-sm text-white/60">{currentLabel}</p>
      </div>
      <div className="w-64">
        <div className="mb-2 flex justify-between text-xs text-white/40">
          <span>Progression</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#6B54FA] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {LLMS.map((llm) => (
          <div key={llm} className="flex items-center gap-3">
            <span className="text-lg">
              {completedLlms.has(llm) ? "✅" : "⏳"}
            </span>
            <span className="text-sm text-white/80">{LLM_LABELS[llm]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
