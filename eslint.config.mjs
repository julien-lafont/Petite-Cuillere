import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
