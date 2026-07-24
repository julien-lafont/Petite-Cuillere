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
  "Petite Cuillère — Les premiers repas de bébé, en toute confiance";

const SAGE = "#507355";
const CREAM = "#fdfcf6";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: SAGE,
          color: CREAM,
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
              borderRadius: 28,
              background: CREAM,
            }}
          >
            {/* Proportions reprises de SpoonIcon : manche ≈ 0,8× le cuilleron. */}
            <div
              style={{
                width: 32,
                height: 38,
                borderRadius: "50%",
                background: SAGE,
              }}
            />
            <div
              style={{
                width: 9,
                height: 30,
                borderRadius: 5,
                background: SAGE,
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
          Les premiers repas de bébé, en toute confiance
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 30,
            fontSize: 34,
            color: "rgba(253, 252, 246, 0.85)",
            maxWidth: 880,
          }}
        >
          Chaque jour, quoi cuisiner, comment et en quelle quantité. Gratuit.
        </div>
      </div>
    ),
    size,
  );
}
