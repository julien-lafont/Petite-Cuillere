import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /**
       * L'apostrophe et les guillemets sont écrits littéralement, jamais en
       * entité HTML : le compilateur JSX de Next (SWC) supprime les espaces de
       * bord d'un texte multiligne dès qu'il contient une entité, ce qui colle
       * les mots au rendu (« Mathismange »). `>` et `}` restent interdits :
       * eux signalent une vraie erreur de saisie.
       */
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
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
