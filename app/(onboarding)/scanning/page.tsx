"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

// ─── Types ─────────────────────────────────────────────────────────────────────

type LlmName = "gpt-4o" | "claude-sonnet" | "gemini-pro"
type LlmRowStatus = "waiting" | "running" | "completed"
type Phase = "init" | "running" | "error" | "timeout"

interface SessionCompetitor {
  name: string
  url: string
}

interface Prompt {
  id: string
  text: string
  category: string | null
}

interface SessionData {
  brand_name: string | null
  competitors: unknown[]
}

interface SessionApiResponse {
  ok: boolean
  data: SessionData
}

interface AuditStartData {
  audit_id: string
  brand_id: string
  prompts: Prompt[]
}

interface AuditStartApiResponse {
  ok: boolean
  data: AuditStartData
}

interface AuditStatusData {
  audit_id: string
  status: string
  progress_pct: number
  completed_llms: string[]
  failed_llms: string[]
  total_responses: number
  expected_responses: number
}

interface AuditStatusApiResponse {
  ok: boolean
  data: AuditStatusData
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LLM_NAMES: LlmName[] = ["gpt-4o", "claude-sonnet", "gemini-pro"]

const LLM_LABELS: Record<LlmName, string> = {
  "gpt-4o": "GPT-4o",
  "claude-sonnet": "Claude",
  "gemini-pro": "Gemini",
}

const POLL_INTERVAL_MS = 2000
const GLOBAL_TIMEOUT_MS = 60_000

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isValidCompetitor(c: unknown): c is SessionCompetitor {
  if (typeof c !== "object" || c === null) return false
  const obj = c as Record<string, unknown>
  return typeof obj.name === "string" && typeof obj.url === "string"
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ScanningPage() {
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>("init")
  const [brandName, setBrandName] = useState<string>("")
  const [progressPct, setProgressPct] = useState<number>(0)
  const [totalPrompts, setTotalPrompts] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [llmStatus, setLlmStatus] = useState<Record<LlmName, LlmRowStatus>>({
    "gpt-4o": "waiting",
    "claude-sonnet": "waiting",
    "gemini-pro": "waiting",
  })

  // tracks how many prompts have been called for each LLM (1-based, shown in UI)
  const [llmPromptCount, setLlmPromptCount] = useState<Record<LlmName, number>>({
    "gpt-4o": 0,
    "claude-sonnet": 0,
    "gemini-pro": 0,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // guards against double-redirect between polling and timeout
  const doneRef = useRef<boolean>(false)

  useEffect(() => {
    let cancelled = false

    const stopTimers = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }

    const run = async () => {
      // ── 1. Read session_token ──────────────────────────────────────────────
      const sessionToken = localStorage.getItem("llmv_session")
      if (!sessionToken) {
        router.replace("/step-1")
        return
      }

      // ── 2. Fetch session data ──────────────────────────────────────────────
      let fetchedBrandName = ""
      let competitors: SessionCompetitor[] = []

      try {
        const res = await fetch(`/api/onboarding/session?token=${sessionToken}`)
        const json = (await res.json()) as SessionApiResponse
        if (!json.ok) throw new Error("Session introuvable")
        fetchedBrandName = json.data.brand_name ?? ""
        competitors = (json.data.competitors as unknown[]).filter(isValidCompetitor)
      } catch {
        if (!cancelled) {
          setErrorMessage("Impossible de récupérer la session. Merci de recommencer.")
          setPhase("error")
        }
        return
      }

      if (cancelled) return
      setBrandName(fetchedBrandName)

      // ── 3. Start audit ─────────────────────────────────────────────────────
      let auditId = ""
      let prompts: Prompt[] = []

      try {
        const res = await fetch("/api/audit/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        })
        const json = (await res.json()) as AuditStartApiResponse
        if (!json.ok) throw new Error("Impossible de démarrer l'audit")
        auditId = json.data.audit_id
        prompts = json.data.prompts
      } catch {
        if (!cancelled) {
          setErrorMessage("Impossible de démarrer l'audit. Merci de réessayer.")
          setPhase("error")
        }
        return
      }

      if (cancelled) return

      // ── 4. Persist audit_id ────────────────────────────────────────────────
      localStorage.setItem("llmv_current_audit", auditId)
      setTotalPrompts(prompts.length)
      setPhase("running")

      // ── 5. Polling (every 2s) ──────────────────────────────────────────────
      intervalRef.current = setInterval(async () => {
        if (doneRef.current || cancelled) return
        try {
          const res = await fetch(`/api/audit/${auditId}/status`)
          const json = (await res.json()) as AuditStatusApiResponse
          if (!json.ok) return
          setProgressPct(json.data.progress_pct)
          if (json.data.status === "completed" && !doneRef.current) {
            doneRef.current = true
            stopTimers()
            router.push("/dashboard")
          }
        } catch {
          // non-fatal, polling continues on next tick
        }
      }, POLL_INTERVAL_MS)

      // ── 6. Global 60s timeout ──────────────────────────────────────────────
      timeoutRef.current = setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true
          stopTimers()
          setPhase("timeout")
        }
      }, GLOBAL_TIMEOUT_MS)

      // ── 7. Sequential LLM calls: outer = LLMs, inner = prompts ────────────
      for (const llm of LLM_NAMES) {
        if (cancelled || doneRef.current) break

        setLlmStatus((prev) => ({ ...prev, [llm]: "running" }))

        for (let i = 0; i < prompts.length; i++) {
          if (cancelled || doneRef.current) break

          const prompt = prompts[i]
          setLlmPromptCount((prev) => ({ ...prev, [llm]: i + 1 }))

          try {
            await fetch("/api/audit/run-llm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                audit_id: auditId,
                prompt_id: prompt.id,
                prompt_text: prompt.text,
                llm_name: llm,
                brand_name: fetchedBrandName,
                // session stores url, run-llm expects domain
                competitors: competitors.map((c) => ({ name: c.name, domain: c.url })),
              }),
            })
          } catch {
            // silent failure — always continue to next call
          }
        }

        if (!cancelled) {
          setLlmStatus((prev) => ({ ...prev, [llm]: "completed" }))
        }
      }
    }

