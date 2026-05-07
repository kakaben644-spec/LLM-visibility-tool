import Link from "next/link";

// ─── Static data ──────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white flex flex-col">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6B54FA] shrink-0">
            <span className="text-sm font-bold text-white font-[family-name:var(--font-sora)]">
              G
            </span>
          </div>
          <span className="text-sm font-semibold text-white font-[family-name:var(--font-sora)]">
            GEO Doctor
          </span>
        </div>
        <Link
          href="/step-1"
          className="rounded-xl bg-[#6B54FA] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5A43E8] transition-colors"
        >
          Commencer gratuitement →
        </Link>
      </header>

      {/* ── Hero ── */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center">

        {/* Badge */}
        <div className="flex items-center gap-2 rounded-full border border-[#6B54FA]/40 bg-[#1A1530] px-4 py-2 mb-8">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#6B54FA]" />
          <span className="text-xs font-medium text-[#C4B8FF] font-[family-name:var(--font-dm-sans)]">
            AI Visibility Analytics
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-[family-name:var(--font-sora)] text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
          Maîtrisez votre
          <br />
          <span className="text-[#6B54FA]">visibilité dans les LLMs</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-5 max-w-[480px] text-base text-white/60 leading-relaxed">
          Mesurez, analysez et améliorez votre présence dans ChatGPT, Claude,
          Gemini et Perplexity. Lancez votre premier audit en 2 minutes.
        </p>

        {/* CTA */}
        <Link
          href="/step-1"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#6B54FA] px-8 py-4 text-base font-semibold text-white hover:bg-[#5A43E8] transition-colors shadow-lg shadow-[#6B54FA]/30"
        >
          Lancer mon audit gratuit
          <span aria-hidden>→</span>
        </Link>
        <p className="mt-3 text-xs text-white/30">
          Sans inscription · Résultats en 2 minutes
        </p>

        {/* ── Testimonials ── */}
        <div className="mt-16 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-xl border border-white/10 bg-white/[0.06] p-5 text-left"
            >
              <span className="text-lg text-[#6B54FA] leading-none">❝</span>
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                {t.quote}
              </p>
              <div className="mt-4 flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.avatarColor} text-sm font-bold text-white font-[family-name:var(--font-sora)]`}
                >
                  {t.initial}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-white/40">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ── LLM logos ── */}
      <footer className="shrink-0 pb-8 text-center">
        <p className="mb-4 text-[10px] tracking-widest text-white/40 uppercase">
          Moteurs IA surveillés
        </p>
        <div className="flex flex-wrap justify-center gap-2 px-4">
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
      </footer>

    </div>
  );
}
