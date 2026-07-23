import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Rendu disponible côté client (pas seulement serveur) sans devoir le
    // préfixer NEXT_PUBLIC_, cf. src/lib/feature-flags.ts.
    FEATURE_PREMATURE_BABY_ENABLED: process.env.FEATURE_PREMATURE_BABY_ENABLED,
  },
};

export default nextConfig;
