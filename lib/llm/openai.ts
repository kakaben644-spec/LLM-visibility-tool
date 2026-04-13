import OpenAI from "openai";
import type { LLMCallResult } from "@/lib/types";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquant dans les variables d'environnement");
  return new OpenAI({ apiKey });
}

export async function callOpenAI(promptText: string): Promise<LLMCallResult> {
  const start = Date.now();
  try {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: promptText }],
      max_tokens: 500,
    });

    return {
      response_text: response.choices[0]?.message?.content ?? "",
      tokens_used: response.usage?.total_tokens,
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      response_text: "",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Erreur OpenAI inconnue",
    };
  }
}
