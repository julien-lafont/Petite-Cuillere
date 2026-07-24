import type { MetadataRoute } from "next";
import { SITE_URL, isProductionSite } from "@/lib/site";

/**
 * Seule la landing a vocation à être indexée : tout ce qui est derrière
 * l'authentification concerne un foyer et n'a rien à faire dans un moteur de
 * recherche. Les déploiements d'aperçu sont fermés en bloc.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProductionSite) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/decouvrir"],
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
