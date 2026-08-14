import { cn } from "@/lib/utils";
import { avatarStyle } from "@/lib/avatar-colors";

/**
 * A child's badge: their initial in a coloured circle. Purely decorative
 * (`aria-hidden`) because the first name is always shown next to it or just
 * above — announcing it twice would add nothing.
 *
 * Size and typography are left to the caller through `className`, badges ranging
 * from 20 px (menu) to 64 px (the /bebe card).
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
