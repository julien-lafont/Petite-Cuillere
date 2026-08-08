import { redirect } from "next/navigation";

/**
 * « Mon profil » n'existe plus comme écran : son unique contenu, le prénom de
 * l'utilisateur, vit désormais dans la carte « Vous » de `/foyer`. La route est
 * conservée en simple redirection pour les liens déjà partagés ou mis en
 * favori.
 *
 * Pas de `loading.tsx` ici, contrairement à la règle générale des routes
 * dynamiques (cf. AGENTS.md) : cette page n'affiche jamais rien, il n'y a donc
 * pas de coquille à précharger — c'est le squelette de `/foyer` qui prend le
 * relais après la redirection.
 */
export default function Page() {
  redirect("/foyer");
}
