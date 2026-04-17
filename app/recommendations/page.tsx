"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types (match dashboard/page.tsx exactly)
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
// Recommendation derivation
// ---------------------------------------------------------------------------

function deriveRecommendations(brandScore: ScoreEntry): string[] {
  const recs: string[] = [];

  if (brandScore.mention_rate < 0.5) {
    recs.push(
      "Votre marque est absente de plus de la moitié des réponses LLM. Travaillez votre présence sur des sources citées par les LLMs (Wikipedia, presse spécialisée, forums)."
    );
  }

  if (brandScore.avg_position === null || brandScore.avg_position > 3) {
    recs.push(
      "Votre marque apparaît tard dans les réponses. Optimisez vos contenus pour apparaître dans les premières phrases."
    );
  }

  if (brandScore.score_gpt4o !== null && brandScore.score_gpt4o < 30) {
    recs.push(
      "GPT-4o ne vous mentionne pas. Ciblez les sources d'entraînement OpenAI : blog officiel, documentation publique, partenariats médias."
    );
  }

  if (brandScore.score_claude !== null && brandScore.score_claude < 30) {
    recs.push(
      "Claude ne vous mentionne pas. Anthropic valorise les contenus structurés et factuels. Publiez des études de cas détaillées."
    );
  }

  if (brandScore.score_gemini !== null && brandScore.score_gemini < 30) {
    recs.push(
      "Gemini ne vous mentionne pas. Renforcez votre présence sur les propriétés Google : Search, YouTube, Google Business."
    );
  }

  recs.push(
    "Relancez un audit dans 30 jours pour mesurer l'impact de vos actions."
  );

  return recs;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecommendationsPage() {
  const router = useRouter();

  const [brandName, setBrandName] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auditId = localStorage.getItem("llmv_current_audit");
    const name = localStorage.getItem("llmv_brand_name") ?? "";
    setBrandName(name);

    if (!auditId) {
      router.push("/step-1");
      return;
    }

    const load = async () => {
      try {
        const [scoreRes, responsesRes] = await Promise.all([
          fetch(`/api/audit/${auditId}/score`),
          fetch(`/api/audit/${auditId}/responses`),
        ]);

        if (!scoreRes.ok || !responsesRes.ok) {
          throw new Error("Erreur lors du chargement des données.");
        }

        const scoreJson = (await scoreRes.json()) as {
          data: { scores: ScoreEntry[] };
        };
        await responsesRes.json() as { data: { responses: LlmResponse[] } };

        const brandScore = scoreJson.data.scores.find(
          (s) => s.entity_type === "brand"
        );

        if (!brandScore) {
          throw new Error("Score de marque introuvable.");
        }

        setRecommendations(deriveRecommendations(brandScore));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [router]);

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
            Recommandations pour améliorer votre visibilité IA
          </p>
        </div>

        {/* Recommendations list */}
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Plan d&apos;action</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {recommendations.map((rec, idx) => (
                <li key={idx} className="flex gap-4">
                  <div className="border-l-4 border-[#6B54FA] pl-4">
                    <span className="mb-1 block text-xs font-semibold text-[#6B54FA]">
                      {idx + 1}.
                    </span>
                    <p className="text-sm leading-relaxed text-white/80">{rec}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Footer CTA */}
        <div className="pb-10">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 hover:text-white"
            onClick={() => router.push("/dashboard")}
          >
            Retour au dashboard
          </Button>
        </div>

      </div>
    </div>
  );
}
