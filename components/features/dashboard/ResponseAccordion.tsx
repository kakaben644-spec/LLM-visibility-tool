import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { HighlightedText } from "./HighlightedText";
import type { LlmResponse } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResponseAccordionProps {
  responses: LlmResponse[];
  brandName: string;
  competitors: string[];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptGroup {
  prompt_id: string;
  prompt_text: string;
  byLlm: Map<string, LlmResponse>;
}

// LLM display order and labels
const LLM_ORDER: Array<{ key: string; label: string }> = [
  { key: "gpt-4o", label: "GPT-4o" },
  { key: "claude-sonnet", label: "Claude Sonnet" },
  { key: "claude-haiku", label: "Claude Haiku" },
  { key: "gemini-pro", label: "Gemini Pro" },
  { key: "mistral", label: "Mistral" },
];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function isMentioned(text: string | null, brandName: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(brandName.toLowerCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResponseAccordion({
  responses,
  brandName,
  competitors,
}: ResponseAccordionProps) {
  // Group by prompt_id, preserving first-seen order
  const groupMap = new Map<string, PromptGroup>();

  for (const r of responses) {
    if (!groupMap.has(r.prompt_id)) {
      groupMap.set(r.prompt_id, {
        prompt_id: r.prompt_id,
        prompt_text: r.prompt_text,
        byLlm: new Map(),
      });
    }
    groupMap.get(r.prompt_id)!.byLlm.set(r.llm_name, r);
  }

  const groups = Array.from(groupMap.values());

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Aucune réponse disponible.
      </p>
    );
  }

  return (
    <Accordion type="multiple" className="w-full">
      {groups.map((group, idx) => (
        <AccordionItem key={group.prompt_id} value={group.prompt_id}>
          <AccordionTrigger className="text-left">
            <span className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                {idx + 1}.
              </span>
              <span>{truncate(group.prompt_text, 80)}</span>
            </span>
          </AccordionTrigger>

          <AccordionContent>
            <div className="space-y-4 pt-1">
              {LLM_ORDER.map(({ key, label }) => {
                const response = group.byLlm.get(key);
                const mentioned =
                  response != null &&
                  isMentioned(response.response_text, brandName);

                return (
                  <div key={key} className="rounded-lg border p-4 space-y-2">
                    {/* LLM heading + badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </span>
                      {response == null ? (
                        <Badge variant="outline" className="text-xs">
                          Non exécuté
                        </Badge>
                      ) : mentioned ? (
                        <Badge className="bg-green-600 hover:bg-green-600 text-white border-0 text-xs">
                          Mentionné
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Absent
                        </Badge>
                      )}
                    </div>

                    {/* Response body */}
                    {response == null || response.response_text == null ? (
                      <p className="text-sm italic text-muted-foreground">
                        Aucune réponse
                      </p>
                    ) : (
                      <HighlightedText
                        text={response.response_text}
                        brandTerms={[brandName]}
                        competitorTerms={competitors}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
