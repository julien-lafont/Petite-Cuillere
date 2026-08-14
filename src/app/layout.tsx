import type { Metadata, Viewport } from "next";
import { Figtree, Bricolage_Grotesque } from "next/font/google";
import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  isProductionSite,
} from "@/lib/site";
import "./globals.css";

/**
 * Body text: a geometric sans with open shapes, very legible at arm's length in
 * a kitchen — and warmer than a neutral grotesque.
 */
const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

/**
 * Headings: a tightly-set display face with crisp terminals. Carries the brand's
 * character without slipping into a childish register (see docs/ux-redesign.md
 * §7). The `opsz` axis lets it breathe at the hero's large sizes.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  /**
   * Required for Open Graph and canonical URLs to be absolute: without it, a
   * link shared in a conversation between parents shows with no preview. The
   * domain comes from `NEXT_PUBLIC_SITE_URL` (see src/lib/site.ts).
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
  // Safety net: a preview deployment must never be indexed.
  robots: isProductionSite ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdf8" },
    { media: "(prefers-color-scheme: dark)", color: "#272220" },
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
      className={`${figtree.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
