"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AuditRow } from "@/app/api/history/route";

import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreEntry {
  entity_name: string;
  entity_type: "brand" | "competitor";
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  score_claude_haiku: number | null;
  score_mistral: number | null;
}

interface DetailData {
  brand_name: string;
  created_at: string;
  status: string;
  total_score: number;
  mention_rate: number;
  avg_position: number | null;
  score_claude_haiku: number | null;
  score_mistral: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const BENCHMARK = [
  { label: "Claude Haiku", key: "score_claude_haiku" as const },
  { label: "Mistral", key: "score_mistral" as const },
];

const STATUS_LABEL: Record<string, string> = {
  completed: "Terminé",
  running: "En cours…",
  pending: "En attente",
  failed: "Échoué",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HistoriqueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDetail = async () => {
      try {
        const [scoreRes, historyRes] = await Promise.all([
          fetch(`/api/audit/${id}/score`),
          fetch("/api/history"),
        ]);

        const scoreJson = (await scoreRes.json()) as {
          ok: boolean;
          data?: { scores: ScoreEntry[] };
          error?: string;
        };
        const historyJson = (await historyRes.json()) as {
          ok: boolean;
          data?: { audits: AuditRow[] };
          error?: string;
        };

        if (!scoreJson.ok || !historyJson.ok) {
          setError(scoreJson.error ?? historyJson.error ?? "Erreur lors du chargement");
          return;
        }

        const brandScore = scoreJson.data?.scores.find(
          (s) => s.entity_type === "brand"
        );
        const auditMeta = historyJson.data?.audits.find((a) => a.id === id);

        if (!brandScore || !auditMeta) {
          setError("Audit introuvable");
          return;
        }

        setDetail({
          brand_name: auditMeta.brand_name,
          created_at: auditMeta.created_at,
          status: auditMeta.status,
          total_score: brandScore.total_score,
          mention_rate: brandScore.mention_rate,
          avg_position: brandScore.avg_position,
          score_claude_haiku: brandScore.score_claude_haiku,
          score_mistral: brandScore.score_mistral,
        });
      } catch {
        setError("Erreur réseau");
      } finally {
        setLoading(false);
      }
    };

    void fetchDetail();
  }, [id]);

  function handleLoad() {
    localStorage.setItem("llmv_current_audit", id);
    router.push("/dashboard");
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
  // Error
  // --------------------------------------------------------------------------

  if (error || !detail) {
    return (
      <div className="text-white">
        <div className="mx-auto max-w-2xl px-4 py-10 space-y-4">
          <button
            onClick={() => router.push("/historique")}
            className="text-xs text-white/40 hover:text-white transition-colors"
            aria-label="Retour à l'historique"
          >
            ← Retour à l'historique
          </button>
          <p className="text-sm text-red-400">{error ?? "Audit introuvable"}</p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="text-white">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">

        {/* Back */}
        <button
          onClick={() => router.push("/historique")}
          className="text-xs text-white/40 hover:text-white transition-colors"
          aria-label="Retour à l'historique"
        >
          ← Retour à l'historique
        </button>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{detail.brand_name}</h1>
          <p className="mt-1 text-sm text-white/50">
            Audit du {formatDate(detail.created_at)} · {STATUS_LABEL[detail.status] ?? detail.status}
          </p>
        </div>

        {/* Score card */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-5 flex items-center gap-8">
          <div className="text-center">
            <div className="text-4xl font-extrabold text-[#6B54FA] leading-none">
              {detail.total_score}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-wide text-white/40">
              Score global
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 flex-1">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-white/40">
                Taux de mention
              </div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {Math.round(detail.mention_rate * 100)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-white/40">
                Position moyenne
              </div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {detail.avg_position !== null ? Math.round(detail.avg_position) : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Benchmark */}
        <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white/80">
            Benchmark par LLM
          </div>
          {BENCHMARK.map(({ label, key }) => {
            const score = detail[key];
            return (
              <div
                key={label}
                className="flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-b-0"
              >
                <span className="text-sm text-white/70">{label}</span>
                <span
                  className={`text-sm font-bold ${
                    score !== null ? "text-[#6B54FA]" : "text-white/20"
                  }`}
                >
                  {score !== null ? score : "—"}
                </span>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <Button onClick={handleLoad} className="bg-[#6B54FA] hover:bg-[#5a45e0] text-white">
          Charger dans le dashboard →
        </Button>

      </div>
    </div>
  );
}
