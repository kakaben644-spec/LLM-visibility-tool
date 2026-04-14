import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScoreRankingEntry } from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScoreCardProps {
  brandName: string;
  brandScore: number;
  ranking: ScoreRankingEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ScoreBadge({ score }: { score: number }) {
  if (score < 30) {
    return <Badge variant="destructive">{score}/100</Badge>;
  }
  if (score <= 60) {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0">
        {score}/100
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-600 hover:bg-green-600 text-white border-0">
      {score}/100
    </Badge>
  );
}

function ScorePill({ label, score }: { label: string; score: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <span className="font-medium">{label}</span>
      <span>{score}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScoreCard({ brandName, brandScore, ranking }: ScoreCardProps) {
  const sorted = [...ranking].sort((a, b) => b.total_score - a.total_score);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Score de visibilité
        </CardTitle>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-5xl font-bold tabular-nums">{brandScore}</span>
          <div className="flex flex-col gap-1">
            <span className="text-lg text-muted-foreground">/100</span>
            <ScoreBadge score={brandScore} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{brandName}</p>
      </CardHeader>

      <CardContent>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                <th className="pb-2 text-left w-8">#</th>
                <th className="pb-2 text-left">Entité</th>
                <th className="pb-2 text-right w-14">Score</th>
                <th className="pb-2 w-32 hidden sm:table-cell" />
                <th className="pb-2 text-right hidden md:table-cell">
                  Par LLM
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, idx) => {
                const isBrand = entry.entity_type === "brand";
                return (
                  <tr key={entry.entity_name} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground">{idx + 1}</td>
                    <td
                      className={`py-2 pr-4 ${
                        isBrand ? "font-bold" : "font-normal"
                      }`}
                    >
                      {entry.entity_name}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {entry.total_score}
                    </td>
                    <td className="py-2 pl-3 hidden sm:table-cell">
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isBrand ? "bg-orange-500" : "bg-gray-400"
                          }`}
                          style={{
                            width: `${Math.min(100, entry.total_score)}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-2 pl-3 hidden md:table-cell">
                      <div className="flex justify-end gap-1 flex-wrap">
                        <ScorePill label="GPT" score={entry.score_gpt4o} />
                        <ScorePill label="Claude" score={entry.score_claude} />
                        <ScorePill label="Gemini" score={entry.score_gemini} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
