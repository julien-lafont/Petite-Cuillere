import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /**
       * Apostrophes and quotes are written literally, never as an HTML entity:
       * Next's JSX compiler (SWC) strips the edge whitespace of a multi-line text
       * as soon as it contains an entity, which glues the words together at
       * render time ("Mathismange"). `>` and `}` stay forbidden: those do signal
       * a genuine typo.
       */
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
    },
  },
  /*
   * Catches real Tailwind mistakes — a class that conflicts with another in
   * the same string, a duplicate, a typo'd utility — as errors. Ordering and
   * whitespace are deliberately left out: prettier-plugin-tailwindcss already
   * owns those on `format`, and running both would just fight over the same
   * ground.
   */
  {
    files: ["**/*.{ts,tsx}"],
    ...betterTailwindcss.configs["correctness-error"],
    rules: {
      ...betterTailwindcss.configs["correctness-error"].rules,
      /*
       * These aren't Tailwind utilities: they're the app's own hand-written
       * hooks (globals.css) for JS-driven state (.reveal, .voice-*) or a
       * plain CSS declaration never meant to be an @utility (.nav-hint,
       * .pb-safe). The rule has no way to tell the two apart, so they're
       * named here instead.
       */
      "better-tailwindcss/no-unknown-classes": [
        "error",
        {
          ignore: [
            "^reveal$",
            "^voice-halo$",
            "^voice-example$",
            "^voice-pulse$",
            "^voice-caret$",
            "^nav-hint$",
            "^pb-safe$",
          ],
        },
      ],
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/app/globals.css",
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
