import { NextResponse } from "next/server";
import { ZodError } from "zod";

// ─── Error codes ───────────────────────────────────────────────────────────────

export const API_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  LLM_ERROR: "LLM_ERROR",
  SCRAPE_ERROR: "SCRAPE_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// ─── Custom error class ───────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;

  constructor(message: string, code: ApiErrorCode, status = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

// ─── AppError factory helpers (throw-able, for LLM/scrape errors) ────────────

export function unauthorized(message = "Non autorisé"): AppError {
  return new AppError(message, API_ERROR_CODES.UNAUTHORIZED, 401);
}

export function rateLimited(message = "Trop de requêtes"): AppError {
  return new AppError(message, API_ERROR_CODES.RATE_LIMITED, 429);
}

export function llmError(message = "Erreur du modèle de langage"): AppError {
  return new AppError(message, API_ERROR_CODES.LLM_ERROR, 502);
}

export function scrapeError(message = "Erreur lors du scraping"): AppError {
  return new AppError(message, API_ERROR_CODES.SCRAPE_ERROR, 502);
}

// ─── Response helpers ─────────────────────────────────────────────────────────

// Overload 1: direct response creation with explicit string/code/status
export function errorResponse(
  error: string,
  code: string,
  status: number,
  details?: unknown
): NextResponse<{ ok: false; error: string; code: string; details?: unknown }>;
// Overload 2: dispatch on error type (for catch blocks)
export function errorResponse(
  error: unknown
): NextResponse<{ ok: false; error: string; code: string }>;
// Implementation
export function errorResponse(
  error: unknown,
  code?: string,
  status?: number,
  details?: unknown
): NextResponse {
  if (typeof error === "string" && code !== undefined && status !== undefined) {
    return NextResponse.json(
      { ok: false, error, code, ...(details !== undefined ? { details } : {}) },
      { status }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    const message = error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    return NextResponse.json(
      { ok: false, error: message, code: API_ERROR_CODES.VALIDATION_ERROR },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    console.error("[API Error]", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Une erreur interne est survenue",
        code: API_ERROR_CODES.INTERNAL_ERROR,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Erreur inconnue",
      code: API_ERROR_CODES.INTERNAL_ERROR,
    },
    { status: 500 }
  );
}

export function notFound(resource = "Ressource introuvable"): NextResponse<{ ok: false; error: string; code: string }> {
  return NextResponse.json(
    { ok: false, error: resource, code: API_ERROR_CODES.NOT_FOUND },
    { status: 404 }
  );
}

export function databaseError(details?: unknown): NextResponse<{ ok: false; error: string; code: string; details?: unknown }> {
  return NextResponse.json(
    {
      ok: false,
      error: "Erreur de base de données",
      code: API_ERROR_CODES.DATABASE_ERROR,
      ...(details !== undefined ? { details } : {}),
    },
    { status: 500 }
  );
}

export function successResponse<T>(
  data: T,
  status = 200
): NextResponse<{ ok: true; data: T }> {
  return NextResponse.json({ ok: true, data }, { status });
}
