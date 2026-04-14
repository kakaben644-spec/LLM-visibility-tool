import type { MentionAnalysis } from "@/lib/types";

interface EntityOccurrence {
  entity_name: string;
  entity_type: "brand" | "competitor";
  firstIdx: number;
  mention_count: number;
}

function countOccurrences(text: string, nameLower: string): { firstIdx: number; count: number } {
  const lower = text.toLowerCase();
  let count = 0;
  let firstIdx = -1;
  let searchIdx = 0;

  while (true) {
    const found = lower.indexOf(nameLower, searchIdx);
    if (found === -1) break;
    if (firstIdx === -1) firstIdx = found;
    count++;
    searchIdx = found + nameLower.length;
  }

  return { firstIdx, count };
}

export function detectMentions(
  text: string,
  brandName: string,
  competitors: string[]
): MentionAnalysis[] {
  const entities: Array<{ name: string; type: "brand" | "competitor" }> = [
    { name: brandName, type: "brand" },
    ...competitors.map((c) => ({ name: c, type: "competitor" as const })),
  ];

  // Collect occurrence data for each entity
  const occurrences: EntityOccurrence[] = entities.map(({ name, type }) => {
    const { firstIdx, count } = countOccurrences(text, name.toLowerCase());
    return {
      entity_name: name,
      entity_type: type,
      firstIdx,
      mention_count: count,
    };
  });

  // Rank mentioned entities by position of first occurrence (ascending)
  const mentioned = occurrences
    .filter((e) => e.firstIdx !== -1)
    .sort((a, b) => a.firstIdx - b.firstIdx);

  const positionMap = new Map<string, number>();
  mentioned.forEach((e, idx) => {
    positionMap.set(e.entity_name, idx + 1);
  });

  return occurrences.map((e) => ({
    entity_name: e.entity_name,
    entity_type: e.entity_type,
    is_mentioned: e.mention_count > 0,
    mention_count: e.mention_count,
    position: positionMap.get(e.entity_name) ?? null,
  }));
}
