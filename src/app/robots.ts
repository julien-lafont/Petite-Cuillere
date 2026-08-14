import type { MetadataRoute } from "next";
import { SITE_URL, isProductionSite } from "@/lib/site";

/**
 * Only the public pages are meant to be indexed: the landing, the no-account
 * entry point, and the two method pages. Everything behind authentication
 * concerns one household and has no business in a search engine. Preview
 * deployments are closed off entirely.
 *
 * `/methode` stays explicitly allowed even though it is `noindex`: visiting it
 * is how a crawler reads the tag and the canonical to the public version.
 * Disallowing it here would instead let it index the URL blind, on the strength
 * of inbound links alone.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionSite) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/decouvrir", "/methode"],
      disallow: [
        "/aujourdhui",
        "/semaine",
        "/courses",
        "/aliments",
        "/allergenes",
        "/stats",
        "/bebe",
        "/foyer",
        "/profil",
        "/login",
        "/rejoindre/",
        "/auth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
