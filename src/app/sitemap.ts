import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Les seules URL publiques : la landing, l'entrée sans compte, et les deux
 * pages qui expliquent la méthode. Le reste du produit est privé par nature.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: "monthly", priority: 1 },
    {
      url: `${SITE_URL}/decouvrir`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/methode`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/methode/allergenes`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
