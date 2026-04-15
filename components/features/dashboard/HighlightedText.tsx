import { Fragment } from "react";

interface HighlightedTextProps {
  text: string;
  terms: string[]; // brand name + competitors
}

// Split text into segments, marking which segments match a term.
function buildSegments(
  text: string,
  terms: string[]
): Array<{ value: string; highlight: boolean }> {
  if (terms.length === 0) return [{ value: text, highlight: false }];

  // Build a single alternation regex from all non-empty terms.
  const pattern = terms
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  if (!pattern) return [{ value: text, highlight: false }];

  const re = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(re);

  return parts.map((part) => ({
    value: part,
    highlight: re.test(part),
  }));
}

export function HighlightedText({ text, terms }: HighlightedTextProps) {
  const segments = buildSegments(text, terms);

  return (
    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded px-0.5"
          >
            {seg.value}
          </mark>
        ) : (
          <Fragment key={i}>{seg.value}</Fragment>
        )
      )}
    </p>
  );
}
