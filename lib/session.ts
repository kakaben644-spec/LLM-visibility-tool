// ---------------------------------------------------------------------------
// Helpers de session côté client (browser uniquement)
// Ce fichier ne contient que des fonctions pures — pas de composant React,
// pas de "use client". Appelé depuis des Client Components.
// ---------------------------------------------------------------------------
//
// Clés localStorage :
//   llmv_session         → session_token de l'onboarding (UUID)
//   llmv_current_audit   → id de l'audit en cours (UUID)
//   llmv_brand_name      → nom de la marque (step 1)
//   llmv_brand_url       → URL du site de la marque (step 1)
// ---------------------------------------------------------------------------

const SESSION_TOKEN_KEY = "llmv_session" as const;
const CURRENT_AUDIT_KEY = "llmv_current_audit" as const;
const BRAND_NAME_KEY = "llmv_brand_name" as const;
const BRAND_URL_KEY = "llmv_brand_url" as const;

// ---------------------------------------------------------------------------
// Session token
// ---------------------------------------------------------------------------

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_TOKEN_KEY);
}

export function setSessionToken(token: string): void {
  window.localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
}

// ---------------------------------------------------------------------------
// Audit courant
// ---------------------------------------------------------------------------

export function getCurrentAuditId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CURRENT_AUDIT_KEY);
}

export function setCurrentAuditId(id: string): void {
  window.localStorage.setItem(CURRENT_AUDIT_KEY, id);
}

export function clearCurrentAuditId(): void {
  window.localStorage.removeItem(CURRENT_AUDIT_KEY);
}

// ---------------------------------------------------------------------------
// Données marque (step 1)
// ---------------------------------------------------------------------------

export function getBrandName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRAND_NAME_KEY);
}

export function setBrandName(name: string): void {
  window.localStorage.setItem(BRAND_NAME_KEY, name);
}

export function getBrandUrl(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BRAND_URL_KEY);
}

export function setBrandUrl(url: string): void {
  window.localStorage.setItem(BRAND_URL_KEY, url);
}

// ---------------------------------------------------------------------------
// Utilitaire : reset complet (onboarding terminé ou abandonné)
// ---------------------------------------------------------------------------

export function clearAllSession(): void {
  clearSessionToken();
  clearCurrentAuditId();
  window.localStorage.removeItem(BRAND_NAME_KEY);
  window.localStorage.removeItem(BRAND_URL_KEY);
}
