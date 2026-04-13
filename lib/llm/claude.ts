import Anthropic from "@anthropic-ai/sdk";
import type { LLMCallResult } from "@/lib/types";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquant dans les variables d'environnement");
  return new Anthropic({ apiKey });
}

export async function callClaude(promptText: string): Promise<LLMCallResult> {
  const start = Date.now();
  try {
    const client = getClient();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      messages: [{ role: "user", content: promptText }],
    });

    const firstBlock = response.content[0];
    const text = firstBlock?.type === "text" ? firstBlock.text : "";

    return {
      response_text: text,
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
      latency_ms: Date.now() - start,
    };
  } catch (err) {
    return {
      response_text: "",
      latency_ms: Date.now() - start,
      error: err instanceof Error ? err.message : "Erreur Claude inconnue",
    };
  }
}
