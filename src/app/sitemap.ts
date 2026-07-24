import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Deux URL seulement : la landing et l'entrée sans compte. Le reste du produit
 * est privé par nature.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/decouvrir`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
