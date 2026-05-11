"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types — mirrors AuditRow from app/api/history/route.ts
// ---------------------------------------------------------------------------

interface AuditRow {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  brand_id: string;
  brand_name: string;
  total_score: number | null;
  mention_rate: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-500/20 text-green-400",
  running: "bg-orange-500/20 text-orange-400",
  pending: "bg-white/10 text-white/50",
  failed: "bg-red-500/20 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Terminé",
  running: "En cours…",
  pending: "En attente",
  failed: "Échoué",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HistoriquePage() {
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>("all");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/history");
        const json = (await res.json()) as {
          ok: boolean;
          data?: { audits: AuditRow[] };
          error?: string;
        };
        if (json.ok && json.data) {
          setAudits(json.data.audits);
        } else {
          setError(json.error ?? "Erreur lors du chargement");
        }
      } catch {
        setError("Erreur réseau");
      } finally {
        setLoading(false);
      }
    };
    void fetchHistory();
  }, []);

  const brands = Array.from(new Set(audits.map((a) => a.brand_name))).sort();

  const filtered =
    brandFilter === "all"
      ? audits
      : audits.filter((a) => a.brand_name === brandFilter);

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
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Historique des audits</h1>
            <p className="mt-1 text-sm text-white/60">
              {audits.length} audit{audits.length !== 1 ? "s" : ""} · {brands.length} marque{brands.length !== 1 ? "s" : ""}
            </p>
          </div>
          {brands.length > 1 && (
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-[#6B54FA]"
            >
              <option value="all">Toutes les marques</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Empty state */}
        {!error && filtered.length === 0 && (
          <p className="text-sm text-white/50">
            Aucun audit trouvé. Lancez votre premier audit depuis le dashboard.
          </p>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1.2fr_1fr_100px_60px_36px] border-b border-white/10 px-4 py-2.5">
              <span className="text-[10px] uppercase tracking-wide text-white/40">Marque</span>
              <span className="text-[10px] uppercase tracking-wide text-white/40">Date</span>
              <span className="text-[10px] uppercase tracking-wide text-white/40">Statut</span>
              <span className="text-[10px] uppercase tracking-wide text-white/40">Score</span>
              <span />
            </div>

            {/* Rows */}
            {filtered.map((audit) => (
              <div
                key={audit.id}
                className="grid grid-cols-[1.2fr_1fr_100px_60px_36px] items-center border-b border-white/5 px-4 py-3 last:border-b-0"
              >
                <span className="text-sm font-semibold text-white">{audit.brand_name}</span>
                <span className="text-xs text-white/50">{formatDate(audit.created_at)}</span>
                <span
                  className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-[10px] font-semibold ${
                    STATUS_BADGE[audit.status] ?? STATUS_BADGE.pending
                  }`}
                >
                  {STATUS_LABEL[audit.status] ?? audit.status}
                </span>
                <span
                  className={`text-sm font-bold ${
                    audit.total_score !== null ? "text-[#6B54FA]" : "text-white/20"
                  }`}
                >
                  {audit.total_score !== null ? audit.total_score : "—"}
                </span>
                <span className="text-center">
                  {audit.status === "completed" ? (
                    <Link
                      href={`/historique/${audit.id}`}
                      className="text-sm text-white/40 hover:text-white transition-colors"
                    >
                      →
                    </Link>
                  ) : (
                    <span className="text-sm text-white/20">—</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
