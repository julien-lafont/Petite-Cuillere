# Audit technique — Petite Cuillère

> Évaluation du socle technique, de la dette et des leviers d'accélération.
> Point de vue : Senior Staff Engineer, contexte startup — l'objectif n'est pas
> la perfection d'architecture, c'est de **ne jamais être ralenti** par le socle.
>
> Date : 2026-07-26 · Commit analysé : `eec677b` · Branche : `main`

---

## 1. Résumé exécutif

**Verdict : la base de code est saine, la discipline d'ingénierie ne l'est pas encore.**

Le code applicatif est d'une qualité nettement au-dessus de la moyenne pour un
projet de cet âge (18 commits, ~16 400 lignes) : découpage clair entre logique
pure et I/O, commentaires qui expliquent le _pourquoi_, documentation produit et
technique vivante et réellement utile. Rien à réécrire.

Ce qui manque est **tout le tissu autour du code** : il n'existe aucun test,
aucune CI, aucune observabilité, aucun typage du contrat de base de données, et
les migrations SQL s'appliquent à la main dans un éditeur web. Conséquence
directe et déjà mesurable : **le lint est rouge sur `main`** (4 erreurs React
Hooks), et personne ne l'a su.

C'est le profil classique du projet « porté par une IA rapide et un humain
attentif » : la vélocité est excellente tant que le contexte tient dans une tête
(ou une fenêtre de contexte). Elle s'effondre au premier bug de production
silencieux, au premier retour en arrière sur une migration, ou à l'arrivée d'un
second contributeur.

**Trois défauts sont bloquants avant une ouverture publique** (détaillés en §4) :

| #      | Défaut                                                           | Impact                                                      |
| ------ | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| **C1** | Fuseau horaire serveur (UTC) vs fuseau utilisateur               | « Aujourd'hui » affiche **hier** entre 00 h et 02 h à Paris |
| **C2** | Écritures dont l'erreur est ignorée + aucune observabilité       | Une panne Supabase = perte de données **silencieuse**       |
| **C3** | Lectures non bornées (limite implicite PostgREST à 1 000 lignes) | Stats et suivi allergènes **faux** au-delà de ~250 jours    |

Aucun de ces trois n'est visible aujourd'hui parce que l'app tourne sur un seul
foyer, en journée, avec 3 mois d'historique. Tous les trois se déclenchent avec
l'usage réel.

**Note globale par axe** (1 = critique, 5 = excellent) :

| Axe                                | Note | Commentaire                                                   |
| ---------------------------------- | :--: | ------------------------------------------------------------- |
| Lisibilité / structure du code     |  4   | Excellent découpage, nommage et commentaires                  |
| Documentation                      |  4   | Rare à ce niveau ; quelques doublons et un README racine mort |
| Modèle de données & sécurité (RLS) |  4   | RLS complète et cohérente, `security definer` bien utilisé    |
| Filet de sécurité (tests, CI)      |  1   | **Néant**                                                     |
| Fiabilité runtime / observabilité  |  1   | Erreurs avalées, aucune remontée, aucun error boundary        |
| Scalabilité des accès données      |  2   | Tout l'historique chargé et agrégé en JS, sans borne          |
| Outillage & workflow (migrations)  |  2   | Migrations manuelles, double source de vérité SQL             |
| Typage du contrat DB               |  2   | Types écrits à la main, 14 casts pour compenser               |

---

## 2. Périmètre et méthode

Analyse statique de l'intégralité du dépôt : `src/` (16 400 lignes TS/TSX),
`supabase/` (15 migrations + `reset.sql`), `docs/` (7 documents), configuration
et historique Git. Exécution de `tsc --noEmit`, `npm run lint` et `npm run build`.

