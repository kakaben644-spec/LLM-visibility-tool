import type { LLMCallResult } from "@/lib/types";

interface MistralMessage {
  content: string;
}

interface MistralChoice {
  message?: MistralMessage;
}

interface MistralApiResponse {
  choices?: MistralChoice[];
}

export async function callMistral(prompt: string): Promise<LLMCallResult> {
  const start = Date.now();
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY manquant dans les variables d'environnement");

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[callMistral] API error:", error);
      return { response_text: "", success: false, latency_ms: Date.now() - start };
    }

    const data = (await response.json()) as MistralApiResponse;
    const text = data.choices?.[0]?.message?.content ?? "";
    return { response_text: text, success: true, latency_ms: Date.now() - start };
  } catch (e) {
    console.error("[callMistral] LLM call failed:", e);
    return { response_text: "", success: false, latency_ms: Date.now() - start };
  }
}
