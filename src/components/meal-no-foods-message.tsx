import Link from "next/link";
import { Baby, ArrowRight } from "lucide-react";

/** Affiché à la place des formulaires quand aucun aliment du catalogue n'est encore adapté à l'âge du bébé. */
export function MealNoFoodsMessage() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center">
      <Baby className="size-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Aucun aliment adapté à cet âge</p>
        <p className="mt-1 text-sm text-muted-foreground">
          La diversification alimentaire n'a pas encore commencé pour ce repas —
          reviens ici une fois l'âge d'introduction atteint.
        </p>
      </div>
      <Link
        href="/bebe"
        className="flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voir la fiche de l'enfant
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
