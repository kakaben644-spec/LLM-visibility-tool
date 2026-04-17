"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreEntry {
  entity_name: string;
  entity_type: "brand" | "competitor";
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  sentiment_score: number | null;
  score_gpt4o: number | null;
  score_claude: number | null;
  score_gemini: number | null;
}

interface LlmResponse {
  id: string;
  prompt_text: string;
  llm_name: string;
  response_text: string;
  is_mentioned: boolean;
  mention_position: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LLM_ORDER = ["gpt-4o", "claude-sonnet", "claude-haiku", "gemini-pro", "mistral"] as const;
type LlmName = (typeof LLM_ORDER)[number];

const LLM_LABELS: Record<LlmName, string> = {
  "gpt-4o": "GPT-4o",
  "claude-sonnet": "Claude Sonnet",
  "claude-haiku": "Claude Haiku",
  "gemini-pro": "Gemini Pro",
  "mistral": "Mistral",
};

function scoreColor(score: number): string {
  if (score < 30) return "text-red-400";
  if (score <= 60) return "text-orange-400";
  return "text-green-400";
}

function scoreBadgeClass(score: number): string {
  if (score < 30) return "border border-red-500/30 bg-red-500/20 text-red-400";
  if (score <= 60)
    return "border border-orange-500/30 bg-orange-500/20 text-orange-400";
  return "border border-green-500/30 bg-green-500/20 text-green-400";
}

function scoreBadgeLabel(score: number): string {
  if (score < 30) return "Faible";
  if (score <= 60) return "Moyen";
  return "Bon";
}

function fmt(score: number | null): string {
  return score !== null ? String(score) : "—";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();

  const [auditId, setAuditId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [responses, setResponses] = useState<LlmResponse[]>([]);
  const [auditRunning, setAuditRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedAuditId = localStorage.getItem("llmv_current_audit");
    const name = localStorage.getItem("llmv_brand_name") ?? "";
    setAuditId(storedAuditId);
    setBrandName(name);

    if (!storedAuditId) {
      router.push("/step-1");
      return;
    }

    const load = async () => {
      try {
        const [statusRes, scoreRes, responsesRes] = await Promise.all([
          fetch(`/api/audit/${storedAuditId}/status`),
          fetch(`/api/audit/${storedAuditId}/score`),
          fetch(`/api/audit/${storedAuditId}/responses`),
        ]);

        if (!statusRes.ok || !scoreRes.ok || !responsesRes.ok) {
          throw new Error("Erreur lors du chargement des données.");
        }

        const statusJson = (await statusRes.json()) as {
          data: { status: string };
        };
        const scoreJson = (await scoreRes.json()) as {
          data: { scores: ScoreEntry[] };
        };
        const responsesJson = (await responsesRes.json()) as {
          data: { responses: LlmResponse[] };
        };

        setAuditRunning(statusJson.data.status !== "completed");
        setScores(scoreJson.data.scores);
        setResponses(responsesJson.data.responses);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

  // --------------------------------------------------------------------------
  // Derived data
  // --------------------------------------------------------------------------

  const brandScore = scores.find((s) => s.entity_type === "brand") ?? null;

  const promptGroups = new Map<string, LlmResponse[]>();
  for (const r of responses) {
    const existing = promptGroups.get(r.prompt_text);
    if (!existing) {
      promptGroups.set(r.prompt_text, [r]);
    } else {
      existing.push(r);
    }
  }

  async function handleRerun() {
    if (!auditId) return;
    const sessionToken = localStorage.getItem("llmv_session");
    if (!sessionToken) {
      router.push("/step-1");
      return;
    }
    try {
      const res = await fetch(`/api/audit/${auditId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken }),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: { audit_id: string } };
        localStorage.setItem("llmv_current_audit", json.data.audit_id);
      }
    } catch {
      // silent fail — redirect regardless
    }
    router.push("/step-1");
  }

  // --------------------------------------------------------------------------
  // Loading / error states
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F0F1A]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#6B54FA] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0F0F1A] text-white">
        <p className="text-lg font-semibold">Erreur de chargement</p>
        <p className="text-sm text-white/60">{error}</p>
        <Button onClick={() => router.push("/step-1")}>Recommencer</Button>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white">
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{brandName || "Votre marque"}</h1>
          <p className="mt-1 text-sm text-white/60">
            Résultats de votre audit de visibilité IA
          </p>
          {auditRunning && (
            <p className="mt-2 text-xs text-orange-400">
              ⏳ L&apos;analyse est encore en cours — résultats partiels affichés.
            </p>
          )}
        </div>

        {/* Score global */}
        {brandScore !== null ? (
          <Card className="border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-white">Score global</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-6">
              <div className={`text-6xl font-bold ${scoreColor(brandScore.total_score)}`}>
                {brandScore.total_score}
                <span className="text-2xl text-white/30">/100</span>
              </div>
              <div className="flex flex-col gap-2">
                <span
                  className={`inline-flex w-fit items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${scoreBadgeClass(brandScore.total_score)}`}
                >
                  {scoreBadgeLabel(brandScore.total_score)}
                </span>
                <p className="text-sm text-white/60">
                  Taux de mention :{" "}
                  <span className="font-medium text-white">
                    {Math.round(brandScore.mention_rate * 100)}%
                  </span>
                </p>
                {brandScore.avg_position !== null && (
                  <p className="text-sm text-white/60">
                    Position moyenne :{" "}
                    <span className="font-medium text-white">
                      {brandScore.avg_position}
                    </span>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-6">
              <p className="text-sm text-white/40">
                Aucune donnée de score disponible pour le moment.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Benchmark table */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Benchmark concurrentiel</CardTitle>
          </CardHeader>
          <CardContent>
            {scores.length === 0 ? (
              <p className="text-sm text-white/40">Aucun résultat disponible.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-white/40">
                      <th className="pb-3 text-left font-medium">Entité</th>
                      <th className="pb-3 text-right font-medium">Score</th>
                      <th className="pb-3 text-right font-medium">GPT-4o</th>
                      <th className="pb-3 text-right font-medium">Claude</th>
                      <th className="pb-3 text-right font-medium">Gemini</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {scores.map((s) => (
                      <tr key={s.entity_name}>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{s.entity_name}</span>
                            {s.entity_type === "brand" && (
                              <span className="rounded bg-[#6B54FA]/20 px-1.5 py-0.5 text-xs text-[#6B54FA]">
                                vous
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-[#6B54FA] transition-all"
                              style={{ width: `${s.total_score}%` }}
                            />
                          </div>
                        </td>
                        <td className={`py-3 text-right font-semibold ${scoreColor(s.total_score)}`}>
                          {s.total_score}
                        </td>
                        <td className="py-3 text-right text-white/60">
                          {fmt(s.score_gpt4o)}
                        </td>
                        <td className="py-3 text-right text-white/60">
                          {fmt(s.score_claude)}
                        </td>
                        <td className="py-3 text-right text-white/60">
                          {fmt(s.score_gemini)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Responses accordion */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Détail des réponses</CardTitle>
          </CardHeader>
          <CardContent>
            {promptGroups.size === 0 ? (
              <p className="text-sm text-white/40">Aucune réponse disponible.</p>
            ) : (
              <Accordion type="multiple" className="space-y-1">
                {Array.from(promptGroups.entries()).map(([promptText, llmResponses], idx) => (
                  <AccordionItem
                    key={idx}
                    value={`prompt-${idx}`}
                    className="border-white/10"
                  >
                    <AccordionTrigger className="text-left text-sm text-white hover:no-underline hover:text-white/80">
                      {promptText}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {LLM_ORDER.map((llm) => {
                          const r = llmResponses.find((lr) => lr.llm_name === llm);
                          if (!r) return null;
                          return (
                            <div key={llm} className="rounded-lg bg-white/5 p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-semibold text-white/80">
                                  {LLM_LABELS[llm]}
                                </span>
                                {r.is_mentioned ? (
                                  <span className="rounded-md border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                                    Mentionné
                                  </span>
                                ) : (
                                  <span className="rounded-md border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                                    Absent
                                  </span>
                                )}
                              </div>
                              <p className="text-xs leading-relaxed text-white/50">
                                {r.response_text.length > 0
                                  ? r.response_text.slice(0, 200) +
                                    (r.response_text.length > 200 ? "…" : "")
                                  : "Aucune réponse (erreur LLM)"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Footer CTAs */}
        <div className="flex flex-wrap gap-3 pb-10">
          <Button onClick={() => router.push("/sign-up")}>
            Voir les recommandations
          </Button>
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 hover:text-white"
            onClick={() => void handleRerun()}
          >
            Relancer un audit
          </Button>
        </div>

      </div>
    </div>
  );
}
