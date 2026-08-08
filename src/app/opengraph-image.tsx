import { ImageResponse } from "next/og";

/**
 * Aperçu affiché quand un parent partage le lien (SMS, WhatsApp, groupe de
 * parents) — c'est le principal canal de diffusion attendu du produit. Sans lui,
 * le lien apparaît nu et n'inspire aucune confiance.
 *
 * Dessiné en primitives (pas de SVG ni de police distante) : Satori compose
 * l'image au build, tout ce qui suppose une ressource externe échouerait.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Petite Cuillère — Le repas de bébé, chaque jour, sans y penser";

/** Palette « le marché du matin » (cf. globals.css), en hexadécimal : Satori ne sait pas lire OKLCH. */
const PINE = "#2E5C33";
const MILK = "#FFFDF8";
const APRICOT = "#F4A259";
const APRICOT_INK = "#5C3A12";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 96px",
        background: PINE,
        color: MILK,
      }}
    >
      {/* Marque : la cuillère, reconstituée en deux formes pleines. */}
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            /* La tache de la marque : mêmes rayons que l'utilitaire `blob`. */
            borderRadius: "60% 40% 55% 45% / 50% 60% 40% 50%",
            background: APRICOT,
          }}
        >
          {/* Proportions reprises de SpoonIcon : manche ≈ 0,8× le cuilleron. */}
          <div
            style={{
              width: 32,
              height: 38,
              borderRadius: "50%",
              background: APRICOT_INK,
            }}
          />
          <div
            style={{
              width: 9,
              height: 30,
              borderRadius: 5,
              background: APRICOT_INK,
              marginTop: -2,
            }}
          />
        </div>
        <div style={{ fontSize: 44, letterSpacing: -1 }}>Petite Cuillère</div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 54,
          fontSize: 78,
          lineHeight: 1.12,
          letterSpacing: -2.5,
          maxWidth: 900,
        }}
      >
        Le repas de bébé, chaque jour, sans y penser
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 30,
          fontSize: 34,
          color: "rgba(255, 253, 248, 0.85)",
          maxWidth: 880,
        }}
      >
        Quoi cuisiner, en quelle quantité, à quelle texture. De 4 à 12 mois,
        gratuit.
      </div>
    </div>,
    size,
  );
}
