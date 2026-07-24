/**
 * Identité publique du site. Centralisé ici pour qu'un changement de domaine ne
 * se traduise jamais par une chasse aux URL en dur dans les composants.
 *
 * L'application elle-même reste agnostique du domaine : les redirections d'auth
 * dérivent de `window.location.origin` / de l'origine de la requête. Ces valeurs
 * ne servent qu'aux métadonnées absolues (Open Graph, canonique, sitemap), qui
 * ne peuvent pas être relatives.
 */

/** Domaine de production. Surchargeable par `NEXT_PUBLIC_SITE_URL`. */
const FALLBACK_URL = "https://petite-cuillere.fr";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_URL
).replace(/\/+$/, "");

export const SITE_NAME = "Petite Cuillère";

export const SITE_DESCRIPTION =
  "Les premiers repas de bébé, en toute confiance. Chaque jour, on vous dit quoi cuisiner, comment et en quelle quantité.";

/**
 * `VERCEL_ENV` vaut « preview » sur les déploiements de branche et « development »
 * en local. On s'en sert pour ne jamais laisser indexer autre chose que la prod :
 * un aperçu référencé par Google ferait doublon avec le vrai site.
 * Hors Vercel, la variable est absente — on suppose alors la production.
 */
export const isProductionSite =
  !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";
