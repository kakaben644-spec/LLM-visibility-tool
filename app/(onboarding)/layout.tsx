import type { ReactNode } from "react";
import { Sora, DM_Sans } from "next/font/google";

import { Toaster } from "@/components/ui/toaster";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

// ─── Données statiques ────────────────────────────────────────────────────────

const testimonials = [
  {
    quote:
      "Atyla nous a donné une vision claire de notre présence sur les moteurs IA. C'est devenu un pilier de notre stratégie.",
    name: "Lucas M.",
    role: "Growth Marketer · Lemlist",
    initial: "L",
    avatarColor: "bg-[#6B54FA]",
  },
  {
    quote:
      "On gère la visibilité IA de tous nos clients depuis un seul outil. Indispensable pour notre workflow d'agence.",
    name: "Stef R.",
    role: "Fondateur · Agence SEO Paris",
    initial: "S",
    avatarColor: "bg-[#1FC285]",
  },
] as const;

const llmEngines = [
  { name: "ChatGPT", dotColor: "bg-[#1FC285]" },
  { name: "Gemini", dotColor: "bg-[#4285F4]" },
  { name: "Claude", dotColor: "bg-[#E8891D]" },
  { name: "Perplexity", dotColor: "bg-[#6B54FA]" },
  { name: "Grok", dotColor: "bg-[#E5E5E5]" },
] as const;

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${sora.variable} ${dmSans.variable} flex h-screen font-[family-name:var(--font-dm-sans)] antialiased`}
    >
      {/* ── Panneau gauche ── */}
      <div className="w-[740px] shrink-0 overflow-y-auto bg-[#F7F7FA]">
        {children}
      </div>

      {/* ── Panneau droit ── */}
      <div className="flex-1 overflow-hidden bg-[#0F0F1A] flex flex-col items-center pt-10 pb-8">
        {/* 1. Badge */}
        <div className="flex items-center gap-2 rounded-full border border-[#6B54FA]/40 bg-[#1A1530] px-4 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#6B54FA]" />
          <span className="text-xs font-medium text-[#C4B8FF]">
            AI Visibility Analytics
          </span>
        </div>

        {/* 2. Headline */}
        <div className="mt-8 text-center">
          <h2 className="font-[family-name:var(--font-sora)] text-4xl font-bold leading-tight text-white">
            Maîtrisez votre
          </h2>
          <h2 className="font-[family-name:var(--font-sora)] text-4xl font-bold leading-tight text-[#6B54FA]">
            visibilité dans les LLMs
          </h2>
        </div>

        {/* 3. Sous-titre */}
        <p className="mt-3 max-w-[360px] text-center text-sm text-white/60">
          Mesurez, analysez et améliorez votre présence dans ChatGPT, Claude,
          Gemini et Perplexity.
        </p>

        {/* 4. Cards témoignages */}
        <div className="mt-8 flex w-full flex-col gap-3 px-8">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-white/10 bg-white/[0.06] p-4"
            >
              <p className="text-sm leading-relaxed text-white/80">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${t.avatarColor} text-sm font-semibold text-white`}
                >
                  {t.initial}
                </div>
                <div>
                  <p className="text-xs font-medium text-white">{t.name}</p>
                  <p className="text-xs text-white/40">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 5. Barre logos LLMs */}
        <div className="mt-auto w-full px-8">
          <p className="mb-3 text-center text-[10px] tracking-widest text-white/40 uppercase">
            Moteurs IA surveillés
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {llmEngines.map((engine) => (
              <div
                key={engine.name}
                className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/5 px-3 py-1.5"
              >
                <span className={`h-2 w-2 rounded-full ${engine.dotColor}`} />
                <span className="text-xs text-white/60">{engine.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}
