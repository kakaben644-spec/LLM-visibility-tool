"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { AuditScores, LlmResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------

interface ScoreApiResponse {
  data: {
    scores: AuditScores;
  };
}

interface ResponsesApiResponse {
  data: {
    responses: LlmResponse[];
  };
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<AuditScores | null>(null);
  const [responses, setResponses] = useState<LlmResponse[]>([]);

  useEffect(() => {
    const auditId = localStorage.getItem("llmv_current_audit");

    if (!auditId) {
      router.replace("/step-1");
      return;
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
        const responsesJson = (await responsesRes.json()) as ResponsesApiResponse;

        setScores(scoreJson.data.scores);
        setResponses(responsesJson.data.responses);
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

  return (
    <main className="container mx-auto py-8 space-y-8">
      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">ScoreCard ici</p>
        {/* scores available: {JSON.stringify(scores?.global)} */}
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Benchmark ici</p>
      </div>

      <div className="rounded-lg border p-6">
        <p className="text-muted-foreground">Accordion ici</p>
        {/* responses available: {responses.length} */}
      </div>
    </main>
  );
}
