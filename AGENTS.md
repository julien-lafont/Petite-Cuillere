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

# Toute route dynamique a son `loading.tsx`

**Ne jamais ajouter une route rendue dynamiquement sans écrire son
`loading.tsx` à côté du `page.tsx`.**

Raison : Next **saute purement et simplement le préchargement** d'une route
dynamique tant qu'elle n'a pas de `loading.tsx`. Le clic sur le lien reste alors
sans effet visible jusqu'à la réponse serveur complète — ici une seconde, le
temps du `getUser()` du proxy plus les requêtes de la page. Avec le fichier, la
coquille est préchargée, la navigation part à l'instant et le squelette tient la
place le temps que le contenu arrive en streaming.

Toutes nos pages lisent Supabase : elles sont donc **toutes** dynamiques. La
colonne de gauche de `next build` le confirme, `ƒ` marquant les routes rendues à
la demande — c'est la liste de celles qui doivent avoir un `loading.tsx`.

Le squelette reprend la charpente de la page (en-tête, puis blocs) à partir des
formes de `src/components/skeletons.tsx`, pour que l'arrivée du contenu réel ne
déplace rien sous les yeux du parent. Il n'a pas à imiter la page au pixel près.

Côté navigation, l'acquittement du clic est déjà en place : `NavPending`
(`src/components/nav-pending.tsx`), placé **dans** un `<Link>`, y pose
`data-pending` pendant la navigation — d'où les variantes `has-[[data-pending]]`
qui donnent au lien son apparence sélectionnée dès le clic. Tout nouveau lien de
navigation principale le reprend.
