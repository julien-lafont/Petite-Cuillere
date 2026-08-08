import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

/**
 * Les seules URL publiques : la landing, l'entrée sans compte, et les deux
 * pages qui expliquent la méthode. Le reste du produit est privé par nature.
 *
 * Des deux adresses de chaque page de méthode, on ne cite ici que la version
 * prérendue sous `/decouvrir` — les routes `/methode…` sont la même page dans
 * la coquille de l'app, en `noindex` et canoniques vers celles-ci.
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
      url: `${SITE_URL}${METHODE_URL}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}${ALLERGENES_URL}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
