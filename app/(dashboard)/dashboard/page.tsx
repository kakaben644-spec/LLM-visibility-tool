"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RerunResponseData {
  audit_id: string;
  brand_name: string;
  prompts: string[];
  competitors: string[];
}

interface RerunResponse {
  ok: true;
  data: RerunResponseData;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenModal() {
    setError(null);
    setOpen(true);
  }

  async function handleConfirm() {
    const auditId =
      typeof window !== "undefined"
        ? localStorage.getItem("llmv_current_audit")
        : null;

    if (!auditId) {
      setError("Aucun audit en cours. Veuillez relancer l'onboarding.");
      return;
    }

    const sessionToken =
      typeof window !== "undefined"
        ? localStorage.getItem("llmv_session_token")
        : null;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/audit/${auditId}/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: sessionToken ?? "" }),
      });

      const json: unknown = await res.json();

      if (!res.ok || !(json as RerunResponse).ok) {
        const message =
          (json as { error?: string }).error ?? "Erreur lors du lancement de l'audit.";
        throw new Error(message);
      }

      const { data } = json as RerunResponse;
      localStorage.setItem("llmv_current_audit", data.audit_id);
      setOpen(false);
      router.push("/scanning");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>

      <Button onClick={handleOpenModal} disabled={loading}>
        Nouvel audit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lancer un nouvel audit ?</DialogTitle>
            <DialogDescription>
              Cette action lancera un nouvel audit et consommera vos crédits
              API. Les résultats précédents seront conservés.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? "Lancement…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
