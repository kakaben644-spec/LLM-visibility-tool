"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { AuditScoreApiData, LlmResponse } from "@/lib/types";
import { ScoreCard } from "@/components/features/dashboard/ScoreCard";
import { ResponseAccordion } from "@/components/features/dashboard/ResponseAccordion";
import { EmptyState } from "@/components/features/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------

interface ScoreApiResponse {
  ok: true;
  data: AuditScoreApiData;
}

interface ResponsesApiResponse {
  ok: true;
  data: {
    responses: LlmResponse[];
  };
}

interface StatusApiResponse {
  ok: true;
  data: {
    audit_id: string;
    status: string;
    progress_pct: number;
    completed_llms: string[];
    failed_llms: string[];
    total_responses: number;
    expected_responses: number;
  };
}

// Shape stored in localStorage under "llmv_session"
interface SessionCache {
  brand_name?: string;
  competitors?: string[];
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<AuditScoreApiData | null>(null);
  const [responses, setResponses] = useState<LlmResponse[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);

  useEffect(() => {
    const auditId = localStorage.getItem("llmv_current_audit");

    if (!auditId) {
      router.replace("/step-1");
      return;
    }

    // Read competitors from the cached session if available
    try {
      const raw = localStorage.getItem("llmv_session");
      if (raw) {
        const session = JSON.parse(raw) as SessionCache;
        setCompetitors(session.competitors ?? []);
      }
    } catch {
      // ignore parse errors — competitors will be empty
    }

    async function load() {
      try {
        const [scoreRes, responsesRes] = await Promise.all([
          fetch(`/api/audit/${auditId}/score`),
          fetch(`/api/audit/${auditId}/responses`),
        ]);

        if (!scoreRes.ok || !responsesRes.ok) {
          throw new Error("Impossible de charger les résultats");
        }

        const scoreJson = (await scoreRes.json()) as ScoreApiResponse;
        const responsesJson =
          (await responsesRes.json()) as ResponsesApiResponse;

        setScoreData(scoreJson.data);
        setResponses(responsesJson.data.responses);

        // Prefer competitors from the score API ranking if present
        const competitorNames = scoreJson.data.ranking
          .filter((e) => e.entity_type === "competitor")
          .map((e) => e.entity_name);
        if (competitorNames.length > 0) {
          setCompetitors(competitorNames);
        }

        // Fire status check after main fetches — toast on partial failures
        const sessionToken = localStorage.getItem("llmv_session");
        const statusQs = sessionToken
          ? `?session_token=${encodeURIComponent(sessionToken)}`
          : "";
        try {
          const statusRes = await fetch(
            `/api/audit/${auditId}/status${statusQs}`
          );
          if (statusRes.ok) {
            const statusJson = (await statusRes.json()) as StatusApiResponse;
            for (const llmName of statusJson.data.failed_llms) {
              toast({
                title: `${llmName} indisponible — résultats partiels`,
                variant: "destructive",
              });
            }
          }
        } catch {
          // Status check failure is non-blocking — ignore silently
        }
      } catch {
        setError("Impossible de charger les résultats");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const brandName = scoreData?.brand_name ?? "";

  return (
    <main className="container mx-auto py-8 space-y-8">
      {scoreData &&
        (scoreData.brand_score === 0 ? (
          <EmptyState />
        ) : (
          <ScoreCard
            brandName={brandName}
            brandScore={scoreData.brand_score}
            ranking={scoreData.ranking}
          />
        ))}

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Benchmark ici</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Détail des réponses LLM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponseAccordion
            responses={responses}
            brandName={brandName}
            competitors={competitors}
          />
        </CardContent>
      </Card>

      <div className="flex justify-center pb-4">
        <Button asChild variant="default" size="lg">
          <a href="#">Voir les recommandations</a>
        </Button>
      </div>
    </main>
  );
}
