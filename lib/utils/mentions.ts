import type { MentionAnalysis } from "@/lib/types";

interface DetectMentionsParams {
  responseText: string;
  brandName: string;
  competitors: Array<{ name: string; domain: string }>;
}

function analyzeEntity(
  responseText: string,
  name: string,
  entityType: "brand" | "competitor"
): MentionAnalysis {
  const lower = responseText.toLowerCase();
  const nameLower = name.toLowerCase();
  const totalLength = responseText.length;

  let mentionCount = 0;
  let firstIdx = -1;
  let searchIdx = 0;

  while (true) {
    const found = lower.indexOf(nameLower, searchIdx);
    if (found === -1) break;
    if (firstIdx === -1) firstIdx = found;
    mentionCount++;
    searchIdx = found + nameLower.length;
  }

  const isMentioned = mentionCount > 0;

  // Position : rang approximatif 1-10 basé sur la position relative dans le texte
  const position =
    isMentioned && totalLength > 0
      ? Math.round((firstIdx / totalLength) * 10) + 1
      : null;

  return {
    entity_name: name,
    entity_type: entityType,
    is_mentioned: isMentioned,
    position,
    mention_count: mentionCount,
  };
}

export function detectMentions({
  responseText,
  brandName,
  competitors,
}: DetectMentionsParams): MentionAnalysis[] {
  return [
    analyzeEntity(responseText, brandName, "brand"),
    ...competitors.map((c) => analyzeEntity(responseText, c.name, "competitor")),
  ];
}
