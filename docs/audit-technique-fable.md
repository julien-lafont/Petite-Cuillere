# Audit technique — Petite Cuillère

> Évaluation indépendante du socle technique et de la dette, avec un objectif :
> accélérer le développement (humains **et** IA), fiabiliser l'application et
> préserver son évolutivité — dans un cadre startup où la simplicité et les
> services managés sont des choix assumés.
>
> Date : 2026-07-26 · Commit analysé : `eec677b` (branche `main`) · Auteur : audit « Fable »

---

## 1. Résumé exécutif

**Verdict : le code est bon, le filet de sécurité autour du code est inexistant.**

Le projet a une semaine d'existence (premier commit le 2026-07-20, 18 commits) et
affiche une qualité de code rare à ce stade : logique métier pure isolée de
l'I/O, commentaires qui expliquent le *pourquoi*, RLS PostgreSQL complète et
réfléchie, documentation produit/technique réellement vivante. **Rien n'est à
réécrire.**

En revanche, tout ce qui permet d'itérer vite *sans casser* manque à l'appel :

- **aucun test** (aucun runner installé), **aucune CI**, pas même un script
  `typecheck` — et de fait **le lint est rouge sur `main`** (4 erreurs React
  Hooks dans `meal-plan-dialog.tsx`) sans que personne ne l'ait vu ;
- **les écritures en base ignorent leurs erreurs** et enchaînent des étapes non
  transactionnelles (delete puis insert) : une panne au mauvais moment efface
  des données **silencieusement** ;
- **les lectures ne sont pas bornées** : Supabase plafonne à 1 000 lignes par
  requête, les statistiques deviendront fausses (sans erreur) vers ~250 jours
  d'historique ;
- **le serveur vit en UTC** : entre minuit et 2 h à Paris, « Aujourd'hui »
  affiche la veille ;
- **le contrat de base de données n'est pas typé** : chaînes `select` écrites à
  la main, types de lignes recopiés manuellement, casts `as unknown as` — un
  renommage de colonne passe le typecheck et casse en production.

Ces défauts sont invisibles aujourd'hui (un foyer, usage en journée, historique
court). Chacun se déclenche mécaniquement avec l'usage réel. Les corriger
coûte quelques jours maintenant ; les découvrir en production coûtera des
données perdues et la confiance des premiers utilisateurs.

**Notes par axe** (1 = critique, 5 = excellent) :