Non couvert (pas d'accès) : contenu réel de la base Supabase, configuration du
projet Supabase (paramètre _Max rows_, région, sauvegardes), configuration
Vercel, données de production.

---

## 3. État des lieux

### 3.1 Architecture

```
Navigateur ──► Vercel (Next.js 16.2, App Router, React 19)
                 │
                 ├─ proxy.ts ─────────► rafraîchit la session + arbitre l'accès
                 ├─ Server Components ─► lecture directe (src/lib/data/*.ts)
                 └─ Server Actions ────► écriture directe (src/lib/data/*.actions.ts)
                                             │
                                             ▼
                                    Supabase (PostgreSQL + Auth)
                                    sécurité = RLS par household
```

Le choix est bon et parfaitement adapté au stade : **pas de couche d'API
intermédiaire**, la sécurité vit dans la base (RLS), Next.js n'est qu'un moteur
de rendu. C'est le minimum de pièces mobiles pour le maximum de fonctionnalités,
exactement ce qu'il faut à une startup. Rien ici ne mérite d'être remis en cause.

Trois couches se distinguent nettement dans `src/lib/`, et c'est la vraie force
du projet :

1. **Logique pure, sans I/O** — `program/plan.ts` (325 l.), `program/stage.ts`
   (389 l.), `stats.ts` (350 l.), `age.ts`, `portions.ts`, `recipe.ts`,
   `food-eligibility.ts`, `season.ts`, `shopping-quantity.ts`. Environ
   **1 800 lignes de règles métier déterministes**, sans dépendance réseau.
2. **Accès données** — `data/*.ts` en lecture, `data/*.actions.ts` en écriture.
3. **Rendu** — `app/` (Server Components) et `components/` (48 fichiers client).

Cette séparation est ce qui rend le projet réparable. C'est aussi ce qui rend
l'absence de tests d'autant plus regrettable : **la couche la plus critique et
la plus facile à tester ne l'est pas du tout**.

### 3.2 Métriques

| Indicateur                                    | Valeur                                     |
| --------------------------------------------- | ------------------------------------------ |
| Lignes TS/TSX                                 | ~15 300                                    |
| Fichiers SQL (migrations + reset)             | 16 fichiers, ~1 620 lignes                 |
| Composants React                              | 79 (dont 48 en `"use client"`)             |
| Server Actions                                | 8 fichiers                                 |
| **Tests**                                     | **0**                                      |
| **Jobs CI**                                   | **0**                                      |
| Erreurs de lint sur `main`                    | **4**                                      |
| Erreurs TypeScript                            | 0 ✅                                       |
| Build production                              | OK, 3,7 s (Turbopack) ✅                   |
| `error.tsx` / `loading.tsx` / `not-found.tsx` | **0**                                      |
| Casts de contournement (`as X`)               | 14 dans `src/lib/data/`                    |
| Fichier le plus gros                          | `components/onboarding.tsx` — 1 130 lignes |

### 3.3 Points forts à préserver

- **Documentation `docs/` de très haut niveau.** `deploiement.md` liste les
  pièges Supabase (allow-list des redirect URLs silencieusement ignorée,
  templates d'email hors build) que l'on ne découvre normalement qu'en
  production. `ux-redesign.md` fige les décisions produit. C'est un actif rare
  et un multiplicateur énorme pour le travail assisté par IA.
- **Commentaires qui expliquent le pourquoi**, pas le quoi. Exemple type :
  `AGENTS.md` documente un bug de compilation SWC sur les entités HTML, avec la
  règle ESLint correspondante et la raison pour laquelle `{" "}` ne le corrige
  pas. C'est de la connaissance qui ne se retrouve pas ailleurs.
- **Modèle de données propre et RLS complète.** Toutes les tables sont couvertes,
  l'isolation passe par `current_household_id()` en `security definer` avec
  `search_path` figé — le piège classique est évité. La lecture anonyme du
  catalogue est explicite (`0010_public_catalog_read.sql`).
- **Migrations idempotentes et commentées**, écrites pour être relues.
- **Logique métier pure et isolée** (§3.1), déjà exécutée côté client pour
  `/decouvrir` sans duplication de code — signe que la frontière est bien placée.
- **Feature flags** (`src/lib/features.ts`) avec typage explicite `: boolean`
  pour que les deux branches restent vérifiées. Bon réflexe.

### 3.4 Dette identifiée

Classement par famille. Le détail des corrections est en §4.

#### A. Aucun filet de sécurité — _la dette structurante_

Zéro test, zéro CI. `npm run lint` échoue sur `main` avec 4 erreurs
(`meal-evaluate-dialog.tsx:50`, `meal-log-dialog.tsx:90`,
`meal-plan-dialog.tsx:76` et `:84`) — deux règles React 19 sur `setState` dans un
effet et sur l'accès à une ref pendant le rendu. Elles sont connues et documentées
comme « préexistantes », ce qui est exactement le mécanisme par lequel une base
de code se dégrade : le signal existe, mais rien ne le fait respecter.

Il n'y a pas non plus de script `typecheck` dans `package.json` : la vérification
TypeScript n'est faite que par `next build`.

**Ce que ça coûte concrètement :** aucune modification de `plan.ts`,
`stage.ts` ou `stats.ts` ne peut être validée autrement qu'en cliquant dans
l'application. Pour une IA, c'est rédhibitoire : elle n'a aucun moyen de vérifier
son propre travail, donc chaque changement de règle métier exige une relecture
humaine intégrale. C'est le principal frein à la vélocité aujourd'hui.

#### B. Contrat de base de données non typé

Aucun type généré depuis le schéma Supabase. `createClient()` retourne un client
non paramétré, donc toute donnée revient en `any` implicite, rattrapé à la main :

- `src/lib/data/meals.ts:95` — `return (data ?? []) as unknown as MealWithDetails[];`
- `src/lib/data/week-briefing.ts:35` — même motif
- 12 autres casts (`as string`, `as { food_id: string }[]`…)

Un `as unknown as` est un mensonge au compilateur. Le type `FoodRow` est
maintenu à la main **en trois endroits** (déclaration, chaîne du `select`, et
colonnes SQL) : renommer une colonne compile parfaitement et casse au runtime.
C'est déjà arrivé au moins une fois dans l'historique (ajout de `cook_minutes` /
`prep_note`, qu'il a fallu répercuter manuellement dans trois fichiers).

#### C. Fiabilité runtime

1. **Les écritures avalent leurs erreurs.** Les lectures gèrent proprement le cas
   d'erreur (`console.error` + valeur de repli). Les écritures, non :

   ```ts
   // src/lib/data/meals.actions.ts — setMealResult
   await supabase.from("meals").update({ result }).eq("id", existing.id);
   revalidateApp(); // ← exécuté même si l'update a échoué
   ```

   Le parent voit sa note s'afficher, l'interface se rafraîchit, rien n'a été
   enregistré. Idem dans `saveMeal` (suppression des lignes liées non vérifiée,
   avec un risque de perte partielle : les `delete` réussissent, les `insert`
   échouent), `deleteInvitation`, `setActiveBaby`, `updateBaby`,
   `setAgeReferenceDate`.

2. **Aucun error boundary, aucun état de chargement.** Aucun `error.tsx`,
   `loading.tsx`, `not-found.tsx` ni `global-error.tsx` dans `src/app/`. Une
   exception dans un Server Component (ex. Supabase indisponible) donne l'écran
   d'erreur brut de Next, sans recours ni identité visuelle. Et comme toutes les
   pages de `(app)` sont dynamiques, chaque navigation attend le serveur **sans
   aucun retour visuel**.

3. **Aucune observabilité.** Pas de Sentry, pas de logs structurés. Les
   `console.error` partent dans les logs Vercel, que personne ne lit. En
   production, un bug chez un utilisateur est **invisible**.

4. **`(app)/layout.tsx:39`** — `pickActiveBaby(...)!` : une assertion non-nulle
   sur un chemin où `babies.length > 0` est garanti juste au-dessus. Correct
   aujourd'hui, mais c'est le genre d'invariant implicite qui casse en silence.

#### D. Fuseau horaire — bug de justesse

`src/lib/dates.ts` construit les dates ISO à partir de l'heure **locale du
processus**. Or les Server Components tournent sur Vercel avec `TZ=UTC` :

```ts
// src/app/(app)/aujourdhui/page.tsx:32
const today = new Date(); // instant courant, interprété en UTC côté serveur
const todayISO = toISODate(today); // getFullYear/getMonth/getDate → date UTC
```

Entre **00 h 00 et 02 h 00 heure de Paris** (été ; 00 h–01 h en hiver), le
serveur est encore la veille. L'écran « Aujourd'hui » affiche donc les repas
d'hier, la notation d'un repas est enregistrée à la mauvaise date, et la
« semaine » bascule avec un jour de retard le lundi matin. Sur une app utilisée
par des parents de nourrissons, la tranche 00 h–02 h n'est pas un cas marginal.

Le commentaire d'en-tête de `dates.ts` — « jour local, sans fuseau surprise » —
est exact côté navigateur, faux côté serveur. Le même fichier est utilisé des
deux côtés.

#### E. Scalabilité des lectures

Le modèle actuel est « je charge tout et j'agrège en JavaScript ». À l'échelle
d'un bébé sur trois mois, c'est parfaitement raisonnable et je ne recommanderais
pas de le changer. Mais deux limites sont **déjà atteignables** :

1. **Limite implicite de PostgREST.** Supabase plafonne par défaut les réponses à
   **1 000 lignes** (paramètre _Max rows_), **sans erreur** : la réponse est
   simplement tronquée. Or :

   | Page          | Requête                            | Lignes potentielles        |
   | ------------- | ---------------------------------- | -------------------------- |
   | `/stats`      | tous les repas depuis la naissance | 4/jour × 365 j = **1 460** |
   | `/allergenes` | fenêtre −365 j / +180 j            | 545 j × 4 = **2 180**      |
   | `/aliments`   | `getFoodStats` — tout l'historique | croît sans borne           |

   Le programme est généré jusqu'à 12,5 mois, soit jusqu'à ~250 jours × 4 repas.
   **Un foyer ayant démarré à 4 mois dépasse le plafond avant le premier
   anniversaire** : les statistiques et le suivi allergènes deviennent faux, en
   silence. C'est le plus insidieux des trois défauts bloquants.

2. **Volume envoyé au navigateur.** `/stats` sérialise tous les repas avec leurs
   jointures complètes (`MEAL_SELECT` embarque `preparation`, `restrictions`,
   `prep_note`… pour chaque aliment de chaque repas) vers `StatsView`, un
   composant client. À 1 000 repas, cela représente plusieurs centaines de Ko de
   RSC payload pour afficher des agrégats. Idem `/semaine`, qui pousse le
   catalogue complet `foods` + `allergens` à `MenuView`.

#### F. Cache et invalidation

Toutes les écritures appellent `revalidatePath("/", "layout")` : **toute**
l'application est invalidée à chaque note de repas. Symétriquement, rien n'est
mis en cache : le catalogue commun (43 aliments, quasi immuable) est relu en base
à chaque affichage de `/semaine`, `/aliments`, `/decouvrir`, de l'onboarding…

Next 16 offre exactement l'outil qui manque (`cacheComponents: true` +
`"use cache"` + `cacheTag`/`revalidateTag`), et il apporte en prime le
Partial Prerendering : un shell statique servi immédiatement, le contenu
dynamique en streaming — ce qui règle aussi une partie du point C.2.

Par ailleurs, `supabase.auth.getUser()` est appelé **deux fois par navigation**
(une fois dans le proxy, une fois dans `(app)/layout.tsx`), chacun étant un
aller-retour réseau vers l'API Auth.

#### G. Migrations : double source de vérité, application manuelle

Deux problèmes distincts :

1. **`supabase/reset.sql` est un doublon divergent.** Son en-tête annonce
   « consolide les migrations 0001 → 0013 » alors qu'il en existe 15. Les
   migrations `0014_baby_prenom_format` et `0015_owner_relation_parent` n'y sont
   pas. Un `reset.sql` exécuté aujourd'hui produit un schéma **différent** de
   celui obtenu en rejouant les migrations. Un fichier de 549 lignes dont la
   véracité repose sur la mémoire de celui qui l'a écrit est un piège.

2. **Application manuelle par copier-coller dans le SQL Editor.** Il n'existe ni
   `supabase/config.toml`, ni Supabase CLI, ni environnement local. Rien ne
   garantit que la base de production correspond aux migrations du dépôt, rien
   ne trace ce qui a été appliqué, et il n'existe **aucun environnement de
   pré-production** : toute évolution de schéma se teste directement en prod.

#### H. Sécurité et conformité

L'essentiel est bon — la RLS fait le travail, et c'est le bon endroit pour elle.
Restent des angles morts :

- **Aucune validation des entrées des Server Actions.** Une Server Action est un
  endpoint HTTP public : n'importe qui peut appeler `saveMeal(babyId, date,
momentId, draft)` avec la charge de son choix. La RLS empêche d'écrire chez un
  autre foyer (bon), mais rien ne valide les formats. `date` n'est jamais
  vérifiée : une chaîne arbitraire produit une erreur Postgres… avalée en
  silence (point C.1). Les notes libres n'ont aucune limite de longueur — rien
  n'empêche d'écrire 10 Mo dans `meals.note`.
- **Aucun en-tête de sécurité.** `next.config.ts` est vide : pas de CSP, pas de
  `Strict-Transport-Security`, pas de `X-Content-Type-Options`,
  `poweredByHeader` non désactivé.
- **`proxy.ts` intercepte trop.** Le matcher exclut les assets statiques mais
  laisse passer `/robots.txt`, `/sitemap.xml`, `/opengraph-image` — trois routes
  publiques qui déclenchent chacune un appel réseau à l'API Auth.
- **RGPD non traité**, alors que l'application stocke des données de santé
  concernant un mineur (réactions allergiques, prénom, date de naissance). Pas de
  suppression de compte, pas d'export, pas de politique de conservation, pas de
  CGU. `docs/deploiement.md` le sait et le liste déjà comme bloquant. **Le
  souligner à nouveau : c'est le seul point de cet audit qui porte un risque
  juridique**, pas seulement technique.
- **Foyers orphelins.** Le trigger `handle_new_user` crée un foyer à chaque
  inscription ; un aidant qui rejoint un foyer via invitation laisse le sien
  derrière lui, vide et jamais nettoyé.

#### I. Frontière client/serveur et composants volumineux

- `components/onboarding.tsx` : **1 130 lignes**, 19 hooks, une machine à états
  de 6 étapes, deux modes (`account` / `preview`), reprise depuis `localStorage`,
  appels serveur. C'est le fichier le plus critique du produit (c'est le
  time-to-value) et le plus difficile à modifier sans régression. Il concentre à
  lui seul le risque de tout changement d'onboarding.
- `app/page.tsx` : 529 lignes de landing marketing dans un seul fichier. Moins
  grave (contenu statique), mais chaque itération marketing touche un pavé.
- Trois dialogues (`meal-log`, `meal-plan`, `meal-evaluate`) partagent le même
  motif « copier les props dans un état local via `useEffect` » — c'est
  précisément ce que les 4 erreurs de lint signalent. Un hook partagé
  (`useDraftState`) supprimerait la duplication et les erreurs d'un coup.
- `src/lib/pending-setup.ts` : l'onboarding sans compte vit en `localStorage`.
  Navigation privée, changement d'appareil ou nettoyage du navigateur =
  questionnaire perdu. Acceptable, mais à assumer explicitement.

#### J. Documentation — les rares scories

- **`README.md` racine** : encore le template `create-next-app`, avec un `HEY`
  perdu à la fin. C'est le premier fichier que lit un humain **comme une IA**.
- **`docs/roadmap.md`** est désynchronisée : les itérations 7, 8 et 9 sont
  marquées « à faire » alors que les stats, le suivi d'acceptation, les
  invitations et le déploiement sont livrés.
- **`docs/technical-direction.md`** annonce la synchronisation temps réel via
  Supabase Realtime : elle n'est pas implémentée (aucun `channel()` dans le
  code), le rafraîchissement passe par `router.refresh()` (20 occurrences). Ce
  n'est pas un défaut — c'est le bon choix — mais la doc ment.
- **Messages de commit** : `tut`, `tut tut`, `v5`. Sans issues ni PR, l'historique
  ne raconte rien. À ce stade c'est un détail ; ça cessera de l'être au deuxième
  contributeur.

---

## 4. Propositions

Chaque chantier est autonome et rédigé pour être exécutable directement.
Format : **problème → travail → critère d'acceptation → effort**.
L'effort est en « sessions » (une session = une demi-journée d'un humain assisté).

### Vague P0 — À faire avant toute ouverture publique

> Objectif : que l'application ne mente jamais à l'utilisateur, et qu'on sache
> quand elle se trompe.

---

#### C1 — Ancrer l'application sur le fuseau `Europe/Paris`

**Problème** : §3.4 D. Le serveur calcule « aujourd'hui » en UTC.

**Travail**

1. Créer `src/lib/timezone.ts` :
   - `export const APP_TIMEZONE = "Europe/Paris";`
   - `todayISO(): string` — date du jour dans `APP_TIMEZONE`, via
     `Intl.DateTimeFormat("fr-CA", { timeZone: APP_TIMEZONE })` (le format
     `fr-CA` produit directement `YYYY-MM-DD`).
   - `nowInAppTz(): Date` — instant courant reprojeté dans le fuseau, pour les
     calculs qui manipulent un `Date` (`weekDays`, `addDays`, `getMonth`).
2. Remplacer **tous** les `new Date()` / `toISODate(new Date())` des Server
   Components et de la couche `data/` :
   `app/(app)/aujourdhui/page.tsx:32`, `semaine/page.tsx:21-22`,
   `allergenes/page.tsx:32,38,39`, `courses/page.tsx:80`, `aliments/page.tsx:17`,
   `stats/page.tsx:13`, `lib/data/baby.actions.ts` (calcul de la durée de
   programme).
3. Ajouter dans `dates.ts` un commentaire d'en-tête précisant que ces fonctions
   opèrent sur le fuseau du processus et **ne doivent pas** être appelées avec
   `new Date()` côté serveur.
4. Ajouter une règle dans `AGENTS.md` : « côté serveur, jamais `new Date()` pour
   une date métier — toujours `todayISO()` ».

**Critère d'acceptation** : avec `TZ=UTC npm run dev` et l'horloge système réglée
à 00 h 30 heure de Paris, l'écran « Aujourd'hui » affiche bien la date du jour à
Paris. Test unitaire `timezone.test.ts` couvrant la bascule minuit et le
changement d'heure (dernier dimanche de mars/octobre).

**Effort** : 1 session · **Gain** : correction d'un bug de justesse quotidien.

---

#### C2 — Rendre les écritures honnêtes (+ observabilité)

**Problème** : §3.4 C.1, C.3. Une écriture qui échoue est indiscernable d'une
réussite.

**Travail**

1. Créer `src/lib/data/result.ts` :
   ```ts
   export type ActionResult<T = void> =
     { ok: true; data: T } | { ok: false; error: string };
   ```
   avec un helper `fail(scope: string, error: PostgrestError): ActionResult<never>`
   qui journalise (structuré) et retourne un message utilisateur en français.
2. Convertir les 8 fichiers `*.actions.ts` : **tout** appel Supabase vérifie son
   `error` et le propage. Ne jamais appeler `revalidatePath` sur un échec.
   Priorité : `meals.actions.ts` (`saveMeal`, `setMealResult` — le geste le plus
   fréquent de l'app), puis `baby.actions.ts`, `program.actions.ts`.
3. Rendre `saveMeal` atomique. Sa séquence `delete` × 3 puis `insert` × 3 peut
   laisser un repas amputé. Deux options :
   - **(recommandée)** une fonction Postgres `save_meal(...)` en `security invoker`
     — la RLS continue de s'appliquer — appelée via `supabase.rpc()` ;
   - à défaut, réordonner (insertions avant suppressions) et retourner une erreur
     explicite en cas d'échec partiel.
4. Côté UI, afficher l'échec. Les composants utilisent déjà `useTransition` : y
   ajouter un état d'erreur et un message. Un toast minimaliste maison suffit
   (pas de nouvelle dépendance).
5. **Sentry** (`@sentry/nextjs`, offre gratuite) : erreurs serveur + client,
   `tracesSampleRate` bas. C'est la seule dépendance d'infrastructure que je
   recommande d'ajouter à ce stade — sans elle, on pilote à l'aveugle.

**Critère d'acceptation** : couper le réseau, noter un repas → un message d'erreur
explicite s'affiche, l'interface ne prétend pas avoir enregistré, l'événement
remonte dans Sentry.

**Effort** : 3 sessions · **Gain** : fin des pertes de données silencieuses.

---

#### C3 — Borner et fiabiliser les lectures

**Problème** : §3.4 E. Troncature silencieuse à 1 000 lignes.

**Travail**

1. **Vérifier d'abord** la valeur de _Max rows_ dans le projet Supabase
   (Settings → API). Le défaut est 1 000.
2. Déporter les agrégats lourds dans Postgres, sous forme de vues ou de fonctions
   `security invoker` (la RLS s'applique donc automatiquement) :
   - `food_stats(baby_id, until_date)` → remplace `getFoodStats` : renvoie une
     ligne par aliment (≈ 50), au lieu de tout l'historique ;
   - `allergen_exposures(baby_id, until_date)` → remplace la double boucle de
     `allergenes/page.tsx` ;
   - `meal_stats(baby_id, from_date, to_date)` → alimente `/stats` avec des
     agrégats par jour/catégorie plutôt que des repas bruts.

   Les fonctions pures de `src/lib/stats.ts` restent la référence du calcul :
   les porter en SQL **après** les avoir couvertes de tests (voir C4), et vérifier
   l'équivalence sur un jeu de données réel.

3. Pour les lectures qui restent brutes (`getMealsBetween`), ajouter un `.limit()`
   explicite et journaliser si la limite est atteinte — mieux vaut un log qu'une
   troncature muette.
4. `MEAL_SELECT` : créer une variante allégée (`id, date, result,
meal_items(food_id), meal_allergens(allergen_id)`) pour les écrans qui n'ont
   pas besoin des fiches complètes (`/stats`, `/allergenes`, `countUpcomingByFood`).

**Critère d'acceptation** : un foyer avec 18 mois d'historique (~2 000 repas)
affiche `/stats` et `/allergenes` avec des chiffres exacts, et le payload RSC de
`/stats` reste sous 100 Ko.

**Effort** : 3 sessions · **Gain** : correction d'un faux résultat silencieux +
scalabilité durable.

---

#### C4 — Tests sur la logique métier pure

**Problème** : §3.4 A. Le cœur du produit (1 800 lignes de règles) n'est vérifié
par rien.

**Travail**

1. Installer **Vitest** (`vitest`, `@vitejs/plugin-react` non nécessaire pour des
   tests purs). Scripts : `"test": "vitest run"`, `"test:watch": "vitest"`,
   `"typecheck": "tsc --noEmit"`.
2. Écrire les tests, dans cet ordre de valeur :

   | Fichier                                                  | Ce qu'il faut verrouiller                                                                                                                                                                                                                |
   | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `lib/program/plan.ts`                                    | 1 seul aliment nouveau par cycle ; répétition sur 2 jours ; écart ≥ 3 j entre allergènes ; légumes avant fruits ; respect de `age_introduction_min` ; `alreadyIntroduced` jamais re-découvert ; déterminisme (même entrée → même sortie) |
   | `lib/age.ts`                                             | `ageEligibility` aux bornes exactes (11 mois, 12 mois pile, 12 mois + 1 j) ; `resolveReferenceDate` avec/sans terme                                                                                                                      |
   | `lib/stats.ts`                                           | chaque agrégat sur un jeu de repas de référence ; le cas « aucun repas noté »                                                                                                                                                            |
   | `lib/program/stage.ts`                                   | stade retourné à chaque seuil d'âge ; différentiel semaine N vs N−1                                                                                                                                                                      |
   | `lib/food-eligibility.ts`                                | seuils fractionnaires (5,5 mois) ; cohérence avec `plan.ts`                                                                                                                                                                              |
   | `lib/portions.ts` / `recipe.ts` / `shopping-quantity.ts` | quantités par âge et catégorie ; libellés d'achat                                                                                                                                                                                        |
   | `lib/dates.ts` / `timezone.ts`                           | semaines à cheval sur un mois ; changement d'heure                                                                                                                                                                                       |

3. Cible : **couverture ≥ 80 % sur `src/lib/` hors `data/`**. Ne pas chercher à
   couvrir les composants React — mauvais rapport valeur/coût à ce stade.
4. Ajouter un **snapshot du programme généré** : `buildPlan` sur un bébé de
   référence (né le 2026-01-15, démarrage à 4 mois, catalogue figé en fixture) →
   sortie sérialisée en snapshot. Toute modification du générateur affiche alors
   son effet exact sur le programme, ce qui rend les changements de règles métier
   relisables.

**Critère d'acceptation** : `npm test` vert, ≥ 60 tests, et une modification
délibérée d'une règle de `plan.ts` fait échouer un test nommément.

**Effort** : 4 sessions · **Gain** : **c'est le déblocage principal pour la
vélocité IA.** Sans cela, aucune évolution du générateur n'est vérifiable
autrement qu'à l'œil.

---

#### C5 — CI GitHub Actions

**Problème** : §3.4 A. Le lint est rouge sur `main` et personne ne l'a su.

**Travail**

1. Corriger d'abord les 4 erreurs existantes. Le motif fautif est identique dans
   les trois dialogues : extraire un hook `src/lib/use-draft-state.ts` qui
   initialise un état depuis des props avec une **clé de réinitialisation**
   (le `key` React sur le dialogue, ou `useState` + comparaison de clé plutôt
   qu'un `useEffect`), et remplacer `initialRef.current` lu pendant le rendu par
   une valeur d'état. Cela supprime la duplication **et** les 4 erreurs.
2. `.github/workflows/ci.yml`, déclenché sur `push` et `pull_request` :
   `npm ci` → `npm run typecheck` → `npm run lint` → `npm test` → `npm run build`.
   Cache npm activé, `fail-fast`.
3. Protéger `main` : PR obligatoire, CI verte requise.
4. `npm run format:check` dans le même job (Prettier est déjà configuré).

**Critère d'acceptation** : une PR introduisant une erreur de lint ou un test
rouge ne peut pas être fusionnée.

**Effort** : 1 session · **Gain** : la qualité cesse de dépendre de la vigilance.

---

#### C6 — RGPD / CGU (bloquant juridique)

**Problème** : §3.4 H. Données de santé d'un mineur, sans cadre.

**Travail**

1. Vérifier et documenter la **région d'hébergement** Supabase (doit être dans
   l'UE) et l'état des sauvegardes.
2. Écrire `/cgu` et `/confidentialite` (Server Components statiques) : nature des
   données, base légale, durée de conservation, absence de partage, mention
   « ne remplace pas un avis médical » — retirée de l'interface, elle doit
   réapparaître ici.
3. Implémenter la **suppression de compte** dans `/profil` : fonction Postgres
   `delete_my_account()` en `security definer` qui supprime le profil, le foyer
   (si dernier membre) et l'utilisateur `auth`. Confirmation explicite requise.
4. Implémenter l'**export** des données du foyer (JSON) depuis `/profil`.
5. Nettoyer les foyers orphelins (foyer sans membre → suppression), en trigger ou
   en tâche planifiée.

**Critère d'acceptation** : un parent peut lire ce qui est fait de ses données,
les exporter et tout supprimer, sans intervention humaine.

**Effort** : 3 sessions · **Gain** : levée du risque juridique.

---

### Vague P1 — Socle d'évolutivité (les 2–3 semaines suivantes)

---

#### C7 — Types Supabase générés

**Problème** : §3.4 B. Le contrat DB est retapé à la main.

**Travail**

1. Installer le Supabase CLI en dépendance de développement.
2. Script `"db:types": "supabase gen types typescript --project-id <ref> --schema public > src/lib/supabase/database.types.ts"`.
3. Paramétrer les trois `createClient()` : `createServerClient<Database>(...)`.
4. Supprimer les 14 casts. Redéfinir les types applicatifs **à partir** des types
   générés :
   ```ts
   type FoodRow = Database["public"]["Tables"]["foods"]["Row"];
   ```
5. Ajouter une vérification en CI : régénérer les types et échouer si le fichier
   diffère (détecte une migration non répercutée).

**Critère d'acceptation** : renommer une colonne dans une migration fait échouer
`npm run typecheck`.

**Effort** : 2 sessions · **Gain** : les erreurs de schéma passent du runtime au
compilateur. Effet particulièrement fort sur le travail assisté par IA — le
schéma devient auto-documenté.

---

#### C8 — Migrations pilotées par le CLI + environnement local

**Problème** : §3.4 G. Application manuelle, `reset.sql` divergent, pas de
pré-production.

**Travail**

1. `supabase init` → `supabase/config.toml` versionné.
2. Aligner le nommage des migrations existantes sur la convention CLI
   (`<timestamp>_<nom>.sql`) et enregistrer l'état déjà appliqué en prod
   (`supabase migration repair`).
3. **Supprimer `supabase/reset.sql`.** Le remplacer par `supabase db reset`
   (rejoue les migrations depuis zéro) + un `supabase/seed.sql` contenant
   uniquement le catalogue de démonstration. Une seule source de vérité.
4. `docs/base-de-donnees.md` : démarrer la base en local, créer une migration,
   l'appliquer, réinitialiser.
5. Créer un **projet Supabase de pré-production** relié aux déploiements d'aperçu
   Vercel. Toute migration s'y applique d'abord.
6. Étape CI : `supabase db reset` puis vérification que le schéma correspond aux
   types générés.

**Critère d'acceptation** : `supabase db reset && npm run dev` donne une base
complète et fonctionnelle sans copier-coller. Une migration est validée en
pré-production avant la production.

**Effort** : 2 sessions · **Gain** : fin de la dérive schéma/code, fin des
migrations testées en production.

---

#### C9 — Validation des entrées des Server Actions

**Problème** : §3.4 H. Les Server Actions sont des endpoints publics non validés.

**Travail**

1. Ajouter **Zod**. C'est la seule dépendance qui vaille ici.
2. Créer `src/lib/validation/schemas.ts` : `isoDateSchema`, `uuidSchema`,
   `mealResultSchema`, `mealDraftSchema` (avec `note` plafonnée à 2 000
   caractères), `babySetupSchema`, `foodInputSchema`.
3. Envelopper chaque action :
   ```ts
   export async function saveMeal(raw: unknown): Promise<ActionResult> {
     const parsed = saveMealSchema.safeParse(raw);
     if (!parsed.success) return { ok: false, error: "Requête invalide." };
     // …
   }
   ```
   Le schéma remplace les validations manuelles éparses (`normalizePrenom`,
   `MAX_PRENOM_LENGTH`, `trim()`) et les rend réutilisables côté client — même
   règle, un seul endroit.
4. Ajouter les contraintes correspondantes en base (`check (length(note) <= 2000)`)
   : défense en profondeur.

**Critère d'acceptation** : un appel forgé avec une date invalide ou une note de
1 Mo est rejeté proprement, sans atteindre Postgres.

**Effort** : 2 sessions.

---

#### C10 — Cache, PPR et états de chargement

**Problème** : §3.4 C.2 et F. Tout est dynamique, tout est invalidé, rien n'est
mis en cache, aucun retour visuel.

**Travail**

1. Activer `cacheComponents: true` dans `next.config.ts` (Next 16 : active
   `"use cache"` **et** le Partial Prerendering par défaut). Lire
   `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`
   avant : le comportement de navigation change (`<Activity>` préserve l'état des
   routes, ce qui touche les dialogues — cf. le guide `preserving-ui-state`).
2. Mettre en cache le catalogue commun :
   ```ts
   export async function getCommonCatalog() {
     "use cache";
     cacheTag("catalog");
     cacheLife("days");
     // …
   }
   ```
   Attention : lire cookies/headers **hors** du périmètre `use cache` et passer
   les valeurs en arguments. La partie « catalogue propre au foyer » reste
   dynamique.
3. Remplacer `revalidatePath("/", "layout")` par des invalidations ciblées :
   `revalidateTag("catalog")` sur `createFood`, `revalidatePath("/aujourdhui")`
   sur `setMealResult`, etc. Un tableau de correspondance action → portée dans
   `docs/technical-direction.md`.
4. Ajouter `error.tsx` (par groupe de routes) + `global-error.tsx` +
   `not-found.tsx`, aux couleurs du design system, avec bouton « réessayer ».
5. Ajouter `loading.tsx` avec des squelettes sur `(app)`, ou envelopper les
   sections lentes dans `<Suspense>` pour profiter du PPR.
6. Restreindre le matcher de `proxy.ts` (exclure `/robots.txt`, `/sitemap.xml`,
   `/opengraph-image`) et éviter le second `getUser()` du layout en réutilisant
   la session déjà validée.

**Critère d'acceptation** : `/semaine` ne relit plus le catalogue à chaque
navigation ; noter un repas n'invalide plus `/aliments` ; une erreur serveur
affiche un écran propre ; toute navigation donne un retour visuel immédiat.

**Effort** : 3 sessions · **Gain** : perception de rapidité et robustesse.

---

#### C11 — Découper `onboarding.tsx`

**Problème** : §3.4 I. 1 130 lignes sur le chemin critique du produit.

**Travail**

1. `src/components/onboarding/` :
   - `use-onboarding-state.ts` — machine à états (étapes, navigation, reprise
     depuis `localStorage`), sans JSX ;
   - `steps/` — un fichier par étape (`prenom`, `sexe`, `naissance`, `demarrage`,
     `rattrapage-aliments`, `rattrapage-allergenes`) ;
   - `index.tsx` — orchestration et modes `account` / `preview`.
2. **Tester la machine à états** (elle devient pure) : transitions, validations,
   reprise du questionnaire en attente, blocage à 12 mois.
3. Appliquer le même traitement à `app/page.tsx` : extraire les sections de la
   landing dans `components/landing/`.

**Critère d'acceptation** : aucun fichier de plus de 300 lignes dans
`components/onboarding/` ; ajouter une étape ne demande de toucher qu'un fichier
plus l'ordre des étapes.

**Effort** : 2 sessions · **Gain** : l'écran le plus sensible du produit devient
modifiable sans crainte.

---

#### C12 — Remettre la documentation en phase

**Problème** : §3.4 J. Le README racine est un template ; roadmap et direction
technique décrivent un état dépassé.

**Travail**

1. Réécrire `README.md` : ce qu'est le produit, démarrage en 3 commandes,
   variables d'environnement, commandes disponibles (`dev`, `build`, `lint`,
   `typecheck`, `test`, `db:types`, `db:reset`), lien vers `docs/`.
2. Mettre `docs/roadmap.md` à jour (7, 8, 9 livrées) et y **ajouter la dette
   technique comme itérations** — ce document est le plan de charge, la dette
   doit y être visible.
3. `docs/technical-direction.md` : corriger la ligne « temps réel Supabase »
   (non implémenté, et c'est un choix), documenter la stratégie de tests, la
   stratégie de cache et le fuseau de référence.
4. Enrichir `AGENTS.md` — c'est le fichier que lisent les IA, chaque règle y a un
   effet démultiplié :
   - jamais `new Date()` pour une date métier côté serveur (C1) ;
   - toute Server Action retourne un `ActionResult` et vérifie ses erreurs (C2) ;
   - toute Server Action valide ses entrées avec Zod (C9) ;
   - toute logique pure ajoutée dans `src/lib/` vient avec ses tests (C4) ;
   - toute modification de schéma = une migration CLI + `npm run db:types` (C7, C8) ;
   - ne jamais éditer les types générés à la main.

**Effort** : 1 session · **Gain** : le meilleur rapport effort/vélocité du lot,
en particulier pour le travail assisté par IA.

---

### Vague P2 — Confort et durabilité

| #       | Chantier                                                                                                                                                                                                                  | Effort |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **C13** | **Tests E2E Playwright** sur 3 parcours seulement : découverte sans compte → création de compte ; noter un repas ; inviter un aidant et rejoindre. Exécutés en CI sur une base de pré-production éphémère.                | 3 s.   |
| **C14** | **En-têtes de sécurité** dans `next.config.ts` : CSP (attention aux styles inline de Next), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `poweredByHeader: false`. Vérifier avec securityheaders.com.               | 1 s.   |
| **C15** | **PWA** : `manifest.ts`, icônes, service worker minimal (coquille + catalogue en cache). Fort intérêt produit — un parent en cuisine, avec un réseau instable, doit pouvoir lire la recette du jour hors-ligne.           | 2 s.   |
| **C16** | **Index Postgres** : `meals(baby_id, date)`, `meal_items(meal_id)`, `meal_allergens(meal_id)`, `intake_observations(meal_id)`, `food_introductions(baby_id)`. Vérifier ce que la RLS génère comme plans.                  | 1 s.   |
| **C17** | **Analytics produit** (Vercel Analytics ou Plausible) : taux de complétion de l'onboarding, rétention à 7 j. Sans mesure, les décisions produit sont des paris.                                                           | 1 s.   |
| **C18** | **Conventions de commit et PR** : messages descriptifs, une PR par chantier, template de PR. À faire avant, pas après, l'arrivée d'un deuxième contributeur.                                                              | 0,5 s. |
| **C19** | **Suivi des dépendances** : Dependabot ou Renovate, groupé mensuellement. Next 16 et React 19 bougent vite.                                                                                                               | 0,5 s. |
| **C20** | **`revalidateTag` + Realtime ciblé** : si l'usage multi-aidants décolle, un abonnement Supabase Realtime sur `meals` du foyer actif remplacerait avantageusement les `router.refresh()`. À ne faire que sur besoin avéré. | 2 s.   |

---

## 5. Séquencement proposé

```
Semaine 1  ── C5 (CI + lint vert)  ──►  C4 (tests logique pure)
                   │                          │
                   └──────────► C1 (fuseau) ◄─┘        [C1 a besoin de C4 pour être vérifié]

Semaine 2  ── C2 (erreurs + Sentry) ──► C3 (lectures bornées)   [C3 s'appuie sur les tests de C4]

Semaine 3  ── C7 (types générés) ──► C8 (migrations CLI + préprod)
              C9 (validation Zod)

Semaine 4  ── C10 (cache/PPR/erreurs UI) · C11 (onboarding) · C12 (docs)

Avant ouverture publique : C6 (RGPD/CGU) — indépendant, à lancer en parallèle
                           dès la semaine 1 (il y a de la rédaction).

Ensuite, au fil de l'eau : C13 → C20.
```

**Ordre imposé** : C5 avant tout (sans CI, chaque correction peut en casser une
autre) ; C4 avant C1 et C3 (les tests sont le moyen de prouver que ces
corrections sont justes) ; C7 avant C8 (les types générés valident les
migrations).

**Charge totale P0 + P1 : ~26 sessions**, soit environ 3 semaines à plein temps,
ou 6 à 8 semaines à mi-temps. À l'échelle du projet (~16 000 lignes), c'est un
investissement raisonnable et non négociable si l'application accueille du public.

---

## 6. Ce que je recommande de NE PAS faire

Aussi important que la liste précédente — à ce stade, ces chantiers coûteraient
plus de vélocité qu'ils n'en apporteraient :

- **Ne pas ajouter d'ORM** (Prisma, Drizzle). Le client Supabase typé (C7) couvre
  99 % des besoins, et la RLS impose de passer par PostgREST de toute façon. Un
  ORM ajouterait une couche de traduction sans bénéfice.
- **Ne pas introduire tRPC ni de couche d'API.** Les Server Actions font le
  travail. Il manque seulement la validation (C9), pas une abstraction.
- **Ne pas ajouter de gestionnaire d'état global** (Redux, Zustand, Jotai). Les
  Server Components tiennent l'état ; les 48 composants clients gèrent du local.
  C'est le bon modèle, ne pas le complexifier.
- **Ne pas passer en monorepo.** Une seule application, un seul déploiement.
- **Ne pas viser 100 % de couverture de tests.** Cibler `src/lib/` (règles
  métier). Tester les composants React coûterait cher et attraperait peu.
- **Ne pas implémenter le temps réel Supabase maintenant.** `router.refresh()`
  suffit tant qu'il n'y a pas de retour utilisateur sur le sujet (C20).
- **Ne pas réécrire l'interface.** Elle vient d'être refondue et elle est bonne.
  La dette est dans le socle, pas dans les écrans.
- **Ne pas migrer d'hébergeur.** Vercel + Supabase est le bon couple pour ce
  produit, et le restera bien au-delà de la traction actuelle.

---

## 7. Indicateurs de suivi

À mesurer maintenant, puis chaque mois :

| Indicateur                                      | Aujourd'hui | Cible à 1 mois | Cible à 3 mois |
| ----------------------------------------------- | :---------: | :------------: | :------------: |
| Tests automatisés                               |      0      |      ≥ 60      |     ≥ 120      |
| Couverture de `src/lib/` (hors `data/`)         |     0 %     |     ≥ 70 %     |     ≥ 85 %     |
| Erreurs de lint sur `main`                      |      4      |     **0**      |     **0**      |
| CI verte obligatoire                            |     non     |      oui       |      oui       |
| Casts `as unknown as` dans `src/lib/data/`      |      2      |     **0**      |     **0**      |
| Écritures dont l'erreur est ignorée             |     ~20     |     **0**      |     **0**      |
| Routes sans error boundary                      |    100 %    |    **0 %**     |    **0 %**     |
| Erreurs de production détectées automatiquement |     non     |      oui       |      oui       |
| Migrations appliquées à la main                 |    100 %    |    **0 %**     |    **0 %**     |
| Fichiers de plus de 500 lignes                  |      3      |       1        |     **0**      |

---

## 8. Questions ouvertes

Réponses utiles pour affiner les priorités :

1. **Horizon d'ouverture publique.** Y a-t-il une date visée ? Si l'ouverture est
   à moins d'un mois, C6 (RGPD/CGU) devient le chantier n° 1 et C11/C12 passent
   après.
2. **Deuxième contributeur.** Quelqu'un d'autre doit-il pouvoir contribuer à
   court terme, humain ou agent autonome ? Si oui, C5, C8 et C12 montent en
   priorité (un nouvel arrivant ne peut aujourd'hui même pas monter une base
   locale).
3. **Volume attendu.** Quelques dizaines de foyers ou quelques milliers ? En
   dessous de ~500 foyers actifs, C3 peut se limiter au bornage explicite ; au
   delà, les agrégats en SQL deviennent indispensables.
4. **Multi-marché.** Le programme encode le PNNS 4 (recommandations françaises)
   et les catégories sont des chaînes accentuées en français
   (`"légume"`, `"protéine"`). Un déploiement hors de France est-il envisagé ? Si
   oui, il faut prévoir dès maintenant l'internationalisation du référentiel
   métier (identifiants stables plutôt que libellés) — ce serait un chantier
   supplémentaire, à traiter avant que le catalogue ne grossisse.
5. **Budget outillage.** Sentry et Supabase pré-production ont des offres
   gratuites suffisantes pour ce stade, mais un second projet Supabase dépasse le
   quota gratuit d'un compte personnel (2 projets). Est-ce acceptable ?
