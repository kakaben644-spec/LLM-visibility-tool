"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getSessionToken,
  getBrandName,
  getCurrentAuditId,
  setCurrentAuditId,
} from "@/lib/session";

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

interface RerunSuccess {
  ok: true;
  data: {
    audit_id: string;
    prompts: StartAuditPrompt[];
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
      completedLlms: string[];
      totalResponses: number;
      expectedResponses: number;
      brandName: string;
    }
  // "failed" = audit status is failed — has auditId so rerun is possible
  | { phase: "failed"; auditId: string; brandName: string }
  // "error" = unrecoverable setup error (e.g. start failed)
  | { phase: "error"; message: string }
  | { phase: "done" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScanningPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ phase: "init" });
  const [rerunning, setRerunning] = useState(false);

  // Prevent double-start in React strict mode
  const started = useRef(false);
  // Signal abort to async loops on unmount
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    if (started.current) return;
    started.current = true;
    void run();

    return () => {
      abortRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Shared: run LLM calls then poll status ───────────────────────────────

  async function orchestrateLlmCalls(
    auditId: string,
    prompts: StartAuditPrompt[],
    brandName: string
  ): Promise<void> {
    const totalCalls = prompts.length * LLM_NAMES.length;
    let completedCalls = 0;

    setState({ phase: "running", auditId, completedCalls, totalCalls, brandName });

    for (const prompt of prompts) {
      for (const llmName of LLM_NAMES) {
        if (abortRef.current) return;

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

          const json = (await res.json()) as RunLlmSuccess | ApiFailure;
          void json;
        } catch (err) {
          console.error("[run-llm] appel échoué:", err);
          // Swallow individual call errors — keep going
        }

        completedCalls += 1;
        setState({ phase: "running", auditId, completedCalls, totalCalls, brandName });
      }
    }

    if (abortRef.current) return;

    setState({
      phase: "polling",
      auditId,
      progressPct: 100,
      completedLlms: [],
      totalResponses: completedCalls,
      expectedResponses: totalCalls,
      brandName,
    });

    await pollStatus(auditId, brandName);
  }

  // ── Initial flow: start audit then orchestrate ───────────────────────────

  async function run(): Promise<void> {
    const sessionToken = getSessionToken();
    const brandName = getBrandName() ?? "";

    if (!sessionToken) {
      router.replace("/");
      return;
    }

    setState({ phase: "starting", brandName });

    let auditId: string;
    let prompts: StartAuditPrompt[];

    try {
      const startRes = await fetch("/api/audit/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken }),
      });

      const startData = await startRes.json();
      const startJson = startData as StartAuditSuccess | ApiFailure;

      if (!startJson.ok) {
        console.error("[audit/start] erreur API:", startJson.error);
        setState({ phase: "error", message: "Impossible de démarrer l'analyse." });
        return;
      }

      auditId = startJson.data.audit_id;
      prompts = startJson.data.prompts;
      setCurrentAuditId(auditId);
    } catch (err) {
      console.error("[audit/start] erreur réseau:", err);
      setState({ phase: "error", message: "Impossible de démarrer l'analyse." });
      return;
    }

    await orchestrateLlmCalls(auditId, prompts, brandName);
  }

  // ── Poll status until completed / failed ─────────────────────────────────

  async function pollStatus(auditId: string, brandName: string): Promise<void> {
    const sessionToken = getSessionToken();
    const qs = sessionToken
      ? `?session_token=${encodeURIComponent(sessionToken)}`
      : "";

    const poll = async (): Promise<void> => {
      if (abortRef.current) return;

      try {
        const res = await fetch(`/api/audit/${auditId}/status${qs}`);
        const json = (await res.json()) as StatusSuccess | ApiFailure;

        if (!json.ok) {
          console.error("[audit/status] erreur API:", json.error);
          setState({ phase: "failed", auditId, brandName });
          return;
        }

        const { status, progress_pct, completed_llms, total_responses, expected_responses } =
          json.data;

        if (status === "completed") {
          setState({ phase: "done" });
          router.replace("/dashboard/dashboard");
          return;
        }

        if (status === "failed") {
          setState({ phase: "failed", auditId, brandName });
          return;
        }

        setState({
          phase: "polling",
          auditId,
          progressPct: progress_pct,
          completedLlms: completed_llms,
          totalResponses: total_responses,
          expectedResponses: expected_responses,
          brandName,
        });

        await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        await poll();
      } catch (err) {
        console.error("[audit/status] erreur réseau:", err);
        setState({ phase: "failed", auditId, brandName });
      }
    };

    await poll();
  }

  // ── Rerun: POST /api/audit/[id]/rerun then orchestrate ───────────────────

  async function handleRerun(): Promise<void> {
    if (state.phase !== "failed") return;

    const sessionToken = getSessionToken();
    if (!sessionToken) {
      router.replace("/");
      return;
    }

    const { auditId, brandName } = state;
    setRerunning(true);

    try {
      const res = await fetch(`/api/audit/${auditId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken }),
      });

      const json = (await res.json()) as RerunSuccess | ApiFailure;

      if (!json.ok) {
        console.error("[audit/rerun] erreur API:", json.error);
        setRerunning(false);
        return;
      }

      const { audit_id: newAuditId, prompts } = json.data;
      setCurrentAuditId(newAuditId);
      setRerunning(false);

      setState({ phase: "starting", brandName });
      await orchestrateLlmCalls(newAuditId, prompts, brandName);
    } catch (err) {
      console.error("[audit/rerun] erreur réseau:", err);
      setRerunning(false);
    }
  }

  // ── Derived display values ────────────────────────────────────────────────

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
      return `${state.completedCalls} / ${state.totalCalls} réponses reçues`;
    }
    if (state.phase === "polling") {
      return `${state.totalResponses} / ${state.expectedResponses} réponses reçues`;
    }
    if (state.phase === "starting") return "Démarrage de l'analyse…";
    if (state.phase === "done") return "Terminé !";
    return "Analyse en cours, veuillez patienter…";
  })();

  const completedLlms: string[] =
    state.phase === "polling" ? state.completedLlms : [];

  const displayBrandName: string =
    state.phase === "running" ||
    state.phase === "polling" ||
    state.phase === "starting" ||
    state.phase === "failed"
      ? state.brandName
      : "";

  // ── Failed state (retriable via rerun) ───────────────────────────────────

  if (state.phase === "failed") {
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
        <div className="text-center space-y-2">
          <p className="text-base font-medium text-[#141420] font-[family-name:var(--font-sora)]">
            L&apos;analyse a échoué
          </p>
          <p className="text-sm text-[#707085] font-[family-name:var(--font-dm-sans)]">
            Une erreur est survenue pendant l&apos;analyse.
          </p>
        </div>
        <button
          onClick={() => void handleRerun()}
          disabled={rerunning}
          className="px-6 py-2.5 bg-[#6B54FA] hover:bg-[#5A43E8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors font-[family-name:var(--font-dm-sans)] flex items-center gap-2"
        >
          {rerunning && (
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          Réessayer
        </button>
        <a
          href="/"
          className="text-sm text-[#707085] underline underline-offset-2 hover:text-[#141420] transition-colors font-[family-name:var(--font-dm-sans)]"
        >
          Recommencer depuis le début
        </a>
      </div>
    );
  }

  // ── Error state (non-retriable — e.g. audit start failed) ─────────────────

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
        <a
          href="/"
          className="px-6 py-2.5 border border-[#E0E0EB] text-[#141420] text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors font-[family-name:var(--font-dm-sans)]"
        >
          Recommencer depuis le début
        </a>
      </div>
    );
  }

  // ── Loading / progress state ──────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        {displayBrandName && (
          <h1 className="text-xl font-bold text-[#141420] text-center font-[family-name:var(--font-sora)]">
            Analyse de {displayBrandName}
          </h1>
        )}

        <div className="w-14 h-14 rounded-full border-[3px] border-[#E0E0EB] border-t-[#6B54FA] animate-spin" />

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

        {completedLlms.length > 0 && (
          <div className="w-full space-y-1">
            <p className="text-xs text-[#707085] uppercase tracking-wide font-[family-name:var(--font-dm-sans)]">
              Modèles complétés
            </p>
            <ul className="space-y-1">
              {completedLlms.map((llm) => (
                <li
                  key={llm}
                  className="flex items-center gap-2 text-sm text-[#141420] font-[family-name:var(--font-dm-sans)]"
                >
                  <span className="text-green-500">✓</span>
                  {llm}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
