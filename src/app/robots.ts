import type { MetadataRoute } from "next";
import { SITE_URL, isProductionSite } from "@/lib/site";

/**
 * Seules les pages publiques ont vocation à être indexées : la landing, l'entrée
 * sans compte, et les deux pages de méthode. Tout ce qui est derrière
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
