import { AlertTriangle } from "lucide-react";

/**
 * L'avertissement d'introduction d'un allergène — le seul endroit où l'écran
 * change de registre (cf. docs/ux-redesign.md §5).
 *
 * Il informe, et c'est tout. Il demandait aussi une confirmation (« Œuf dur, il
 * l'a bien eu ? », deux boutons) pour attraper le cas où l'enfant reçoit la
 * purée mais pas la cuillère d'œuf. Le prix était disproportionné : deux
 * questions concurrentes sur un même repas, dans deux formes de bouton
 * différentes — celle-ci en haut de fiche, celle du compte rendu en bas — pour
 * une finesse que le parent peut de toute façon dire autrement (« le menu a
 * changé », ou la dictée). Un repas confirmé vaut désormais exposition, comme
 * pour tout le reste.
 *
 * Le ton informe sans alarmer : ce bandeau s'adresse à un parent déjà inquiet.
 * Il vit dans la fiche du repas concerné (`MealCard`, prop `notice`) et non
 * au-dessus d'elle, où il se lisait comme un message sans propriétaire.
 */
export function AllergenExposureBanner({
  allergenName,
  foodName,
}: {
  allergenName: string;
  foodName: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-novelty/30 bg-novelty-soft px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-novelty" />
      <p className="text-foreground/85">
        Aujourd'hui, première fois avec{" "}
        <span className="font-semibold">{allergenName.toLowerCase()}</span>,
        dans {foodName.toLowerCase()}. Proposez-le plutôt le matin ou le midi et
        restez attentif dans les heures qui suivent.
      </p>
    </div>
  );
}
