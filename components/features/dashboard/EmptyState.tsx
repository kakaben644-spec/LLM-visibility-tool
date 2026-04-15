import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="text-6xl" role="img" aria-label="Loupe">
          🔍
        </span>
        <h2 className="text-xl font-semibold">
          Votre marque n&apos;a pas été mentionnée
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Aucun LLM n&apos;a cité votre marque dans ses réponses. Consultez les
          recommandations pour améliorer votre visibilité.
        </p>
        <Button disabled>Voir les recommandations</Button>
      </CardContent>
    </Card>
  );
}
