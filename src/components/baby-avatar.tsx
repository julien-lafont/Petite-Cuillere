import { cn } from "@/lib/utils";
import { avatarStyle } from "@/lib/avatar-colors";

/**
 * Pastille d'un enfant : son initiale dans un cercle coloré. Rendue purement
 * décorative (`aria-hidden`) car le prénom est toujours affiché à côté ou
 * juste au-dessus — l'annoncer deux fois n'apporterait rien.
 *
 * La taille et la typo restent à la charge de l'appelant via `className`, les
 * pastilles allant de 20 px (menu) à 64 px (fiche /bebe).
 */
export function BabyAvatar({
  prenom,
  color,
  className,
}: {
  prenom: string;
  color: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={avatarStyle(color)}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold",
        className,
      )}
    >
      {prenom.charAt(0).toUpperCase()}
    </span>
  );
}