    run()

    return () => {
      cancelled = true
      stopTimers()
    }
  }, [router])

  // ─── Error / timeout UI ───────────────────────────────────────────────────────

  if (phase === "error" || phase === "timeout") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <p className="text-white text-xl font-semibold">
              {phase === "timeout" ? "Délai dépassé" : "Une erreur est survenue"}
            </p>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              {phase === "timeout"
                ? "L'analyse a pris trop de temps. Merci de réessayer."
                : (errorMessage ?? "Une erreur inattendue est survenue.")}
            </p>
          </div>
          <button
            onClick={() => router.push("/step-1")}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  // ─── Main scanning UI ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-white">Analyse en cours</h1>
          {brandName ? (
            <p className="text-gray-400 text-sm">
              Nous analysons la visibilité de{" "}
              <span className="text-white font-medium">{brandName}</span>
            </p>
          ) : (
            <p className="text-gray-600 text-sm">Initialisation...</p>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progression globale</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-1.5 bg-indigo-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* LLM rows */}
        <div className="space-y-3">
          {LLM_NAMES.map((llm) => {
            const status = llmStatus[llm]
            const count = llmPromptCount[llm]
            const label = LLM_LABELS[llm]

            return (
              <div
                key={llm}
                className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-5 py-4"
              >
                <div className="space-y-0.5">
                  <p className="text-white text-sm font-medium">{label}</p>
                  {status === "waiting" && (
                    <p className="text-gray-600 text-xs">En attente...</p>
                  )}
                  {status === "running" && (
                    <p className="text-indigo-400 text-xs">
                      Interrogation de {label}...{" "}
                      {totalPrompts > 0 && (
                        <span>
                          ({count}/{totalPrompts} prompts)
                        </span>
                      )}
                    </p>
                  )}
                  {status === "completed" && (
                    <p className="text-green-400 text-xs">Analyse terminée</p>
                  )}
                </div>

                <div className="flex-shrink-0 ml-4">
                  {status === "waiting" && (
                    <span className="block w-5 h-5 rounded-full border-2 border-gray-700" />
                  )}
                  {status === "running" && (
                    <svg
                      className="w-5 h-5 animate-spin text-indigo-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  )}
                  {status === "completed" && (
                    <svg
                      className="w-5 h-5 text-green-400"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-gray-700 text-xs">
          Cette analyse peut prendre jusqu&apos;à 60 secondes. Ne fermez pas cette page.
        </p>
      </div>
    </div>
  )
}
