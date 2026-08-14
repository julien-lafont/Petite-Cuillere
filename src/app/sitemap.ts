import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

/**
 * The only public URLs: the landing, the no-account entry point, and the two
 * pages explaining the method. The rest of the product is private by nature.
 *
 * Of each method page's two addresses, only the prerendered `/decouvrir` version
 * is listed here — the `/methode…` routes are the same page inside the app
 * shell, `noindex` and canonical to these.
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
