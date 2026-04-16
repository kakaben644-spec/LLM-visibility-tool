// ─── LLM Models ────────────────────────────────────────────────────────────────

export type LlmProvider = "openai" | "anthropic" | "gemini";

export const LLM_PROVIDERS: LlmProvider[] = ["openai", "anthropic", "gemini"];

export const LLM_LABELS: Record<LlmProvider, string> = {
  openai: "GPT-4o",
  anthropic: "Claude",
  gemini: "Gemini",
};

// ─── Session ───────────────────────────────────────────────────────────────────

export interface OnboardingSession {
  id: string;
  session_token: string;
  brand_name: string | null;
  brand_url: string | null;
  brand_description: string | null;
  industry: string | null;
  competitors: string[];
  keywords: string[];
  created_at: string;
  updated_at: string;
}

// ─── Audit ─────────────────────────────────────────────────────────────────────

export type AuditStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface Audit {
  id: string;
  session_token: string;
  brand_name: string;
  brand_url: string | null;
  brand_description: string | null;
  industry: string | null;
  competitors: string[];
  keywords: string[];
  status: AuditStatus;
  global_score: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ─── LLM Results ───────────────────────────────────────────────────────────────

export type MentionType = "direct" | "indirect" | "absent";

export interface LlmResult {
  id: string;
  audit_id: string;
  provider: LlmProvider;
  prompt: string;
  response: string;
  mention_type: MentionType;
  is_mentioned: boolean;
  is_recommended: boolean;
  position_in_response: number | null;
  score: number;
  competitors_mentioned: string[];
  sentiment: "positive" | "neutral" | "negative" | null;
  created_at: string;
}

// ─── Scores ────────────────────────────────────────────────────────────────────

export interface ScoreRankingEntry {
  entity_name: string;
  entity_type: "brand" | "competitor";
  total_score: number;
  score_gpt4o: number;
  score_claude: number;
  score_gemini: number;
}

export interface AuditScoreApiData {
  brand_name: string;
  brand_score: number;
  ranking: ScoreRankingEntry[];
}

export interface ScoreBreakdown {
  visibility: number;      // 0–100 : fréquence de mention
  recommendation: number;  // 0–100 : fréquence de recommandation
  sentiment: number;       // 0–100 : sentiment moyen
  position: number;        // 0–100 : position moyenne dans les réponses
  global: number;          // 0–100 : score global pondéré
}

export interface ProviderScore {
  provider: LlmProvider;
  label: string;
  score: ScoreBreakdown;
  result_count: number;
}

export interface AuditScores {
  global: ScoreBreakdown;
  by_provider: ProviderScore[];
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationCategory =
  | "content"
  | "seo"
  | "positioning"
  | "competitors"
  | "technical";

export interface Recommendation {
  id: string;
  audit_id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  description: string;
  action_items: string[];
  created_at: string;
}

// ─── Prompts ───────────────────────────────────────────────────────────────────

export interface GeneratedPrompt {
  id: string;
  audit_id: string;
  text: string;
  category: string;
  created_at: string;
}

// ─── Scrape ────────────────────────────────────────────────────────────────────

export interface ScrapeResult {
  url: string;
  title: string | null;
  description: string | null;
  content: string | null;
  keywords: string[];
  industry: string | null;
  success: boolean;
  error: string | null;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface CreateSessionPayload {
  brand_name: string;
  brand_url: string;
}

export interface UpdateSessionPayload {
  brand_name?: string;
  brand_url?: string;
  brand_description?: string;
  industry?: string;
  competitors?: string[];
  keywords?: string[];
}

export interface StartAuditPayload {
  session_token: string;
}

export interface RunLlmPayload {
  audit_id: string;
  provider: LlmProvider;
  prompt: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code?: string;
  status?: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardData {
  audit: Audit;
  scores: AuditScores;
  results: LlmResult[];
  recommendations: Recommendation[];
  prompts: GeneratedPrompt[];
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportOptions {
  audit_id: string;
  include_recommendations: boolean;
  include_details: boolean;
}

// ─── LLM Call Result ──────────────────────────────────────────────────────────

export interface LLMCallResult {
  response_text: string;
  tokens_used?: number;
  latency_ms: number;
  error?: string;
}

// ─── LLM Response (from llm_responses joined with prompts) ───────────────────

export interface LlmResponse {
  id: string;
  prompt_id: string;
  prompt_text: string;
  llm_name: string;
  response_text: string | null;
  error: string | null;
}

// ─── Mention Analysis ─────────────────────────────────────────────────────────

export interface MentionAnalysis {
  entity_name: string;
  entity_type: "brand" | "competitor";
  is_mentioned: boolean;
  position: number | null;
  mention_count: number;
}
