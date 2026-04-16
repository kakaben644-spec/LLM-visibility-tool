interface HighlightedTextProps {
  text: string;
  brandTerms: string[];
  competitorTerms: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function HighlightedText({
  text,
  brandTerms,
  competitorTerms,
}: HighlightedTextProps) {
  if (!text || (brandTerms.length === 0 && competitorTerms.length === 0)) {
    return <span>{text}</span>;
  }

  // Build lookup sets (lowercased). Brand takes priority over competitor.
  const brandSet = new Set(brandTerms.map((t) => t.toLowerCase()));
  const competitorSet = new Set(
    competitorTerms
      .filter((t) => !brandSet.has(t.toLowerCase()))
      .map((t) => t.toLowerCase())
  );

  // Collect all unique terms, sorted longest-first to prefer longer matches
  const allTerms = [
    ...brandTerms,
    ...competitorTerms.filter((t) => !brandSet.has(t.toLowerCase())),
  ].sort((a, b) => b.length - a.length);

  if (allTerms.length === 0) {
    return <span>{text}</span>;
  }

  const pattern = allTerms.map(escapeRegex).join("|");
  const regex = new RegExp(`(${pattern})`, "gi");

  // split() with a capturing group returns [before, match, before, match, ...]
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, idx) => {
        const lower = part.toLowerCase();

        if (brandSet.has(lower)) {
          return (
            <span
              key={idx}
              className="bg-orange-100 text-orange-800 rounded px-0.5"
            >
              {part}
            </span>
          );
        }

        if (competitorSet.has(lower)) {
          return (
            <span
              key={idx}
              className="bg-gray-100 text-gray-700 rounded px-0.5"
            >
              {part}
            </span>
          );
        }

        return part;
      })}
    </span>
  );
}
