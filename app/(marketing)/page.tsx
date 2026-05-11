import Link from "next/link";

// ─── Static data ──────────────────────────────────────────────────────────────

const stats = [
  { value: "1.8Md", label: "Recherches IA / semaine" },
  { value: "67%", label: "Des utilisateurs font confiance aux réponses LLM" },
  { value: "73%", label: "Des achats B2B influencés par l'IA" },
  { value: "< 2min", label: "Pour votre premier audit" },
] as const;

const steps = [
  {
    number: "01",
    icon: "◉",
    title: "Configurez votre marque",
    description:
      "Entrez votre URL. Notre IA scrape votre site et comprend votre positionnement en quelques secondes.",
  },
  {
    number: "02",
    icon: "◈",
    title: "Choisissez vos questions",
    description:
      "L'IA génère automatiquement les questions que vos prospects posent aux LLMs sur votre marché.",
  },
  {
    number: "03",
    icon: "⬡",
    title: "Scan des moteurs IA",
    description:
      "GPT-4o, Claude, Gemini et Perplexity sont interrogés simultanément. Résultats en moins de 2 minutes.",
  },
  {
    number: "04",
    icon: "◆",
    title: "Plan d'action personnalisé",
    description:
      "Recevez votre score de visibilité et des recommandations concrètes pour apparaître en première position.",
  },
] as const;

const features = [
  {
    tag: "Audit IA",
    title: "Votre score de visibilité en temps réel",
    description:
      "Interrogez GPT-4o, Claude, Gemini et Perplexity simultanément. Obtenez un score composite basé sur le taux de mention, la position et le sentiment — et comparez-vous à vos concurrents.",
    stats: [
      { value: "3 LLMs", label: "interrogés en parallèle" },
      { value: "< 2min", label: "pour un audit complet" },
    ],
    mockTitle: "Audit IA — Aperçu",
    mockRows: [
      { name: "GEO Doctor", pct: 67, width: "w-[72%]", color: "bg-[#6B54FA]" },
      { name: "Concurrent A", pct: 45, width: "w-[45%]", color: "bg-white/20" },
      { name: "Concurrent B", pct: 23, width: "w-[53%]", color: "bg-white/20" },
      { name: "Concurrent C", pct: 12, width: "w-[60%]", color: "bg-white/20" },
    ],
    reverse: false,
  },
  {
    tag: "Intelligence Concurrentielle",
    title: "Voyez où vos rivaux vous devancent",
    description:
      "Détection automatique des concurrents depuis votre URL. Benchmark de visibilité par LLM, par catégorie de prompt et par secteur. Identifiez exactement les requêtes où vous êtes absent.",
    stats: [
      { value: "5", label: "concurrents analysés" },
      { value: "100%", label: "automatisé" },
    ],
    mockTitle: "Intelligence Concurrentielle — Aperçu",
    mockRows: [
      { name: "GEO Doctor", pct: 67, width: "w-[72%]", color: "bg-[#6B54FA]" },
      { name: "Concurrent A", pct: 45, width: "w-[45%]", color: "bg-white/20" },
      { name: "Concurrent B", pct: 23, width: "w-[53%]", color: "bg-white/20" },
      { name: "Concurrent C", pct: 12, width: "w-[60%]", color: "bg-white/20" },
    ],
    reverse: true,
  },
  {
    tag: "Plan d'Action",
    title: "Des recommandations actionnables générées par IA",
    description:
      "Claude analyse vos résultats et génère un plan d'action priorisé : contenus à créer, topics à couvrir, canaux à investir. Chaque recommandation est liée à un LLM et à une intention de recherche spécifique.",
    stats: [
      { value: "3-5", label: "recommandations par audit" },
      { value: "↑ 40%", label: "de visibilité moyenne" },
    ],
    mockTitle: "Plan d'Action — Aperçu",
    mockRows: [
      { name: "GEO Doctor", pct: 67, width: "w-[72%]", color: "bg-[#6B54FA]" },
      { name: "Concurrent A", pct: 45, width: "w-[45%]", color: "bg-white/20" },
      { name: "Concurrent B", pct: 23, width: "w-[53%]", color: "bg-white/20" },
      { name: "Concurrent C", pct: 12, width: "w-[60%]", color: "bg-white/20" },
    ],
    reverse: false,
  },
] as const;

