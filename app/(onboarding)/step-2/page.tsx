"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSessionToken, getBrandName, getBrandUrl } from "@/lib/session";
import { Button } from "@/components/ui/button";
import StepIndicator from "@/components/features/onboarding/StepIndicator";

// ─── Types ────────────────────────────────────────────────────────────────────

type PromptCategory = "Découverte" | "Comparatif" | "Réputation" | "Éducatif";

interface GeneratedPrompt {
  text: string;
  category: PromptCategory;
}

type PageState =
  | { status: "loading" }
  | {
      status: "success";
      prompts: GeneratedPrompt[];
      scrapeFailed: boolean;
      canContinue: boolean;
      patchError: string | null;
    }
  | { status: "error"; message: string };

// ─── Category badge config ────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<
  PromptCategory,
  { bg: string; text: string; dot: string }
> = {
  Découverte: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  Comparatif: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  Réputation: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  Éducatif: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step2Page() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runGeneration() {
    const sessionToken = getSessionToken();
    const brandName = getBrandName();
    const brandUrl = getBrandUrl();

    if (!sessionToken || !brandName) {
      router.replace("/step-1");
      return;
    }

    let scrapedContent = "";
    let scrapeFailed = false;

    // 1. Scrape brand URL
    if (brandUrl) {
      try {
        const scrapeRes = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: brandUrl }),
        });
        if (scrapeRes.ok) {
          const scrapeJson = (await scrapeRes.json()) as {
            ok: true;
            data: { content: string; url: string };
          };
          scrapedContent = scrapeJson.data.content;
        } else {
          scrapeFailed = true;
        }
      } catch {
        scrapeFailed = true;
      }
    } else {
      scrapeFailed = true;
    }

    // 2. Generate prompts
    try {
      const genRes = await fetch("/api/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          scraped_content: scrapedContent,
          brand_name: brandName,
        }),
      });

      if (!genRes.ok) {
        const errJson = (await genRes.json()) as { error?: string };
        setState({
          status: "error",
          message: errJson.error ?? "Impossible de générer les questions.",
        });
        return;
      }

      const genJson = (await genRes.json()) as {
        ok: true;
        data: { prompts: GeneratedPrompt[] };
      };

      const prompts = genJson.data.prompts;

      // Show prompts immediately, then PATCH session
      setState({
        status: "success",
        prompts,
        scrapeFailed,
        canContinue: false,
        patchError: null,
      });

      // 3. PATCH session with generated prompts
      try {
        const patchRes = await fetch("/api/onboarding/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_token: sessionToken,
            current_step: 2,
            generated_prompts: prompts,
            selected_prompts: prompts,
          }),
        });

        if (!patchRes.ok) {
          const patchErr = (await patchRes.json()) as { error?: string };
          setState((prev) =>
            prev.status === "success"
              ? {
                  ...prev,
                  patchError:
                    patchErr.error ??
                    "Impossible d'enregistrer les questions. Réessaie.",
                }
              : prev
          );
          return;
        }

        setState((prev) =>
          prev.status === "success" ? { ...prev, canContinue: true } : prev
        );
      } catch {
        setState((prev) =>
          prev.status === "success"
            ? {
                ...prev,
                patchError:
                  "Impossible d'enregistrer les questions. Réessaie.",
              }
            : prev
        );
      }
    } catch {
      setState({
        status: "error",
        message: "Une erreur est survenue lors de la génération des questions.",
      });
    }
  }

  async function handleContinue() {
    if (state.status !== "success") return;
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      router.replace("/step-1");
      return;
    }
    setIsSaving(true);
    try {
      const patchRes = await fetch("/api/onboarding/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          current_step: 3,
          selected_prompts: state.prompts,
        }),
      });
      if (!patchRes.ok) {
        const patchErr = (await patchRes.json()) as { error?: string };
        setState((prev) =>
          prev.status === "success"
            ? {
                ...prev,
                patchError:
                  patchErr.error ??
                  "Impossible d'enregistrer les questions sélectionnées. Réessaie.",
              }
            : prev
        );
        return;
      }
      router.push("/step-3");
    } catch {
      setState((prev) =>
        prev.status === "success"
          ? {
              ...prev,
              patchError:
                "Impossible d'enregistrer les questions sélectionnées. Réessaie.",
            }
          : prev
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full px-12 py-10">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex w-9 h-9 items-center justify-center rounded-lg bg-[#6B54FA] shrink-0">
          <span className="text-white text-sm font-bold font-[family-name:var(--font-sora)]">
            V
          </span>
        </div>
        <span className="text-sm font-semibold text-[#141420] font-[family-name:var(--font-sora)]">
          LLM Visibility
        </span>
      </div>

      <div className="mt-8">
        <StepIndicator currentStep={2} />
      </div>

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-[#141420] font-[family-name:var(--font-sora)]">
          Questions clés de votre marque
        </h1>
        <p className="text-sm text-[#707085] mt-1 font-[family-name:var(--font-dm-sans)]">
          Ces questions seront posées aux LLMs pour mesurer votre visibilité.
        </p>
      </div>

      <div className="mt-8 flex-1 overflow-y-auto flex flex-col">
        {state.status === "loading" && <LoadingView />}
        {state.status === "error" && <ErrorView message={state.message} />}
        {state.status === "success" && (
          <SuccessView
            prompts={state.prompts}
            scrapeFailed={state.scrapeFailed}
          />
        )}
      </div>

      {state.status === "success" && state.patchError && (
        <p className="mt-4 text-xs text-red-600 text-center font-[family-name:var(--font-dm-sans)]">
          {state.patchError}
        </p>
      )}

      <Button
        disabled={state.status !== "success" || !state.canContinue || isSaving}
        onClick={() => void handleContinue()}
        className="mt-4 w-full h-13 bg-[#6B54FA] hover:bg-[#5A43E8] text-white font-semibold rounded-xl text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSaving ? "Enregistrement..." : "Continuer →"}
      </Button>
    </div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function LoadingView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
      <div className="w-10 h-10 rounded-full border-[3px] border-[#E0E0EB] border-t-[#6B54FA] animate-spin" />
      <p className="text-sm font-medium text-[#707085] font-[family-name:var(--font-dm-sans)]">
        Génération des questions clés...
      </p>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 6v4M10 14h.01"
            stroke="#EF4444"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="10" cy="10" r="8.5" stroke="#EF4444" strokeWidth="1.5" />
        </svg>
      </div>
      <p className="text-sm text-[#141420] font-medium text-center max-w-[280px]">
        {message}
      </p>
    </div>
  );
}

function SuccessView({
  prompts,
  scrapeFailed,
}: {
  prompts: GeneratedPrompt[];
  scrapeFailed: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {scrapeFailed && (
        <div className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0"
          >
            <path
              d="M8 5.5v3M8 10.5h.01"
              stroke="#D97706"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M7.134 2.5L1.5 12.5A1 1 0 0 0 2.366 14h11.268a1 1 0 0 0 .866-1.5L8.866 2.5a1 1 0 0 0-1.732 0Z"
              stroke="#D97706"
              strokeWidth="1.3"
            />
          </svg>
          <p className="text-xs text-amber-700 font-[family-name:var(--font-dm-sans)]">
            Génération basée sur le nom de la marque uniquement
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {prompts.map((prompt, idx) => (
          <PromptCard key={idx} prompt={prompt} />
        ))}
      </div>
    </div>
  );
}

function PromptCard({ prompt }: { prompt: GeneratedPrompt }) {
  const styles = CATEGORY_STYLES[prompt.category] ?? {
    bg: "bg-gray-50",
    text: "text-gray-700",
    dot: "bg-gray-400",
  };

  return (
    <div className="rounded-xl border border-[#E0E0EB] bg-white p-4 flex flex-col gap-2.5">
      <p className="text-sm text-[#141420] leading-relaxed font-[family-name:var(--font-dm-sans)]">
        {prompt.text}
      </p>
      <div
        className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 ${styles.bg}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        <span className={`text-[11px] font-medium ${styles.text}`}>
          {prompt.category}
        </span>
      </div>
    </div>
  );
}
