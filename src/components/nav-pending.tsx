"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * Marqueur d'attente à placer **à l'intérieur** d'un `<Link>` : il porte
 * `data-pending` tant que la navigation n'a pas abouti.
 *
 * Deux effets, volontairement décalés dans le temps :
 *
 *   0 ms    le lien prend son apparence active — c'est le `has-[[data-pending]]`
 *           posé sur le lien parent. Le clic est acquitté sur-le-champ, avant
 *           même que le serveur ait répondu.
 *   150 ms  ce marqueur-ci s'allume et pulse. Le délai évite qu'il clignote
 *           inutilement quand la page était préchargée et arrive tout de suite.
 *
 * L'élément occupe toujours sa place (`visibility` et non `display`) : son
 * apparition ne décale jamais le libellé voisin.
 */
export function NavPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className={cn("nav-hint", className)}
    />
  );
}
