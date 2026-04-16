import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMCallResult } from "@/lib/types";

export async function callGemini(promptText: string): Promise<LLMCallResult> {
  const start = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY manquant dans les variables d'environnement");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { maxOutputTokens: 500 },
    });

    const result = await model.generateContent(promptText);
    const text = result.response.text();

    return {
      response_text: text,
      success: true,
      tokens_used: result.response.usageMetadata?.totalTokenCount,
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    console.error("[callGemini] LLM call failed:", err);
    return {
      response_text: "",
      success: false,
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Erreur Gemini inconnue",
    };
  }
}
