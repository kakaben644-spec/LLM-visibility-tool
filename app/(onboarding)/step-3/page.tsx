"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSessionToken } from "@/lib/session";
import { Button } from "@/components/ui/button";
import StepIndicator from "@/components/features/onboarding/StepIndicator";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Competitor {
  name: string;
  url: string;
}

type PageState =
  | { status: "loading" }
  | { status: "success"; competitors: Competitor[] }
  | { status: "error"; message: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step3Page() {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    void runDetection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runDetection() {
    const sessionToken = getSessionToken();

    if (!sessionToken) {
      router.replace("/step-1");
      return;
    }

    try {
      const res = await fetch("/api/detect-competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken }),
      });

      const json = (await res.json()) as
        | { ok: true; data: { competitors: Competitor[] } }
        | { ok: false; error: string };

      if (!json.ok) {
        setState({ status: "error", message: json.error });
        return;
      }

      setState({ status: "success", competitors: json.data.competitors });
    } catch {
      setState({
        status: "error",
        message: "Une erreur est survenue lors de la détection des concurrents.",
      });
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
        <StepIndicator currentStep={3} />
      </div>

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-[#141420] font-[family-name:var(--font-sora)]">
          Vos concurrents détectés
        </h1>
        <p className="text-sm text-[#707085] mt-1 font-[family-name:var(--font-dm-sans)]">
          Ces concurrents seront inclus dans votre audit de visibilité IA.
        </p>
      </div>

      <div className="mt-8 flex-1 overflow-y-auto flex flex-col">
        {state.status === "loading" && <LoadingView />}
        {state.status === "error" && <ErrorView message={state.message} />}
        {state.status === "success" && (
          <SuccessView competitors={state.competitors} />
        )}
      </div>

      <Button
        disabled={state.status !== "success"}
        onClick={() => router.push("/scanning")}
        className="mt-4 w-full h-13 bg-[#6B54FA] hover:bg-[#5A43E8] text-white font-semibold rounded-xl text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Continuer →
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
        Détection de vos concurrents...
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
      <p className="text-sm text-[#141420] font-medium text-center max-w-[280px] font-[family-name:var(--font-dm-sans)]">
        {message}
      </p>
    </div>
  );
}

function SuccessView({ competitors }: { competitors: Competitor[] }) {
  if (competitors.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
        <p className="text-sm text-[#707085] text-center font-[family-name:var(--font-dm-sans)]">
          Aucun concurrent détecté automatiquement.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {competitors.map((competitor, idx) => (
        <CompetitorCard key={idx} competitor={competitor} />
      ))}
    </div>
  );
}

function CompetitorCard({ competitor }: { competitor: Competitor }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#E0E0EB] bg-white p-4">
      {/* Logo Clearbit avec fallback initiales */}
      <CompetitorLogo name={competitor.name} url={competitor.url} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#141420] font-[family-name:var(--font-sora)] truncate">
          {competitor.name}
        </p>
        <p className="text-xs text-[#707085] font-[family-name:var(--font-dm-sans)] truncate">
          {competitor.url}
        </p>
      </div>
    </div>
  );
}

function CompetitorLogo({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false);

  // Initials fallback
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Deterministic color from name
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-orange-100 text-orange-700",
    "bg-pink-100 text-pink-700",
    "bg-cyan-100 text-cyan-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colorClass = colors[Math.abs(hash) % colors.length]!;

  if (failed) {
    return (
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colorClass}`}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://logo.clearbit.com/${url}`}
      alt={`${name} logo`}
      width={40}
      height={40}
      className="w-10 h-10 rounded-full object-contain shrink-0 bg-white border border-[#E0E0EB]"
      onError={() => setFailed(true)}
    />
  );
}