const testimonials = [
  {
    quote:
      "GEO Doctor nous a révélé que Lemlist était absent de 70% des réponses sur notre marché. En 3 mois, on est passé à #1 sur ChatGPT pour 'meilleur outil cold email'.",
    name: "Lucas M.",
    role: "Growth Marketer · Lemlist",
    initial: "L",
    color: "bg-[#6B54FA]",
  },
  {
    quote:
      "On gère la visibilité IA de 12 clients depuis une seule interface. C'est devenu notre argument différenciant numéro 1 en closing. Les clients voient les résultats en live.",
    name: "Stef R.",
    role: "Fondateur · Agence SEO Paris",
    initial: "S",
    color: "bg-[#1FC285]",
  },
  {
    quote:
      "En 48h, on a identifié 8 angles de contenu où nos concurrents apparaissaient et pas nous. Le plan d'action IA a été notre feuille de route Q1 entier.",
    name: "Marie D.",
    role: "CMO · Clay",
    initial: "M",
    color: "bg-[#E8891D]",
  },
] as const;

const faqs = [
  {
    question: "Comment fonctionne le score de visibilité ?",
    answer:
      "Le score est calculé sur 100 à partir de 3 métriques : taux de mention dans les réponses LLM (50%), position moyenne de la mention (30%) et analyse de sentiment Claude (20%).",
    open: true,
  },
  {
    question: "Quels LLMs sont surveillés ?",
    answer:
      "GEO Doctor interroge actuellement Claude Haiku et Mistral. La prise en charge de GPT-4o, Gemini et Perplexity est prévue prochainement.",
    open: false,
  },
  {
    question: "Combien de temps prend un audit ?",
    answer:
      "Un audit complet prend moins de 2 minutes. Nos moteurs LLM sont interrogés en parallèle pour vous fournir des résultats le plus rapidement possible.",
    open: false,
  },
  {
    question: "Puis-je analyser plusieurs marques ?",
    answer:
      "Oui. Chaque compte peut gérer plusieurs marques. L'historique de chaque audit est conservé et accessible depuis votre tableau de bord.",
    open: false,
  },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F0F1A]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6B54FA]">
              <span className="text-sm font-bold text-white font-[family-name:var(--font-sora)]">G</span>
            </div>
            <span className="text-sm font-semibold text-white font-[family-name:var(--font-sora)]">GEO Doctor</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#fonctionnalites" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#temoignages" className="hover:text-white transition-colors">Témoignages</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="hidden sm:inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/step-1"
              className="rounded-lg bg-[#6B54FA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5A43E8] transition-colors"
            >
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-24 text-center">
        {/* Background glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-[#6B54FA]/20 blur-[120px]" />
          <div className="absolute right-0 top-1/2 h-[300px] w-[400px] rounded-full bg-[#6B54FA]/10 blur-[100px]" />
          <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-[#1FC285]/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#6B54FA]/40 bg-[#6B54FA]/10 px-4 py-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#6B54FA]" />
            <span className="text-xs font-medium text-[#C4B8FF]">Nouveau · GEO Doctor — LLMO Platform</span>
          </div>

          {/* Headline */}
          <h1 className="font-[family-name:var(--font-sora)] text-5xl font-bold leading-tight lg:text-7xl">
            Votre marque est-elle
            <br />
            <span className="text-[#6B54FA]">invisible aux LLMs ?</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/60 leading-relaxed">
            Mesurez votre visibilité dans ChatGPT, Claude, Gemini et Perplexity. Identifiez vos angles morts et transformez chaque requête IA en opportunité de croissance.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/step-1"
              className="w-full sm:w-auto rounded-xl bg-[#6B54FA] px-7 py-4 text-base font-semibold text-white hover:bg-[#5A43E8] transition-colors shadow-lg shadow-[#6B54FA]/30"
            >
              Essayer gratuitement →
            </Link>
            <Link
              href="/step-1"
              className="w-full sm:w-auto rounded-xl border border-white/20 px-7 py-4 text-base font-semibold text-white/80 hover:border-white/40 hover:text-white transition-colors"
            >
              Voir une démo ▶
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/40">
            <span>✓ Gratuit 7 jours</span>
            <span>✓ Sans carte bancaire</span>
            <span>✓ Résultats en 2 min</span>
          </div>

          {/* Mock dashboard */}
          <div className="mt-14 mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/5 overflow-hidden shadow-2xl">
            {/* Title bar */}
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/60" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <span className="h-3 w-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-white/30">GEO Doctor — Dashboard</span>
              <div className="w-14" />
            </div>
            {/* Score cards */}
            <div className="grid grid-cols-3 gap-px bg-white/5 p-4">
              <div className="rounded-lg bg-white/5 p-4 text-left">
                <p className="text-[10px] text-white/40 uppercase tracking-wide">Score Global</p>
                <p className="mt-1 text-3xl font-bold text-[#6B54FA]">67<span className="text-base text-white/30">/100</span></p>
              </div>
              <div className="rounded-lg bg-white/5 p-4 text-left">
                <p className="text-[10px] text-white/40 uppercase tracking-wide">Taux de mention</p>
                <p className="mt-1 text-3xl font-bold text-white">58<span className="text-base text-white/30">%</span></p>
              </div>
              <div className="rounded-lg bg-white/5 p-4 text-left">
                <p className="text-[10px] text-white/40 uppercase tracking-wide">Position moyenne</p>
                <p className="mt-1 text-3xl font-bold text-white">#<span>2.1</span></p>
              </div>
            </div>
            {/* LLM tags */}
            <div className="flex gap-2 px-4 pb-4">
              {[
                { name: "GPT-4o", color: "bg-[#1FC285]" },
                { name: "Claude", color: "bg-[#E8891D]" },
                { name: "Gemini", color: "bg-[#4285F4]" },
                { name: "Perplexity", color: "bg-[#6B54FA]" },
              ].map((llm) => (
                <div key={llm.name} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  <span className={`h-2 w-2 rounded-full ${llm.color}`} />
                  <span className="text-[10px] text-white/50">{llm.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-y border-white/10 bg-white/[0.02] py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="font-[family-name:var(--font-sora)] text-3xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-white/50">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem Statement ── */}
      <section className="py-24 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6B54FA]">Le contexte</p>
          <h2 className="mt-4 font-[family-name:var(--font-sora)] text-4xl font-bold leading-tight">
            Le SEO a changé.<br />L&apos;IA est le nouveau Gatekeeper.
          </h2>
          <p className="mt-6 text-lg text-white/50 leading-relaxed">
            Aujourd&apos;hui, des millions de décisionnaires posent leurs questions directement aux LLMs. Si votre marque n&apos;apparaît pas dans ces réponses, vous perdez des opportunités que vous ne voyez même pas. GEO Doctor vous rend ce contrôle.
          </p>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-[#6B54FA]/10 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B54FA]">Comment ça fonctionne</p>
            <h2 className="mt-4 font-[family-name:var(--font-sora)] text-4xl font-bold">
              De zéro à votre score en 4 étapes
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step) => (
              <div key={step.number} className="relative rounded-xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-mono text-white/20">{step.number}</p>
                <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[#6B54FA]/30 bg-[#6B54FA]/10 text-2xl text-[#6B54FA]">
                  {step.icon}
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-white/50 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/step-1"
              className="inline-flex rounded-xl bg-[#6B54FA] px-7 py-3.5 text-sm font-semibold text-white hover:bg-[#5A43E8] transition-colors"
            >
              Commencer maintenant →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="fonctionnalites" className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B54FA]">Fonctionnalités</p>
            <h2 className="mt-4 font-[family-name:var(--font-sora)] text-4xl font-bold max-w-2xl mx-auto">
              Tout ce dont vous avez besoin pour dominer les LLMs
            </h2>
          </div>
          <div className="space-y-24">
            {features.map((feature) => (
              <div
                key={feature.tag}
                className={`flex flex-col ${feature.reverse ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-12`}
              >
                {/* Text */}
                <div className="flex-1">
                  <span className="inline-block rounded-full border border-[#6B54FA]/30 bg-[#6B54FA]/10 px-3 py-1 text-xs font-semibold text-[#C4B8FF]">
                    {feature.tag}
                  </span>
                  <h3 className="mt-4 font-[family-name:var(--font-sora)] text-3xl font-bold">{feature.title}</h3>
                  <p className="mt-4 text-white/50 leading-relaxed">{feature.description}</p>
                  <div className="mt-6 flex items-center gap-8">
                    {feature.stats.map((s, i) => (
                      <div key={i}>
                        <p className="text-2xl font-bold text-[#6B54FA]">{s.value}</p>
                        <p className="text-sm text-white/40">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Mock */}
                <div className="flex-1 w-full max-w-md rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="border-b border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-xs text-white/40">{feature.mockTitle}</span>
                  </div>
                  <div className="p-4 space-y-2">
                    {feature.mockRows.map((row) => (
                      <div key={row.name} className="flex items-center gap-3">
                        <span className="w-24 shrink-0 text-xs text-white/50 truncate">{row.name}</span>
                        <div className="flex-1 h-7 rounded bg-white/5 overflow-hidden">
                          <div className={`h-full ${row.width} ${row.color} rounded`} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-xs font-semibold text-white/60">+{row.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="temoignages" className="py-24 border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B54FA]">Ce qu&apos;ils en disent</p>
            <h2 className="mt-4 font-[family-name:var(--font-sora)] text-4xl font-bold">
              Ils ont transformé leur visibilité IA
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-xl border border-white/10 bg-white/5 p-6 flex flex-col">
                <span className="text-2xl text-[#6B54FA] leading-none">❝</span>
                <p className="mt-3 flex-1 text-sm text-white/70 leading-relaxed">{t.quote}</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.color} text-sm font-bold text-white font-[family-name:var(--font-sora)]`}>
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 border-t border-white/10">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#6B54FA]">Questions fréquentes</p>
            <h2 className="mt-4 font-[family-name:var(--font-sora)] text-4xl font-bold">
              Tout ce que vous voulez savoir
            </h2>
          </div>
          <div className="divide-y divide-white/10 border-t border-white/10">
            {faqs.map((faq) => (
              <details key={faq.question} className="group py-5" open={faq.open}>
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium text-white list-none">
                  {faq.question}
                  <span className="shrink-0 text-white/40 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-white/50 leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative py-28 overflow-hidden border-t border-white/10 text-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-0 h-[300px] w-[500px] rounded-full bg-[#6B54FA]/15 blur-[120px]" />
          <div className="absolute right-0 bottom-0 h-[200px] w-[300px] rounded-full bg-[#6B54FA]/10 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6">
          <h2 className="font-[family-name:var(--font-sora)] text-4xl font-bold leading-tight lg:text-5xl">
            Prêt à transformer votre visibilité IA en moteur de croissance ?
          </h2>
          <p className="mt-6 text-lg text-white/50">
            Rejoignez les équipes qui pilotent leur présence dans les LLMs. Premier audit gratuit. Sans carte bancaire.
          </p>
          <Link
            href="/step-1"
            className="mt-8 inline-flex rounded-xl bg-[#6B54FA] px-8 py-4 text-base font-semibold text-white hover:bg-[#5A43E8] transition-colors shadow-lg shadow-[#6B54FA]/30"
          >
            Lancer mon premier audit gratuit →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#6B54FA]">
              <span className="text-xs font-bold text-white font-[family-name:var(--font-sora)]">G</span>
            </div>
            <span className="text-sm font-semibold text-white font-[family-name:var(--font-sora)]">GEO Doctor</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-white transition-colors">Conditions</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
            <a href="#" className="hover:text-white transition-colors">Blog</a>
          </div>
          <p className="text-xs text-white/30">© 2026 GEO Doctor. Tous droits réservés.</p>
        </div>
      </footer>

    </div>
  );
}
