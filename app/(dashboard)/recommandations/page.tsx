// app/(dashboard)/recommandations/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "content" | "technical" | "positioning" | "competitors" | "seo";
  llm_target: string;
  is_done: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_BADGE: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/20 text-red-400",
  medium: "border-orange-500/30 bg-orange-500/20 text-orange-400",
  low: "border-green-500/30 bg-green-500/20 text-green-400",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "HAUTE",
  medium: "MOYENNE",
  low: "FAIBLE",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RecommandationsPage() {
  const router = useRouter();
  const [auditId, setAuditId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("llmv_current_audit");
    if (!id) {
      router.push("/step-1");
      return;
    }
    setAuditId(id);

    const fetchRecs = async () => {
      try {
        const res = await fetch(`/api/recommendations?audit_id=${id}`);
        const json = (await res.json()) as {
          ok: boolean;
          data?: { recommendations: Recommendation[] };
          error?: string;
        };
        if (json.ok && json.data) {
          setRecommendations(json.data.recommendations);
        }
      } catch {
        // silent — empty state shown
      } finally {
        setLoading(false);
      }
    };

    void fetchRecs();
  }, [router]);

  async function handleGenerate() {
    if (!auditId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: auditId }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { recommendations: Recommendation[] };
        error?: string;
      };
      if (json.ok && json.data) {
        setRecommendations(json.data.recommendations);
      } else {
        setError(json.error ?? "Erreur lors de la génération");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    // Optimistic update
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_done: !current } : r))
    );
    try {
      const res = await fetch(`/api/recommendations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_done: !current }),
      });
      if (!res.ok) throw new Error("PATCH failed");
    } catch {
      // Revert on failure
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_done: current } : r))
      );
    }
  }

  // --------------------------------------------------------------------------
  // Loading
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#6B54FA] border-t-transparent" />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="text-white">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Recommandations IA</h1>
            <p className="mt-1 text-sm text-white/60">
              {recommendations.length > 0
                ? `${recommendations.length} recommandations · Claude Haiku`
                : "Générées par Claude Haiku à partir de votre audit"}
            </p>
          </div>
          {recommendations.length > 0 && (
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 hover:text-white text-xs flex-shrink-0"
              onClick={() => void handleGenerate()}
              disabled={generating}
            >
              {generating ? "…" : "↺ Régénérer"}
            </Button>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Empty state */}
        {recommendations.length === 0 && (
          <Card className="border-white/10 bg-white/5">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="w-10 h-10 rounded-xl bg-[#6B54FA]/20 flex items-center justify-center">
                <Lightbulb className="text-[#6B54FA]" size={20} />
              </div>
              <p className="text-white font-semibold">Aucune recommandation générée</p>
              <p className="text-white/50 text-sm text-center max-w-xs">
                Cliquez pour analyser vos résultats et obtenir des conseils personnalisés.
              </p>
              <Button
                onClick={() => void handleGenerate()}
                disabled={generating}
              >
                {generating ? "Génération en cours…" : "✨ Générer mes recommandations"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recommendation cards */}
        {recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className={`border rounded-lg p-4 flex gap-3 transition-opacity border-white/10 bg-white/5 ${
                  rec.is_done ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={rec.is_done}
                  onChange={() => void handleToggle(rec.id, rec.is_done)}
                  className="mt-0.5 accent-[#6B54FA] flex-shrink-0 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span
                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold border ${
                        PRIORITY_BADGE[rec.priority] ?? PRIORITY_BADGE.low
                      }`}
                    >
                      {PRIORITY_LABEL[rec.priority] ?? rec.priority}
                    </span>
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] border border-[#6B54FA]/30 bg-[#6B54FA]/10 text-[#6B54FA]">
                      {rec.category}
                    </span>
                    <span className="text-[10px] text-white/40">{rec.llm_target}</span>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      rec.is_done ? "line-through text-white/40" : "text-white"
                    }`}
                  >
                    {rec.title}
                  </p>
                  <p className="text-xs text-white/60 mt-1">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
