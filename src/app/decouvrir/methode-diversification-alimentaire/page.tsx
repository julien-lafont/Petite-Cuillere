import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import {
  DIVERSIFICATION_SEO,
  MethodDiversificationContent,
} from "@/components/method-diversification";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

export const metadata: Metadata = {
  title: DIVERSIFICATION_SEO.title,
  description: DIVERSIFICATION_SEO.description,
  alternates: { canonical: METHODE_URL },
  openGraph: {
    url: METHODE_URL,
    title: DIVERSIFICATION_SEO.ogTitle,
    description: DIVERSIFICATION_SEO.description,
  },
};

/**
 * Version **publique** de la page méthode, et la seule qui soit indexée.
 *
 * Elle est prérendue au build, ce qui change tout pour un visiteur : Next
 * précharge alors la route entière au survol du lien, et le clic n'entraîne
 * aucun aller-retour serveur — la page est là, immédiatement. Une route rendue
 * à la demande, elle, ne se précharge que jusqu'à son squelette.
 *
 * D'où les deux contraintes à tenir ici, sous peine de retomber en dynamique
 * sans que rien ne le signale à la relecture :
 *
 *   1. aucune API de requête (`cookies()`, `headers()`, `searchParams`) — donc
 *      pas de `getActiveBaby()`, et un texte écrit pour « votre enfant » ;
 *   2. la coquille publique est écrite dans la page, pas héritée d'un layout
 *      qui, lui, arbitre selon le visiteur.
 *
 * Le contrôle se fait au build : la route doit être marquée statique dans la
 * sortie de `next build`, pas `ƒ`.
 *
 * Le pendant connecté vit sur `/methode`, dans la coquille de l'app.
 */
export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      {/*
       * La largeur de colonne est posée par le contenu lui-même, comme sur les
       * pages « méthode » : on ne règle ici que les marges et le rythme.
       */}
      <main className="px-5 py-12 md:px-8 md:py-16">
        <MethodDiversificationContent
          name="votre enfant"
          il="il"
          allergenesHref={ALLERGENES_URL}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
