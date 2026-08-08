import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import {
  ALLERGENES_SEO,
  MethodAllergenesContent,
} from "@/components/method-allergenes";
import { getPublicAllergens } from "@/lib/data/allergens";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

export const metadata: Metadata = {
  title: ALLERGENES_SEO.title,
  description: ALLERGENES_SEO.description,
  alternates: { canonical: ALLERGENES_URL },
  openGraph: {
    url: ALLERGENES_URL,
    title: ALLERGENES_SEO.ogTitle,
    description: ALLERGENES_SEO.description,
  },
};

/**
 * Version **publique** de la page allergènes, et la seule qui soit indexée.
 *
 * Elle est prérendue au build, ce qui change tout pour un visiteur : Next
 * précharge alors la route entière au survol du lien, et le clic n'entraîne
 * aucun aller-retour serveur — la page est là, immédiatement. Une route rendue
 * à la demande, elle, ne se précharge que jusqu'à son squelette.
 *
 * D'où les deux contraintes à tenir ici, sous peine de retomber en dynamique
 * sans que rien ne le signale à la relecture :
 *
 *   1. aucune API de requête (`cookies()`, `headers()`, `searchParams`) — le
 *      catalogue passe donc par `getPublicAllergens`, sans session ;
 *   2. la coquille publique est écrite dans la page, pas héritée d'un layout
 *      qui, lui, arbitre selon le visiteur.
 *
 * Le contrôle se fait au build : la route doit être marquée statique dans la
 * sortie de `next build`, pas `ƒ`.
 *
 * Le pendant connecté vit sur `/methode/allergenes`, dans la coquille de l'app.
 */
export const revalidate = 3600;

export default async function Page() {
  // Catalogue commun uniquement : un visiteur sans compte n'a pas de foyer, donc
  // pas d'allergène propre à afficher.
  const allergens = await getPublicAllergens();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      {/*
       * La largeur de colonne est posée par le contenu lui-même, comme sur les
       * pages « méthode » : on ne règle ici que les marges et le rythme.
       */}
      <main className="px-5 py-12 md:px-8 md:py-16">
        <MethodAllergenesContent
          name="votre enfant"
          allergens={allergens}
          methodeHref={METHODE_URL}
          trail={[
            { label: "Accueil", href: "/" },
            { label: "La méthode", href: METHODE_URL },
            { label: "Allergènes" },
          ]}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
