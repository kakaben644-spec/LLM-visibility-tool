"use client";

// ---------------------------------------------------------------------------
// NOTE : les composants components/features/dashboard/ScoreCard.tsx et
// ResponseAccordion.tsx n'existent pas encore.
// Les routes GET /api/audit/[id]/score et /api/audit/[id]/responses n'existent
// pas non plus. Cette page appelle les bons endpoints et affiche les données
// en ligne — à refactoriser quand les composants seront créés.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { getCurrentAuditId, getSessionToken } from "@/lib/session";
import { LLM_LABELS } from "@/lib/types";
import type { LlmProvider } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ---------------------------------------------------------------------------
// Types des réponses API
// ---------------------------------------------------------------------------

interface RankingEntry {
  provider: LlmProvider;
  score: number;
}

interface ScoreApiData {
  brand_name: string;
  brand_score: number;
  ranking: RankingEntry[];
}

interface LlmResponseItem {
  id: string;
  provider: LlmProvider;
  prompt: string;
  response: string;
  is_mentioned: boolean;
  is_recommended: boolean;
  sentiment: "positive" | "neutral" | "negative" | null;
  score: number;
}

interface ResponsesApiData {
  responses: LlmResponseItem[];
}

// Enveloppe de succès renvoyée par successResponse()
interface ApiWrapper<T> {
  ok: true;
  data: T;
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [scoreData, setScoreData] = useState<ScoreApiData | null>(null);
  const [responsesData, setResponsesData] = useState<ResponsesApiData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auditId = getCurrentAuditId();
    const sessionToken = getSessionToken();

    if (!auditId || !sessionToken) {
      setError("Session introuvable. Veuillez relancer l'analyse.");
      setLoading(false);
      return;
    }

    const qs = `session_token=${encodeURIComponent(sessionToken)}`;

    Promise.all([
      fetch(`/api/audit/${auditId}/score?${qs}`).then(async (res) => {
        if (!res.ok) throw new Error(`score: ${res.status}`);
        const json = (await res.json()) as ApiWrapper<ScoreApiData>;
        return json.data;
      }),
      fetch(`/api/audit/${auditId}/responses?${qs}`).then(async (res) => {
        if (!res.ok) throw new Error(`responses: ${res.status}`);
        const json = (await res.json()) as ApiWrapper<ResponsesApiData>;
        return json.data;
      }),
    ])
      .then(([score, responses]) => {
        setScoreData(score);
        setResponsesData(responses);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Erreur lors du chargement des données : ${msg}`);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── États de chargement / erreur ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm animate-pulse">
          Chargement du tableau de bord…
        </p>
      </div>
    );
  }

  if (error || !scoreData || !responsesData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">
              Impossible de charger les résultats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {error ?? "Une erreur inattendue est survenue."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Rendu principal ───────────────────────────────────────────────────────

  const sentimentLabel: Record<
    NonNullable<LlmResponseItem["sentiment"]>,
    string
  > = {
    positive: "Positif",
    neutral: "Neutre",
    negative: "Négatif",
  };

  const sentimentVariant: Record<
    NonNullable<LlmResponseItem["sentiment"]>,
    "default" | "secondary" | "destructive"
  > = {
    positive: "default",
    neutral: "secondary",
    negative: "destructive",
  };

  return (
    <main className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ── En-tête ── */}
        <div>
          <h1 className="text-2xl font-bold">
            Visibilité IA — {scoreData.brand_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Résultats de l&apos;audit LLM
          </p>
        </div>

        {/* ── ScoreCard ── */}
        <Card>
          <CardHeader>
            <CardTitle>Score global</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-5xl font-extrabold tabular-nums">
                {scoreData.brand_score}
              </span>
              <span className="text-muted-foreground text-lg">/&nbsp;100</span>
            </div>

            {scoreData.ranking.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Par modèle</p>
                <ul className="space-y-1">
                  {scoreData.ranking.map((entry) => (
                    <li
                      key={entry.provider}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {LLM_LABELS[entry.provider]}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {entry.score}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── ResponseAccordion ── */}
        <Card>
          <CardHeader>
            <CardTitle>
              Réponses des LLMs
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({responsesData.responses.length} résultat
                {responsesData.responses.length !== 1 ? "s" : ""})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {responsesData.responses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune réponse disponible pour cet audit.
              </p>
            ) : (
              <Accordion type="multiple" className="w-full">
                {responsesData.responses.map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger className="text-left text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">
                          {LLM_LABELS[item.provider]}
                        </Badge>
                        {item.is_mentioned && (
                          <Badge variant="default">Mentionné</Badge>
                        )}
                        {item.is_recommended && (
                          <Badge variant="default">Recommandé</Badge>
                        )}
                        {item.sentiment && (
                          <Badge variant={sentimentVariant[item.sentiment]}>
                            {sentimentLabel[item.sentiment]}
                          </Badge>
                        )}
                        <span className="truncate max-w-sm text-muted-foreground">
                          {item.prompt}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {item.response}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