| Axe                                  | Note | Commentaire                                                    |
| ------------------------------------ | :--: | -------------------------------------------------------------- |
| Lisibilité / structure du code       |  4   | Découpage pur/I-O exemplaire, nommage soigné                   |
| Documentation                        |  4   | Docs vivantes et utiles ; README racine mort, quelques scories |
| Modèle de données & sécurité (RLS)   |  4   | RLS complète, `security definer` maîtrisé, token bien masqué   |
| Fiabilité des écritures              |  1   | Erreurs ignorées, pas de transactions, pas d'unicité `meals`   |
| Justesse des lectures                |  2   | Plafond 1 000 lignes ignoré, fuseau horaire UTC                |
| Filet de sécurité (tests, CI)        |  1   | Néant                                                          |
| Observabilité                        |  1   | `console.error` serveur, jamais lu ; aucun error boundary      |
| Performance / scalabilité            |  3   | OK à cette échelle ; zéro index SQL, cache invalidé en bloc    |
| Conformité (RGPD, santé d'un mineur) |  1   | Aucune page légale, pas de suppression de compte               |

---

## 2. Périmètre et méthode

Lecture intégrale de la couche données (`src/lib/data/`), de l'infrastructure
Supabase (`src/lib/supabase/`, `src/proxy.ts`, 15 migrations + `reset.sql`), de
la logique métier pure (`src/lib/`), des pages serveur et des principaux
composants ; exécution de `eslint` et `tsc --noEmit` ; revue des documents de
`docs/`. Le fichier `docs/audit-technique.md` existant n'a volontairement **pas**
été lu (audit indépendant, demandé ainsi).

**Volumétrie** : ~130 fichiers TS/TSX, **14 545 lignes** de TypeScript,
**1 624 lignes** de SQL, 48 composants client, 18 commits, 1 contributeur.

**Stack** : Next.js 16.2.10 (App Router, convention `proxy`), React 19,
TypeScript 5, Tailwind 4, shadcn/Base UI, Recharts, Supabase (PostgreSQL + Auth
+ RLS) via `@supabase/ssr`, déploiement Vercel. Choix sains, standards, bien
adaptés à une startup — aucun changement de stack recommandé.

---

## 3. État des lieux

### 3.1 Architecture réelle

```
Navigateur ── proxy.ts (session + garde d'accès)
   │
   ├─ Pages serveur (src/app/**) ── lib/data/*.ts (lectures, client Supabase serveur)
   │       └─ composants client ──── lib/data/*.actions.ts (écritures, "use server")
   │
   └─ Logique pure sans I/O : lib/program/, lib/stats.ts, lib/age.ts, lib/dates.ts…
                │
        Supabase managé : PostgreSQL + RLS + Auth (OTP 6 chiffres, Google OAuth)
```

Le pattern est cohérent et appliqué partout : les pages serveur lisent via
`lib/data/*.ts`, les mutations passent par des Server Actions dans
`*.actions.ts`, et la logique métier (génération du programme, stades, stats,
éligibilité) est **pure et testable** — elle n'attend que des tests.

### 3.2 Points forts à préserver

Ils sont réels et il faut les protéger, car ce sont eux qui rendent le projet
rapide à faire évoluer (par un humain comme par une IA) :

1. **Séparation logique pure / I-O** — `buildPlan()` (`src/lib/program/plan.ts`)
   prend des données et rend un plan, sans toucher à la base. Idem
   `lib/program/stage.ts`, `lib/stats.ts`, `lib/age.ts`, `lib/food-eligibility.ts`.
2. **RLS complète et cohérente** — chaque table est protégée par
   `current_household_id()` ; les fonctions `security definer` fixent
   `search_path` ; le token d'invitation est masqué par des privilèges de
   colonnes (`reset.sql:343-347`) — c'est du travail soigné.
3. **Docs-first qui fonctionne** — `docs/` contient une spec fonctionnelle, un
   référentiel métier, un cadrage UX, un guide de déploiement précis (pièges
   Supabase documentés). `AGENTS.md` capture même un bug de compilateur SWC avec
   sa règle ESLint associée : exactement le genre de savoir qui rend une IA
   productive.
4. **Détails de sécurité corrects** — garde anti-open-redirect dans
   `src/app/auth/callback/route.ts:15-17`, `robots`/`sitemap` fermés sur les
   previews Vercel, catalogue public en lecture seule via RLS pour `/decouvrir`.
5. **Feature flags simples et typés** (`src/lib/features.ts`) — la bonne échelle
   d'outil pour ce stade.

### 3.3 Dette et risques identifiés

Chaque constat est référencé ; la sévérité mesure l'impact × la probabilité à
l'ouverture publique.

#### D1 — Aucun filet de sécurité `[critique]`

- Aucun fichier de test, aucun runner installé (rien dans `package.json`).
- Aucune CI (pas de répertoire `.github/`).
- Pas de script `typecheck` ; `npm run lint` existe mais n'est jamais exécuté
  automatiquement — preuve : **4 erreurs ESLint sur `main`**
  (`src/components/meal-plan-dialog.tsx:76-84`, règles `react-hooks/set-state-in-effect`
  et `react-hooks/refs`).
- Conséquence directe pour le développement assisté par IA : sans tests ni CI,
  chaque modification repose sur la relecture humaine seule. C'est le premier
  frein à la vélocité, avant tout le reste.

#### D2 — Écritures : erreurs ignorées, pas de transactions `[critique]`

La couche actions exécute ~52 requêtes d'écriture ; la grande majorité ignore
le retour d'erreur. Exemples représentatifs :

- `saveMeal()` (`src/lib/data/meals.actions.ts:107-133`) : supprime
  `meal_items`, `meal_allergens`, `intake_observations` **puis** ré-insère —
  quatre requêtes indépendantes, aucune vérifiée. Si un insert échoue après les
  delete, le repas est vidé sans message. L'utilisateur croit avoir enregistré.
- `generateProgram()` (`src/lib/data/program.actions.ts:81-133`) : efface toute
  la période (`meals` + `food_introductions`) puis ré-insère le plan en trois
  vagues non vérifiées. Un échec à mi-chemin détruit le programme existant.
- `setupBaby()` (`src/lib/data/baby.actions.ts:104-141`) : les upserts de
  rattrapage et la génération du programme ne sont pas vérifiés ; seul l'insert
  du bébé l'est.
- `updateBaby()`, `setAgeReferenceDate()` : void, erreurs perdues.

S'y ajoute un défaut de schéma : **`meals` n'a pas de contrainte d'unicité sur
`(baby_id, date, meal_moment_id)`**, alors que `setMealResult()` et `saveMeal()`
font du *check-then-insert* (`meals.actions.ts:28-46`). Deux appareils qui
notent le même repas en même temps créent un doublon que l'interface ne sait
pas afficher.

#### D3 — Lectures non bornées : le plafond des 1 000 lignes `[critique]`

Supabase (PostgREST) tronque silencieusement toute réponse à 1 000 lignes par
défaut. Trois lectures chargent « tout l'historique » sans borne ni pagination :

- `getFoodStats()` (`src/lib/data/food-stats.ts:24-28`) — tous les repas depuis
  le début. À 4 repas/jour, le plafond est atteint vers **250 jours** : les
  stats d'exposition, les scores d'appréciation et la liste des aliments
  « déjà introduits » deviennent faux, sans aucune erreur.
- `getIntroductionCounts()` (`src/lib/data/meals.actions.ts:147-151`) — idem.
- `generateProgram()` charge tous les `meal_items` antérieurs au démarrage —
  même plafond, donc des aliments « déjà goûtés » oubliés lors d'une
  regénération tardive.

C'est le bug le plus sournois du lot : il produit des **données médicalement
sensibles fausses** (suivi allergènes) en silence.

#### D4 — Fuseau horaire : le serveur vit en UTC `[élevé]`

`src/lib/dates.ts` travaille en « heure locale » — mais sur Vercel, l'heure
locale du serveur est UTC. `src/app/(app)/aujourdhui/page.tsx:32-33` fait
`toISODate(new Date())` côté serveur : entre 00 h 00 et 02 h 00 (heure d'été) à
Paris, `todayISO` vaut **la veille**. La page « Aujourd'hui » affiche le mauvais
jour, la notation rapide écrit sur la mauvaise date, le briefing de semaine se
cale sur le mauvais dimanche. Le commentaire de `dates.ts` (« sans fuseau
surprise ») décrit une garantie que le serveur ne tient pas.

#### D5 — Contrat de base de données non typé `[élevé]`

- Types de lignes écrits à la main (`BabyRow` dans `src/lib/data/baby.ts:4-14`,
  `MealWithDetails`…), chaînes `select` assemblées manuellement
  (`meals.ts:6-10`), casts `as unknown as` (`meals.ts:95`,
  `week-briefing.ts:35`).
- Le schéma réel (15 migrations) et les types TS ne sont reliés par rien : un
  renommage de colonne, une colonne ajoutée non reportée, et l'erreur n'apparaît
  qu'à l'exécution — souvent absorbée par le `console.error` + valeur par défaut
  (D7), donc jamais vue.
- C'est aussi un frein direct pour l'IA : sans types générés, chaque évolution
  du schéma demande de retrouver à la main tous les endroits à mettre à jour.

#### D6 — Migrations : application manuelle, double source de vérité `[élevé]`

- Les migrations s'appliquent en collant le SQL dans l'éditeur web
  (`0001_initial_schema.sql:5`). Aucune trace de ce qui a été appliqué où ;
  pas de CLI Supabase, pas d'environnement local (`supabase start`).
- `supabase/reset.sql` est une **seconde source de vérité** consolidée à la
  main. Son en-tête annonce « 0001 → 0013 » alors qu'il intègre déjà le contenu
  de 0014/0015 (contrainte `prenom`, `relation 'Parent'`) : la dérive
  documentaire a déjà commencé, la dérive de schéma suivra.
- Développer contre la base de production (un seul projet Supabase) rend toute
  expérimentation de schéma risquée.

#### D7 — Observabilité nulle `[élevé]`

- 13 `console.error` côté serveur : sur Vercel, personne ne les lit. Chaque
  lecture en échec retourne une valeur par défaut plausible (`[]`, `new Map()`,
  `true`) — l'app affiche alors un état faux avec assurance
  (ex. `hasAnyMeal` retourne `true` en cas d'erreur, `meals.ts:22`).
- **Aucun `error.tsx`, `loading.tsx` ou `global-error.tsx`** dans `src/app` :
  une exception serveur affiche l'écran d'erreur brut de Next, une navigation
  lente n'a aucun état de chargement.
- Aucun outil de suivi d'erreurs (Sentry ou équivalent). Une panne en
  production ne sera connue que si un utilisateur se plaint.

#### D8 — Zéro index SQL, RLS non optimisée `[moyen]`

- Aucun `create index` dans tout le projet. Toutes les requêtes chaudes
  filtrent sur des colonnes non indexées : `meals(baby_id, date)`,
  `meal_items(meal_id)`, `meal_items(food_id)`, `meal_allergens(meal_id)`,
  `intake_observations(meal_id)`, `profiles(household_id)`,
  `babies(household_id)`, `shopping_checks(household_id, week_start)`.
- Les politiques RLS appellent `current_household_id()` directement : Postgres
  la réévalue **par ligne**. L'idiome Supabase est
  `(select public.current_household_id())` pour la transformer en InitPlan.
- Sans conséquence à 1 foyer ; à quelques centaines, les listes de repas
  passeront en seq scan avec sous-requête par ligne.

#### D9 — Entrées des Server Actions non validées `[moyen]`

Les actions font confiance à leurs arguments (`saveMeal` accepte n'importe quel
`MealDraft`, `generateProgram` n'importe quelles dates…). La RLS protège le
*qui* (bonne base), mais pas le *quoi* : dates malformées, tableaux
surdimensionnés, chaînes arbitraires partent en base. Quelques gardes manuels
existent (`setupBaby`, `normalizePrenom`) mais sans schéma systématique ni
format de retour d'erreur homogène (`{ error?: string }` ici, `void` là).

#### D10 — Cache au bulldozer, requêtes dupliquées `[moyen]`

- Toutes les mutations appellent `revalidatePath("/", "layout")` : chaque clic
  de notation invalide **tout** le cache de l'app pour le foyer. Simple et
  correct, mais coûteux, et surtout indifférencié — impossible d'introduire du
  cache fin plus tard sans tout reprendre.
- `getBabies()` s'exécute deux fois par navigation (layout
  `src/app/(app)/layout.tsx:32` + `getActiveBaby()` dans chaque page) faute de
  `React.cache()`. Le layout enchaîne en plus trois awaits séquentiels
  (user → profile → babies) parallélisables.

#### D11 — Composants monolithes `[moyen]`

`src/components/onboarding.tsx` : **1 130 lignes**, un seul composant client
(machine à étapes, persistance locale, rendu de 8 écrans). `src/app/page.tsx`
(landing) : 529 lignes. `helpers-manager.tsx` : 414. C'est là que les 4 erreurs
lint se sont nichées : les gros composants client sont le terrain naturel des
bugs de hooks, et le format le plus coûteux à faire modifier par une IA
(contexte long, risque de régression latérale).

#### D12 — Conformité : données de santé d'un mineur `[bloquant juridique]`

L'app stocke des réactions allergiques d'enfants, nominatives. Or : aucune page
mentions légales / CGU / politique de confidentialité, pas de suppression de
compte par l'utilisateur (le `remove_helper` ne couvre pas l'auto-suppression du
responsable), pas d'export de données, région d'hébergement Supabase non
documentée. `docs/deploiement.md:163-168` liste déjà ce reste-à-faire : il est
bloquant avant toute ouverture au-delà du cercle privé.

#### D13 — Hygiène diverse `[faible]`

- `README.md` racine : template create-next-app intact, terminé par « HEY ».
  Première chose que voit un contributeur (ou une IA sans contexte).
- `tsconfig.tsbuildinfo` traîne à la racine (non versionné, mais à déplacer via
  `tsBuildInfoFile` ou ignorer explicitement).
- `docs/README.md` référence l'audit précédent (« C1 → C20 ») — à réconcilier
  avec le présent rapport.

---

## 4. Propositions

Format : chaque chantier est autoportant — objectif, gestes concrets, fichiers,
critères d'acceptation — pour être repris tel quel dans une session de travail.
Effort : **S** < ½ j · **M** ≈ 1–2 j · **L** ≈ 3–5 j.

### Vague P0 — Fiabilité (avant toute ouverture publique)

#### F1 — Réparer le lint, ajouter typecheck et CI `[S]`

**Objectif** : plus jamais de `main` rouge sans le savoir.

1. Corriger les 4 erreurs de `src/components/meal-plan-dialog.tsx:76-84` :
   remplacer l'effet qui fait `setFoodIds`/`setAllergenIds` par une
   ré-initialisation par `key` (remonter `key={mealId ?? date+momentId}` sur le
   dialogue) ou par un état dérivé pendant le rendu ; remplacer la comparaison
   `initialRef.current` pendant le rendu par un état `initialSnapshot`.
2. `package.json` : ajouter `"typecheck": "tsc --noEmit"`.
3. Créer `.github/workflows/ci.yml` : `npm ci`, `npm run lint`,
   `npm run typecheck`, `npm run format:check`, `npm run build` (avec des
   valeurs factices pour les deux variables `NEXT_PUBLIC_SUPABASE_*`).

**Acceptation** : CI verte sur `main` ; un push avec erreur lint/type échoue.

#### F2 — Rendre les écritures honnêtes et atomiques `[M]`

**Objectif** : plus aucune perte de données silencieuse.

1. Déplacer les deux écritures multi-étapes en **fonctions Postgres
   transactionnelles** appelées par RPC :
   - `save_meal(baby_id, date, moment_id, draft jsonb)` — remplace le
     delete/insert de `saveMeal()` (`meals.actions.ts:107-133`) ;
   - `generate_program(baby_id, plan jsonb)` — remplace la séquence de
     `generateProgram()` (`program.actions.ts:81-133`) ; `buildPlan()` reste en
     TypeScript, seule l'écriture du résultat devient atomique.
   Les deux en `security invoker` pour rester sous RLS.
2. Ajouter la contrainte manquante :
   `create unique index on meals (baby_id, date, meal_moment_id)` + adapter
   `setMealResult` en `upsert … on conflict`.
3. Uniformiser le retour des actions : type `ActionResult = { ok: true } |
   { ok: false; error: string }` ; **toute** erreur Supabase est vérifiée,
   loggée (F3) et remontée ; les composants affichent un toast d'échec (le
   design system a déjà tout ce qu'il faut).

**Acceptation** : couper le réseau pendant un enregistrement affiche une erreur
à l'utilisateur et ne laisse pas de repas à moitié écrit ; noter le même repas
depuis deux onglets ne crée pas de doublon.

#### F3 — Observabilité minimale `[S]`

1. Installer `@sentry/nextjs` (plan gratuit) : erreurs serveur, actions et
   client remontées avec le commit en tag.
2. Remplacer les 13 `console.error` par un helper `reportError(scope, error)`
   (Sentry + console en dev). Supprimer les valeurs par défaut *mensongères* :
   `hasAnyMeal` (`meals.ts:22`) doit propager l'échec plutôt que répondre
   `true`.
3. Ajouter `src/app/error.tsx`, `src/app/global-error.tsx` (message français,
   bouton réessayer, rapport Sentry) et un `loading.tsx` pour le groupe
   `(app)`.

**Acceptation** : une exception volontaire en préproduction apparaît dans
Sentry en < 1 min ; l'utilisateur voit un écran d'erreur de la marque.

#### F4 — Ancrer le « jour » sur Europe/Paris `[S]`

**Objectif** : « Aujourd'hui » = aujourd'hui pour l'utilisateur, quel que soit
le serveur.

1. Dans `src/lib/dates.ts`, ajouter
   `todayISO(): string` basé sur
   `new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date())`
   (fuseau unique assumé et documenté : produit franco-français — décision à
   revalider si internationalisation).
2. Remplacer tous les `toISODate(new Date())` côté serveur
   (`aujourdhui/page.tsx:32-35`, pages semaine/stats/courses, actions) par
   `todayISO()` / des dérivés `addDaysISO()`.
3. Verrouiller par une règle lint (`no-restricted-syntax` sur `new Date()` sans
   argument dans `src/app/**` et `src/lib/data/**`) pour que le pattern ne
   revienne pas.

**Acceptation** : un test unitaire avec `TZ=UTC` vérifie que `todayISO()` rend
le jour de Paris ; grep `new Date()` nu = zéro occurrence serveur.

#### F5 — Borner et agréger les lectures `[M]`

**Objectif** : des statistiques justes à 3 ans d'historique comme à 3 jours.

1. `getFoodStats()` → **agrégat SQL** (RPC `food_stats(baby_id, until date)`
   retournant `food_id, exposures, score, has_effect` par `group by`) : la
   base agrège, plus de plafond, moins de transfert. Idem
   `getIntroductionCounts()`.
2. Dans `generateProgram()`, remplacer la lecture des `meal_items` antérieurs
   par un `select distinct` RPC ou une requête paginée.
3. Règle d'équipe (à inscrire dans `AGENTS.md`) : *toute* requête liste porte
   soit une borne de dates ≤ 60 jours, soit un `.limit()` explicite, soit passe
   par un agrégat SQL.

**Acceptation** : un script de seed génère 500 jours de repas ; les stats et le
suivi allergènes restent exacts (comparés à un calcul de référence).

#### F6 — Tests de la logique pure + smoke test `[M]`

**Objectif** : qu'une IA (ou un humain pressé) puisse modifier le générateur ou
les stats sans peur.

1. Installer Vitest (`npm i -D vitest`, script `"test": "vitest run"`, job CI).
2. Couvrir en priorité, dans l'ordre de valeur :
   - `buildPlan()` — cas nominaux (4 mois, 6 mois, 12 mois), règles
     invariantes (1 nouveauté/cycle, répétition J+1, espacement allergènes
     ≥ 3 j, jamais d'aliment sous son âge minimum) + un **golden test** (plan
     complet sérialisé, pour détecter tout changement involontaire) ;
   - `lib/dates.ts` (dont F4) et `lib/age.ts` (bords de mois, année
     bissextile) ;
   - `lib/stats.ts`, `lib/food-eligibility.ts`, `lib/prenom.ts`,
     `lib/program/stage.ts` (un briefing par palier d'âge).
3. Pas d'E2E à ce stade (voir P2) — le ratio valeur/coût est dans le pur.

**Acceptation** : `npm test` en CI ; casser volontairement une règle du
générateur fait échouer un test nommé d'après la règle.

#### F7 — Conformité minimale RGPD / légal `[M]` *(non-code en partie)*

1. Pages `/mentions-legales` et `/confidentialite` (+ lien pied de landing et
   page profil) : identité de l'éditeur, hébergeurs (Vercel, Supabase +
   **région**, à vérifier/documenter — si le projet n'est pas dans une région
   UE, migrer), finalités, durées de conservation, mention « ne remplace pas un
   avis médical » (retirée de l'UI le 24/07, elle doit vivre ici).
2. Suppression de compte en libre-service : action `deleteAccount()` (RPC
   `security definer` qui supprime `auth.users` du demandeur ; la cascade
   existante fait le reste) + bouton confirmé sur la page profil. Traiter le
   cas « responsable d'un foyer avec d'autres aidants » (transfert ou blocage
   explicite).
3. Export des données : différable, mais à inscrire au backlog daté.

**Acceptation** : un compte de test peut se supprimer seul ; les pages légales
sont accessibles sans authentification.

### Vague P1 — Socle d'évolutivité (les 2–3 semaines suivantes)

#### F8 — Types Supabase générés `[M]`

1. `npx supabase login` + `supabase gen types typescript --project-id …
   > src/lib/supabase/database.types.ts` ; script npm `db:types` ; contrôle CI
   optionnel (diff = échec).
2. Typer les clients : `createServerClient<Database>` dans
   `src/lib/supabase/server.ts`, `middleware.ts`, `client.ts`.
3. Supprimer progressivement les types manuels (`BabyRow`, `MealWithDetails`…)
   au profit de `Tables<"babies">` & co, et éliminer les deux
   `as unknown as` (`meals.ts:95`, `week-briefing.ts:35`).

**Acceptation** : renommer une colonne dans les types fait échouer `tsc` aux
endroits exacts qui la lisent.

#### F9 — Migrations pilotées par le CLI + base locale `[M]`

1. `supabase init` puis `supabase link` ; les fichiers de
   `supabase/migrations/` sont déjà au bon format — les faire adopter par
   `supabase migration repair`/`db push` pour que la table d'historique reflète
   la réalité.
2. Workflow cible documenté dans `docs/deploiement.md` : nouvelle migration →
   `supabase migration new` → test sur `supabase start` (base locale) →
   `supabase db push` en prod. Plus jamais d'éditeur SQL web pour du schéma.
3. **Retirer `reset.sql` de son rôle de source de vérité** : le régénérer
   (`supabase db dump`) ou le supprimer au profit de `db reset` + un
   `seed.sql` (le seed catalogue de `0002` y déménage naturellement).

**Acceptation** : un poste vierge obtient une base locale complète en deux
commandes ; `git log supabase/migrations` = historique exact de la prod.

#### F10 — Index et RLS optimisée `[S]`

Une migration unique :

```sql
create index on public.meals (baby_id, date);
create index on public.meal_items (meal_id);
create index on public.meal_items (food_id);
create index on public.meal_allergens (meal_id);
create index on public.intake_observations (meal_id);
create index on public.profiles (household_id);
create index on public.babies (household_id);
create index on public.shopping_checks (household_id, week_start);
```

et réécrire les politiques pour envelopper l'appel :
`(select public.current_household_id())` (idiome InitPlan Supabase).

**Acceptation** : `explain analyze` sur la lecture des repas d'une semaine ne
montre plus de seq scan ni de réévaluation par ligne.

#### F11 — Validation systématique des actions `[M]`

1. Installer `zod`. Un schéma par action (`MealDraftSchema`, `BabySetupSchema`
   avec bornes : dates ISO valides, tableaux ≤ 50, chaînes ≤ 500…).
2. Petit wrapper `defineAction(schema, handler)` qui parse, exécute, capture
   vers Sentry et rend l'`ActionResult` de F2 — un seul idiome pour les 7
   fichiers d'actions, facile à imiter (par les humains et par l'IA).

**Acceptation** : appeler `saveMeal` avec une date `"lundi"` rend une erreur
propre sans requête SQL exécutée.

#### F12 — Cache ciblé, requêtes dédupliquées `[M]`

1. Envelopper `getBabies()`, `getFoods()`, `getAllergens()`, `getMealMoments()`
   dans `React.cache()` → déduplication par requête, zéro changement d'API.
2. Paralléliser le layout (`(app)/layout.tsx:19-32`) : `Promise.all` sur
   user/profile/babies.
3. Remplacer progressivement `revalidatePath("/", "layout")` par des
   invalidations par chemin (`/aujourdhui`, `/semaine`, `/stats`…) — commencer
   par les actions les plus fréquentes (`setMealResult`, `saveMeal`).

**Acceptation** : une navigation ne déclenche plus qu'une requête `babies` ;
noter un repas n'invalide plus la landing ni la page courses.

#### F13 — Dégrossir les monolithes client `[M]`

1. `onboarding.tsx` (1 130 l.) → un répertoire `onboarding/` : la machine à
   étapes (hook `useOnboardingFlow`) séparée des écrans (un fichier par étape,
   composants purs). Aucun changement fonctionnel — c'est un déplacement.
2. Même traitement, plus léger, pour `page.tsx` (landing, 529 l. → sections) et
   `helpers-manager.tsx` (414 l.).
3. Règle de suivi dans `AGENTS.md` : composant client > 300 lignes = à
   découper à la prochaine modification.

**Acceptation** : aucun fichier client > 400 lignes ; comportement identique
(le golden test F6 et un clic-through manuel suffisent).

#### F14 — Hygiène documentaire `[S]`

1. Réécrire `README.md` racine : pitch d'une ligne, prérequis, `npm install`,
   variables d'env (`.env.local.example`), `npm run dev`, lien vers `docs/`.
2. Mettre à jour `docs/README.md` (référence audit) et l'en-tête de
   `reset.sql` (ou sa suppression, cf. F9).

### Vague P2 — Confort et durabilité (opportuniste)

- **F15 — E2E smoke Playwright** `[L]` : un seul parcours (login OTP contre la
  base locale F9 → onboarding → noter un repas → vérifier les stats), exécuté
  en CI nightly. À ne faire qu'après F9 (base locale) — avant, le coût
  d'entretien dépasse la valeur.
- **F16 — Préparer le multi-fuseau** : si le produit sort de France, remplacer
  le fuseau fixe de F4 par un fuseau par foyer (colonne `households.timezone`).
  Décision produit, pas urgente.
- **F17 — PWA / offline** : déjà prévu « fin de parcours » dans
  `technical-direction.md` ; y rester. Le socle F2/F5 (écritures fiables,
  lectures bornées) est un prérequis de toute façon.
- **F18 — Realtime Supabase** : la promesse « synchronisé en temps réel » de la
  doc n'est pas implémentée (c'est du re-render serveur à la navigation).
  N'activer les subscriptions que si un vrai besoin utilisateur apparaît
  (deux parents sur l'app au même moment) ; sinon, la doc doit être corrigée
  pour dire ce que fait l'app.

---

## 5. Ce que je recommande de NE PAS faire

Autant de vélocité se gagne en s'abstenant qu'en construisant :

- **Pas d'ORM** (Prisma, Drizzle) : le client Supabase + types générés (F8)
  suffit, et la RLS est le vrai modèle de sécurité — un ORM la contournerait ou
  la dupliquerait.
- **Pas de backend séparé, pas de monorepo, pas de microservices** : les Server
  Actions + Postgres couvrent le besoin à des années de croissance près.
- **Pas de state manager client** (Redux, Zustand…) : le modèle « état sur le
  serveur, revalidation » actuel est le bon ; le généraliser.
- **Pas de couverture de tests exhaustive des composants UI** : les tests
  doivent porter sur la logique pure (F6) et, plus tard, un smoke E2E (F15).
  Tester chaque dialogue au render serait de la dette de test.
- **Pas de refonte du générateur** : `buildPlan()` est lisible et correct ;
  il lui faut des tests, pas une réécriture.
- **Pas d'i18n** tant que le produit est franco-français — le français en dur
  dans le code est un choix rationnel ici.

---

## 6. Séquencement proposé

| Semaine | Chantiers                          | Résultat observable                                     |
| ------- | ---------------------------------- | ------------------------------------------------------- |
| 1       | F1, F3, F4                         | CI verte, Sentry actif, jour juste — base saine         |
| 2       | F2, F5                             | Écritures atomiques + stats exactes à long historique   |
| 3       | F6, F7                             | Générateur sous tests ; légal prêt pour ouverture       |
| 4       | F8, F9, F10                        | Types générés, base locale, migrations outillées, index |
| 5       | F11, F12                           | Actions validées, cache ciblé                           |
| 6 (fil) | F13, F14, puis P2 à l'opportunité  | Monolithes découpés, docs à jour                        |

L'ordre interne de P0 est important : F1 (CI) d'abord, pour que tout le reste
soit livré sous protection ; F2/F5 avant F6, pour que les tests s'écrivent
contre les nouvelles interfaces (RPC, `ActionResult`) et non contre du code
appelé à changer.

---

## 7. Indicateurs de suivi

À vérifier à chaque itération (5 minutes) :

1. CI verte sur `main` (lint + typecheck + tests + build) — **jamais** de rouge
   toléré plus d'une journée.
2. Zéro erreur Sentry non triée depuis plus de 48 h.
3. Zéro requête liste sans borne/`limit`/agrégat (grep en revue de code).
4. Zéro `as unknown as` vers des types base de données.
5. Aucun composant client > 400 lignes.
6. `supabase/migrations/` = seul chemin de modification du schéma.

---

## 8. Questions ouvertes (décisions à prendre par le produit)

1. **Région Supabase** : le projet est-il hébergé en UE ? À vérifier avant F7 —
   une migration de projet est simple maintenant, pénible après l'ouverture.
2. **Fuseau horaire** : Europe/Paris fixe (F4) est-il un choix produit assumé,
   y compris pour les DOM-TOM et expatriés ?
3. **Realtime** : la promesse « synchronisation temps réel » de
   `technical-direction.md` est-elle un engagement produit (→ F18) ou un
   raccourci de langage (→ corriger la doc) ?
4. **Comptes multi-foyers** : `deploiement.md:118-123` note qu'un rattachement
   Google peut faire changer un parent de foyer « sans retour ». Accepté, ou
   faut-il un garde-fou avant l'ouverture ?
