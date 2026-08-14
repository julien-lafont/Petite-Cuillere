import { AlertTriangle } from "lucide-react";

/**
 * The allergen introduction warning — the one place the screen changes register
 * (see docs/ux-redesign.md §5).
 *
 * It informs, and that is all. It used to ask for confirmation too ("Œuf dur, il
 * l'a bien eu ?", two buttons) to catch the case where the child gets the purée
 * but not the spoonful of egg. The price was out of proportion: two competing
 * questions on one meal, in two different button shapes — this one at the top of
 * the card, the report's at the bottom — for a nuance the parent can express
 * another way anyway ("le menu a changé", or a dictation). A confirmed meal now
 * counts as an exposure, like everything else.
 *
 * The tone informs without alarming: this banner speaks to an already anxious
 * parent. It lives inside the relevant meal's card (`MealCard`, the `notice`
 * prop) rather than above it, where it read as a message with no owner.
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
