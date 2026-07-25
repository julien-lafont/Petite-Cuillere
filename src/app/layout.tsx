import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  isProductionSite,
} from "@/lib/site";
import "./globals.css";

/** Texte courant : neutre, très lisible à petite taille. */
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

/**
 * Titres : serif douce et chaleureuse. Porte le caractère de la marque sans
 * tomber dans le registre enfantin (cf. docs/ux-redesign.md §7).
 */
const fraunces = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

export const metadata: Metadata = {
  /**
   * Indispensable pour que les URL Open Graph et canoniques soient absolues :
   * sans ça, un lien partagé dans une conversation entre parents s'affiche sans
   * aperçu. Le domaine vient de `NEXT_PUBLIC_SITE_URL` (cf. src/lib/site.ts).
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    url: "/",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  // Filet de sécurité : un déploiement d'aperçu ne doit jamais être indexé.
  robots: isProductionSite ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f2" },
    { media: "(prefers-color-scheme: dark)", color: "#2a2521" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
