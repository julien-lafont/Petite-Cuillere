import { redirect } from "next/navigation";

/**
 * "Mon profil" no longer exists as a screen: its only content, the user's first
 * name, now lives in the "Vous" card on `/foyer`. The route is kept as a plain
 * redirect for links already shared or bookmarked.
 *
 * No `loading.tsx` here, unlike the general rule for dynamic routes (see
 * AGENTS.md): this page never renders anything, so there is no shell to
 * prefetch — `/foyer`'s skeleton takes over after the redirect.
 */
export default function Page() {
  redirect("/foyer");
}
