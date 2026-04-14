"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getSessionToken,
  getBrandName,
  setCurrentAuditId,
} from "@/lib/session";

// getBrandName is called only inside useEffect (run()), never in the render body.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LLM_NAMES = ["gpt-4o", "claude-sonnet", "gemini-pro"] as const;
type LlmName = (typeof LLM_NAMES)[number];

const POLL_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface StartAuditPrompt {
  id: string;
  text: string;
  category: string | null;
}

interface StartAuditSuccess {
  ok: true;
  data: {
    audit_id: string;
    brand_id: string;
    prompts: StartAuditPrompt[];
  };
}

interface ApiFailure {
  ok: false;
  error: string;
}

interface RunLlmSuccess {
  ok: true;
  data: {
    llm_response_id: string;
    brand_mentioned: boolean;
    position: number | null;
    latency_ms: number;
  };
}

interface StatusSuccess {
  ok: true;
  data: {
    audit_id: string;
    status: "pending" | "running" | "completed" | "failed";
    progress_pct: number;
    completed_llms: string[];
    failed_llms: string[];
    total_responses: number;
    expected_responses: number;
  };
}

// ---------------------------------------------------------------------------
// Page state machine
// ---------------------------------------------------------------------------

type PageState =
  | { phase: "init" }
  | { phase: "starting"; brandName: string }
  | {
      phase: "running";
      auditId: string;
      completedCalls: number;
      totalCalls: number;
      brandName: string;
    }
  | {
      phase: "polling";
      auditId: string;
      progressPct: number;
      totalResponses: number;
      expectedResponses: number;
      brandName: string;
    }
  | { phase: "error"; message: string; canRetry: boolean }
  | { phase: "done" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScanningPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ phase: "init" });
  // Prevent double-start in strict mode
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    // ── Read localStorage ──────────────────────────────────────────────────
    const sessionToken = getSessionToken();
    const brandName = getBrandName() ?? "";

    if (!sessionToken) {
      router.replace("/step-1");
      return;
    }

    // ── Step 1: Start audit ────────────────────────────────────────────────
    setState({ phase: "starting", brandName });

    let auditId: string;
    let prompts: StartAuditPrompt[];

    try {
      const startRes = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken }),
      });

      const startData = await startRes.json()
      const startJson = startData as StartAuditSuccess | ApiFailure;

      if (!startJson.ok) {
        setState({
          phase: "error",
          message: "Impossible de démarrer l'audit",
          canRetry: false,
        });
        return;
      }

      auditId = startJson.data.audit_id;
      prompts = startJson.data.prompts;
      setCurrentAuditId(auditId);
    } catch {
      setState({
        phase: "error",
        message: "Impossible de démarrer l'audit",
        canRetry: false,
      });
      return;
    }

    // ── Step 2: Run LLM calls sequentially ────────────────────────────────
    const totalCalls = prompts.length * LLM_NAMES.length;
    let completedCalls = 0;

    setState({
      phase: "running",
      auditId,
      completedCalls,
      totalCalls,
      brandName,
    });

    for (const prompt of prompts) {
      for (const llmName of LLM_NAMES) {
        try {
          const body: {
            audit_id: string;
            prompt_id: string;
            prompt_text: string;
            llm_name: LlmName;
            brand_name: string;
            competitors: never[];
          } = {
            audit_id: auditId,
            prompt_id: prompt.id,
            prompt_text: prompt.text,
            llm_name: llmName,
            brand_name: brandName,
            competitors: [],
          };

          const res = await fetch("/api/audit/run-llm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          // Parse but intentionally ignore per-call failures — continue
          const json = (await res.json()) as RunLlmSuccess | ApiFailure;
          void json; // result not needed for progress
        } catch {
          // Swallow individual call errors, keep going
        }

        completedCalls += 1;
        setState({
          phase: "running",
          auditId,
          completedCalls,
          totalCalls,
          brandName,
        });
      }
    }

    // ── Step 3: Poll status ────────────────────────────────────────────────
    setState({
      phase: "polling",
      auditId,
      progressPct: 100,
      totalResponses: completedCalls,
      expectedResponses: totalCalls,
      brandName,
    });

    await pollStatus(auditId, brandName);
  }

  async function pollStatus(auditId: string, brandName: string) {
    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/audit/${auditId}/status`);
        const json = (await res.json()) as StatusSuccess | ApiFailure;

        if (!json.ok) {
          setState({
            phase: "error",
            message: "L'audit a échoué. Veuillez réessayer.",
            canRetry: true,
          });
          return;
        }

        const { status, progress_pct, total_responses, expected_responses } =
          json.data;

        if (status === "completed") {
          setState({ phase: "done" });
          router.replace("/dashboard");
          return;
        }

        if (status === "failed") {
          setState({
            phase: "error",
            message: "L'audit a échoué. Veuillez réessayer.",
            canRetry: true,
          });
          return;
        }

        setState({
          phase: "polling",
          auditId,
          progressPct: progress_pct,
          totalResponses: total_responses,
          expectedResponses: expected_responses,
          brandName,
        });

        await new Promise<void>((resolve) =>
          setTimeout(resolve, POLL_INTERVAL_MS)
        );
        await poll();
      } catch {
        setState({
          phase: "error",
          message: "L'audit a échoué. Veuillez réessayer.",
          canRetry: true,
        });
      }
    };

    await poll();
  }

  // ── Derived display values ───────────────────────────────────────────────

  const progressPct: number = (() => {
    if (state.phase === "running") {
      return state.totalCalls === 0
        ? 0
        : Math.round((state.completedCalls / state.totalCalls) * 100);
    }
    if (state.phase === "polling") return state.progressPct;
    if (state.phase === "done") return 100;
    return 0;
  })();

  const progressLabel: string = (() => {
    if (state.phase === "running") {
      return `Analyse en cours... ${state.completedCalls} / ${state.totalCalls} réponses`;
    }
    if (state.phase === "polling") {
      return `Analyse en cours... ${state.totalResponses} / ${state.expectedResponses} réponses`;
    }
    if (state.phase === "starting") return "Démarrage de l'audit...";
    if (state.phase === "done") return "Terminé !";
    return "";
  })();

  const brandName: string =
    state.phase === "running" ||
    state.phase === "polling" ||
    state.phase === "starting"
      ? state.brandName
      : "";

  // ── Error state ──────────────────────────────────────────────────────────

  if (state.phase === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 8v4M12 16h.01"
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5" />
          </svg>
        </div>
        <p className="text-base font-medium text-[#141420] text-center font-[family-name:var(--font-sora)]">
          {state.message}
        </p>
        {state.canRetry ? (
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-[#6B54FA] hover:bg-[#5A43E8] text-white text-sm font-semibold rounded-xl transition-colors font-[family-name:var(--font-dm-sans)]"
          >
            Réessayer
          </button>
        ) : (
          <button
            onClick={() => router.push("/step-3")}
            className="px-6 py-2.5 border border-[#E0E0EB] text-[#141420] text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors font-[family-name:var(--font-dm-sans)]"
          >
            Retour
          </button>
        )}
      </div>
    );
  }

  // ── Normal / loading state ───────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {/* Brand name heading */}
        {brandName && (
          <h1 className="text-xl font-bold text-[#141420] text-center font-[family-name:var(--font-sora)]">
            Analyse de {brandName}
          </h1>
        )}

        {/* Animated spinner */}
        <div className="w-14 h-14 rounded-full border-[3px] border-[#E0E0EB] border-t-[#6B54FA] animate-spin" />

        {/* Progress bar */}
        <div className="w-full">
          <div className="h-2 w-full rounded-full bg-[#E0E0EB] overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-[#707085] text-center font-[family-name:var(--font-dm-sans)]">
            {progressLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
