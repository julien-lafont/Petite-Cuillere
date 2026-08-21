/**
 * Public identity of the site. Kept here so a domain change never turns into a
 * hunt for hard-coded URLs across components.
 *
 * The app itself stays domain-agnostic: auth redirects derive from
 * `window.location.origin` or the request origin. These values only feed
 * absolute metadata — Open Graph, canonical, sitemap — which cannot be relative.
 */

/** Production domain. Overridable with `NEXT_PUBLIC_SITE_URL`. */
const FALLBACK_URL = "https://petite-cuillere.fr";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_URL
).replace(/\/+$/, "");

export const SITE_NAME = "Petite Cuillère";

export const SITE_DESCRIPTION =
  "Les premiers repas de bébé, en toute confiance. Chaque jour, on vous dit quoi cuisiner, comment et en quelle quantité.";

/**
 * `VERCEL_ENV` is "preview" on branch deployments and "development" locally. We
 * use it so nothing but production is ever indexable: an indexed preview would
 * compete with the real site. Outside Vercel the variable is absent — assume
 * production then.
 */
export const isProductionSite =
  !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";

/**
 * The public repository. The app being open source is part of what we tell
 * parents, so the address is site identity like the domain is, not a developer
 * detail buried in a component.
 */
export const GITHUB_URL = "https://github.com/julien-lafont/Petite-Cuillere";
