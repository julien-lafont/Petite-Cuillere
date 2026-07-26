import type { Metadata } from "next";
import Link from "next/link";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";
import { DiscoverFlow } from "@/components/discover-flow";

export const metadata: Metadata = {
  title: "Découvrir le programme de bébé",
  description:
    "Quelques questions et vous voyez le programme de diversification de votre bébé, tout de suite. Sans compte, sans engagement.",
};

/**
 * Entrée publique du produit : le parent répond à quelques questions et voit son
 * programme, **sans créer de compte** (cf. docs/ux-redesign.md §3.5).
 *
 * Le catalogue commun (`household_id is null`) est lisible sans être connecté :
 * la policy RLS `read foods` autorise ce cas. On le passe au client, qui calcule
 * le programme en mémoire — rien n'est écrit en base à ce stade.
 */
export default async function DecouvrirPage() {
  const [foods, allergens] = await Promise.all([getFoods(), getAllergens()]);

  // Garde-fou : sans catalogue, le programme serait vide sans que le parent
  // comprenne pourquoi. On préfère un message clair et une porte de sortie.
  if (foods.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Le programme n'est pas disponible pour l'instant
          </h1>
          <p className="mt-3 text-muted-foreground">
            Impossible de charger le catalogue d'aliments. Réessayez dans un
            instant — ou connectez-vous, votre espace reste accessible.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex h-12 items-center rounded-md bg-primary px-6 font-semibold text-primary-foreground"
          >
            Se connecter
          </Link>
        </div>
      </main>
    );
  }

  return <DiscoverFlow foods={foods} allergens={allergens} />;
}
