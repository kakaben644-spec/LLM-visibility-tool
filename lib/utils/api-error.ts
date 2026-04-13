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

// ─── Factory helpers ──────────────────────────────────────────────────────────

export function notFound(message = "Ressource introuvable"): AppError {
  return new AppError(message, API_ERROR_CODES.NOT_FOUND, 404);
}

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

export function databaseError(message = "Erreur de base de données"): AppError {
  return new AppError(message, API_ERROR_CODES.DATABASE_ERROR, 500);
}

// ─── Response helpers ─────────────────────────────────────────────────────────

export function errorResponse(
  error: unknown
): NextResponse<{ ok: false; error: string; code: string }> {
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

export function successResponse<T>(
  data: T,
  status = 200
): NextResponse<{ ok: true; data: T }> {
  return NextResponse.json({ ok: true, data }, { status });
}
