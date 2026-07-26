<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# JSX — jamais d'entités HTML dans le texte

**N'écrire ni `&apos;` ni `&nbsp;` ni aucune autre entité HTML dans du JSX.**
L'apostrophe s'écrit `'`, l'espace insécable s'écrit avec le caractère U+00A0
lui-même (`«`+`espace insécable`), comme partout ailleurs dans le code.

Raison : le compilateur JSX de Next (SWC) **décode les entités avant de couper
les espaces de bord**, au lieu de l'inverse. Résultat, dès qu'un texte contient
une entité *et* s'étale sur plusieurs lignes, l'espace qui le séparait de
l'expression voisine disparaît au rendu :

```tsx
// ✗ rendu par SWC : « Mathismange peu à peu »
<p>
  À 13 mois, {prenom} mange peu à peu comme le reste de la famille&nbsp;: vous
  n&apos;avez plus besoin de nous.
</p>

// ✓ rendu : « Mathis mange peu à peu »
<p>
  À 13 mois, {prenom} mange peu à peu comme le reste de la famille : vous
  n'avez plus besoin de nous.
</p>
```

`tsc` et esbuild traitent ce cas correctement : le bug ne se voit ni à la
relecture du code, ni au typecheck — seulement à l'écran.

Ajouter `{" "}` **ne règle rien** : Prettier le supprime dès que la ligne tient,
et le bug revient. C'est pour cette raison que `react/no-unescaped-entities` est
configurée en `{ forbid: [">", "}"] }` dans `eslint.config.mjs` — l'apostrophe
littérale est voulue, pas une négligence.

Pour vérifier après coup, comparer les chaînes émises par les deux
compilateurs : toute différence d'espace de bord entre `tsc` et le SWC de Next
(`next/dist/build/swc`) est une occurrence de ce bug.
