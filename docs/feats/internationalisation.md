# Internationalisation — le produit se lit aussi en anglais

> Petite Cuillère est écrite en français de bout en bout : l'interface, les pages
> de méthode, le catalogue d'aliments en base, les phrases que le générateur de
> recettes fabrique, les noms d'outils que le modèle vocal lit. Rien n'a été
> prévu pour une seconde langue, et c'est un choix qui se voit dans le code :
> `<html lang="fr">` en dur, `Intl.DateTimeFormat("fr-FR")` recopié dans sept
> fichiers, l'élision de « d'huile » codée dans une expression régulière.
>
> Cette fonctionnalité rend le produit **entièrement lisible par un parent
> américain** : tout ce qu'il voit, tout ce qu'il entend, tout ce que
> l'application lui écrit. Deux langues pour commencer — français et anglais
> américain — mais l'architecture doit encaisser la troisième sans qu'on
> réécrive quoi que ce soit.
>
> S'appuie sur `commande-vocale.md` (la compréhension vocale) et
> `creneaux-horaires.md` (les moments de repas). Les numéros de § y renvoient.

Dernière mise à jour : 2026-08-11

---

## 1. Le constat

L'application ne sait pas qu'elle parle une langue. Ce n'est pas un manque de
configuration, c'est une absence de couture : nulle part le français n'est isolé
du reste. Quatre endroits le montrent.

**L'interface.** De l'ordre de 1 500 à 2 000 fragments de texte français vivent
directement dans le JSX, entre les balises. La landing (`src/app/page.tsx`, 951
lignes) et l'onboarding (`src/components/onboarding.tsx`, 1 288 lignes) sont à
eux deux presque un cinquième du volume. Rien n'est nommé, rien n'est indexé :
il n'existe aucune liste de ce que l'application dit.

**Le catalogue.** Soixante-dix aliments et seize allergènes vivent en base avec
six à sept champs de texte chacun — `name`, `texture`, `preparation`,
`restrictions`, `prep_note`, `quantite_indicative`, `portion_label`. Ce n'est
pas de l'étiquette d'interface, c'est du **contenu métier rédigé** : « Mondée,
épépinée, cuite puis mixée. L'acidité s'adoucit à la cuisson ». Il est lu par le
générateur de recettes, par la page allergènes, par la liste de courses.

**Les phrases fabriquées.** `src/lib/recipe.ts` ne stocke pas des phrases, il en
**compose**. Il choisit « la purée » ou « la compote » selon que les fruits sont
cuits, colle le geste du catalogue en le décapitalisant (`lower`), élide le
« de » devant une voyelle (`withDe`), énumère avec « et » (`joinNames`),
conjugue le verbe de mise en texture (`blendVerb`). C'est de la grammaire
française codée en dur, et c'est le morceau qui ne se traduit pas — il se
réécrit.

**La voix.** Le moteur de transcription est configuré sur `languages: ["fr"]`,
le lexique du foyer est normalisé en `fr-FR`, et les outils que le modèle lit
(`noter_repas`, `moment_id`, l'énumération `passe | present | futur`) sont des
littéraux français — délibérément, parce que ce sont des mots lus par un modèle
qui raisonne dans la langue de l'énoncé (§4.4). Un énoncé anglais adressé à des
outils français est exactement le désaccord que ce choix cherchait à éviter.

À quoi s'ajoutent les évidences : `<html lang="fr">`, la semaine qui commence le
lundi (`startOfWeek`), les grammes, les guillemets français, l'espace insécable
avant les deux-points, les modèles d'e-mails Supabase, l'image Open Graph.

---

## 2. Ce que voit le parent — spécification fonctionnelle

### 2.1 Comment sa langue est choisie

1. **Un choix explicite l'emporte toujours.** Le sélecteur de langue est dans le
   pied de page (site public) et dans le menu du compte (application). Le choix
   est mémorisé dans un cookie `pc_lang`, valable un an, et suit la personne
   d'un appareil à l'autre uniquement si elle rouvre le même navigateur — c'est
   assumé, voir D3.
2. **Sinon, le navigateur décide.** L'en-tête `Accept-Language` est lu à la
   première visite : un navigateur qui demande l'anglais reçoit l'anglais.
3. **Sinon, le français.** C'est la langue du domaine, de la marque et de tout
   ce qui est déjà indexé — voir D1, où cette décision est discutée contre la
   proposition initiale.

La langue est **une propriété de la personne devant l'écran, pas du foyer**. Un
foyer avec une mère anglophone et une grand-mère française voit les deux langues
en même temps, chacune sur son téléphone, sur les mêmes données. Rien n'est
stocké en base : pas de colonne, pas de réglage à synchroniser, pas de conflit à
arbitrer.

### 2.2 Ce qui se traduit

**Tout ce que l'application écrit elle-même.** L'interface, les libellés, les
messages d'erreur, les états vides, les infobulles, les `aria-label`, les titres
de page, la landing, les deux pages de méthode, l'onboarding, le parcours
« Découvrir », les e-mails d'authentification, l'aperçu de partage.

**Le contenu métier du catalogue commun.** Le nom de chaque aliment, sa texture,
son geste de préparation, sa restriction de sécurité, sa quantité indicative ;
le nom de chaque allergène, sa fenêtre, sa note, ses doses.

**Les phrases fabriquées.** Le pas-à-pas de cuisine, l'annonce du menu, les
quantités, les stades de diversification, les phrases de rattrapage, les
libellés de statistiques.

**La voix.** L'énoncé est transcrit dans la langue du parent, compris par des
outils rédigés dans cette langue, et la carte de confirmation lui répond dans la
même.

### 2.3 Ce qui ne se traduit pas

- **Le prénom de l'enfant.** Évidemment.
- **Ce que le foyer a écrit lui-même** : un aliment ajouté à la main, un moment
  de repas renommé, la relation d'un aidant. C'est sa donnée, pas notre copie.
  Affichée telle quelle dans les deux langues.
- **Le nom de la marque.** « Petite Cuillère » reste « Petite Cuillère » en
  anglais — c'est un nom propre, il porte l'origine du produit, et son unique
  traduction naturelle (« Little Spoon ») est déjà une marque de puériculture
  américaine. Seule la signature change (§12.2).

### 2.4 Ce qui change en plus des mots

|                  | Français         | Anglais (US)       |
| ---------------- | ---------------- | ------------------ |
| Date longue      | samedi 9 août    | Saturday, August 9 |
| Date courte      | 09/08            | 8/9                |
| Semaine          | lundi → dimanche | Sunday → Saturday  |
| Heure            | 16 h 30          | 4:30 PM            |
| Portion de purée | ~150 g           | about 5 oz         |
| Petite quantité  | 2 c. à café      | 2 tsp              |
| Courses          | 1,2 kg           | 2 lb 10 oz         |
| Guillemets       | « comme ceci »   | "like this"        |
| Avant `:`        | espace insécable | rien               |

Le changement de premier jour de semaine n'est pas cosmétique : il déplace la
grille du planificateur hebdomadaire, la fenêtre de la liste de courses et
l'agrégation des statistiques. C'est le point le plus facile à oublier et le
plus visible quand il manque.

### 2.5 La méthode reste française, et le dit

Le programme s'appuie sur les repères français et européens : PNNS, ESPGHAN pour
la fenêtre des morceaux, LEAP et EAT pour les allergènes, séries CICBAA pour
l'ordre de fréquence. Ces repères ne coïncident pas exactement avec ce qu'un
pédiatre américain dira — l'AAP recommande d'attendre « environ 6 mois » là où
la pratique française ouvre à 4 mois révolus, et met en avant les aliments
riches en fer (viande, céréales enrichies) là où on commence ici par un légume.

**On ne construit pas une seconde méthode.** On traduit celle-ci, et la version
anglaise dit d'où elle vient, en toutes lettres, sur la page de méthode et dans
le pied de page : _« Petite Cuillère follows French and European infant feeding
guidance (PNNS, ESPGHAN, EFSA). US guidance from the AAP differs on some points
— most notably on when to start solids. Talk to your pediatrician. »_ C'est
honnête, c'est court, et ça ne prétend pas être ce que le produit n'est pas. Une
méthode américaine à part entière est une décision produit, pas une traduction :
elle est hors périmètre (§15).

---

## 3. Décisions de cadrage

### D1 — La langue par défaut reste le français, à l'adresse racine

**La proposition initiale était l'inverse** : anglais par défaut, français
seulement si `Accept-Language` le met en tête. Elle ne tient pas, pour une
raison qui n'a rien à voir avec la préférence linguistique.

Un robot d'indexation n'envoie pas d'`Accept-Language`, ou envoie `en`.
Googlebot est donc, par construction, exactement le visiteur qui déclenche le
repli. Avec l'anglais par défaut, les quatre URL publiques déjà indexées — la
landing, `/decouvrir`, et les deux pages de méthode dont les segments sont
**écrits pour la recherche française** (`src/lib/routes.ts`) — se mettraient à
servir de l'anglais au moteur qui les a classées sur des requêtes françaises.
C'est la totalité de l'acquisition du produit qui bascule, pour un gain nul :
l'anglais aurait ses propres adresses de toute façon (§4.2).

**La décision :** le français reste servi aux URL actuelles, inchangées.
L'anglais vit sous `/en`. Un navigateur qui réclame l'anglais est **redirigé**
depuis la racine vers `/en` à sa première visite : l'intention de la demande
initiale est respectée — un parent américain qui tape le domaine tombe en
anglais — sans que le repli sans signal ne coûte le référencement.

Si le produit vise un jour d'abord les États-Unis, la bascule est une ligne
(`DEFAULT_LOCALE`) plus une série de redirections permanentes ; la question se
reposera à ce moment-là, avec des chiffres.

### D2 — Un préfixe d'URL, pas un cookie seul

Le cookie seul rendrait une même URL capable de servir deux contenus. Trois
conséquences, toutes mauvaises : l'anglais devient inindexable (un moteur
n'explore pas les variantes d'un `Vary: Cookie`), un lien partagé entre deux
aidants ne montre pas la même chose aux deux, et **les pages publiques perdent
leur prérendu** — lire un cookie bascule une route en rendu dynamique, ce qui
coûte exactement la seconde d'aller-retour serveur que le reste du code se donne
tant de mal à éviter (cf. `AGENTS.md`, la règle du `loading.tsx`).

Le cookie reste, mais dans son rôle correct : **la mémoire d'un choix
explicite**, pas le support de la langue.

### D3 — Rien en base

Aucune colonne `locale` sur `profiles`. La langue est une préférence de lecture,
pas une donnée du foyer : la stocker obligerait à arbitrer entre le réglage du
compte et celui du navigateur, à propager un changement entre appareils, et à
gérer le cas d'un aidant invité qui n'a pas encore de profil. Le cookie répond à
tout ça en ne posant aucune question. Conséquence assumée : changer d'appareil
redemande une négociation — qui redonne la bonne langue neuf fois sur dix.

### D4 — Le catalogue est traduit en base, pas dans le code

Les textes du catalogue sont de la donnée, éditée par migration SQL comme le
reste. Les sortir vers un dictionnaire TypeScript casserait le lien entre
l'aliment et sa préparation, et laisserait les aliments propres à un foyer sans
solution. Voir §6.

### D5 — Pas de bibliothèque i18n

Deux langues, une vingtaine de routes, un rendu serveur : le dictionnaire est un
module TypeScript et le formatage est `Intl`. Une bibliothèque apporterait
l'ICU, le routage localisé et le typage des messages — dont on obtient
l'essentiel pour moins cher (§5). Ce qu'elle apporte vraiment, et qu'on
n'aurait pas, c'est la gestion des pluriels de langues à cinq formes ; on
reposera la question à la troisième langue, et `next-intl` est le candidat.

### D6 — Le français reste la langue source

On traduit **depuis** le français, jamais l'inverse. Une chaîne existe d'abord
en français ; l'anglais est dérivé. C'est ce qui permet au typage de prouver la
complétude (§5.1) et ce qui garde `AGENTS.md` vrai : le produit se pense en
français.

---

## 4. Le routage

### 4.1 La locale, en un type

```ts
// src/lib/i18n/locale.ts
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

/** La locale BCP-47 complète, pour `Intl` et `toLocaleLowerCase`. */
export const INTL_LOCALE: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
};
```

Deux clés courtes (`fr`, `en`) pour le routage, les dictionnaires et le cookie ;
la locale complète uniquement là où `Intl` en a besoin. Un `fr-CA` ou un `en-GB`
qui arriveraient dans `Accept-Language` retombent sur leur langue de base.

### 4.2 Le préfixe, présent seulement pour l'anglais

| Langue   | URL                                 | Prérendu     | Indexé |
| -------- | ----------------------------------- | ------------ | ------ |
| Français | `/`, `/decouvrir`, `/aujourdhui`…   | oui (public) | oui    |
| Anglais  | `/en`, `/en/discover`, `/en/today`… | oui (public) | oui    |

L'arborescence passe sous un segment `[lang]` — `src/app/[lang]/(app)/…`,
`src/app/[lang]/decouvrir/…` — avec `generateStaticParams` dans le layout racine
pour que les deux versions des pages publiques restent prérendues au build. Le
segment est **absent de l'URL en français** : c'est le proxy qui réécrit `/` en
`/fr` interne (`NextResponse.rewrite`, l'adresse affichée ne change pas).

Ce n'est pas gratuit — le proxy porte désormais une réécriture — mais c'est le
seul montage qui garde à la fois les URL françaises actuelles, le prérendu, et
une adresse propre par langue.

### 4.3 Les segments sont traduits eux aussi

`src/lib/routes.ts` dit déjà pourquoi : les segments publics sont « écrits pour
la recherche ». Un segment français sous `/en` serait un contresens exactement
pour la même raison. La carte des routes devient la source unique :

```ts
// src/lib/i18n/routes.ts
export const ROUTES = {
  home: { fr: "/", en: "/" },
  discover: { fr: "/decouvrir", en: "/discover" },
  method: {
    fr: "/decouvrir/methode-diversification-alimentaire",
    en: "/discover/how-to-start-solids",
  },
  allergensDoc: {
    fr: "/decouvrir/introduction-allergenes",
    en: "/discover/introducing-allergens",
  },
  today: { fr: "/aujourdhui", en: "/today" },
  week: { fr: "/semaine", en: "/week" },
  shopping: { fr: "/courses", en: "/shopping" },
  foods: { fr: "/aliments", en: "/foods" },
  allergens: { fr: "/allergenes", en: "/allergens" },
  stats: { fr: "/stats", en: "/stats" },
  baby: { fr: "/bebe", en: "/baby" },
  household: { fr: "/foyer", en: "/household" },
  profile: { fr: "/profil", en: "/profile" },
  // … et les deux versions « dans l'app » des pages de méthode.
} as const;
```

Le dossier sur disque garde son nom français (`aujourdhui/`) : c'est le proxy qui
réécrit `/en/today` vers `/en/aujourdhui` en interne. On ne duplique pas
l'arborescence, et les `import` ne bougent pas.

Trois fonctions accompagnent la carte, et remplacent tout `href` littéral :

```ts
href(key: RouteKey, locale: Locale): string          // pour <Link>
routeKeyOf(pathname: string): RouteKey | null        // pour le sélecteur
switchLocale(pathname: string, to: Locale): string   // « la même page, en anglais »
```

Les segments dynamiques (`/rejoindre/[token]` → `/en/join/[token]`) suivent la
même carte avec un paramètre.

Les routes d'API (`/api/voix`, `/auth/callback`) **ne sont pas préfixées** :
elles ne sont lues par personne. La voix reçoit la locale dans le corps de la
requête.

### 4.4 Le proxy, dans l'ordre exact

`src/proxy.ts` fait aujourd'hui une chose : rafraîchir la session Supabase et
arbitrer l'accès (`updateSession`). L'ordre des opérations est le piège : un
`NextResponse.redirect` créé sans recopier les cookies posés par
`supabase.auth.getUser()` **déconnecte l'utilisateur** au premier rafraîchissement
de jeton.

```
1. Détecter la locale demandée
   a. préfixe /en dans le chemin        → locale = en, source = url
   b. cookie pc_lang valide             → locale, source = cookie
   c. Accept-Language (parseur q-value) → locale, source = header
   d. DEFAULT_LOCALE                    → locale, source = default

2. Si le chemin est non préfixé ET locale ≠ fr ET source ≠ url
      → redirect 307 vers href(routeKeyOf(pathname), locale)
        (307 et non 308 : la négociation peut changer d'avis)

3. Appeler updateSession(request) — session, garde d'accès
      (les chemins publics de `supabase/middleware.ts` sont désormais
       reconnus dans les deux langues, via routeKeyOf)

4. Sur la réponse qui en sort, quelle qu'elle soit :
   · réécrire vers /{lang}{cheminInterneFr}    (rewrite)
   · poser x-pc-locale (lu par les Server Components hors [lang])
   · rafraîchir pc_lang si la source est url ou header
   · Vary: Accept-Language, Cookie sur les chemins non préfixés
```

Le point 4 opère sur la réponse **retournée par** `updateSession`, en recopiant
ses cookies — c'est la seule façon de composer les deux sans perdre la session.

Le `matcher` actuel exclut déjà `robots.txt`, `sitemap.xml` et l'image Open
Graph. Il faut y ajouter `manifest`/`favicon` s'ils apparaissent, pour la même
raison : ce sont des fichiers que personne ne lit dans une langue.

### 4.5 Le sélecteur

Deux liens (`FR` / `EN`), pas un `<select>` : ce sont des `<a>` vers l'URL
équivalente, donc indexables, préchargeables, et fonctionnels sans JavaScript.
Cliquer pose le cookie via un Server Action et navigue. Placé dans `SiteFooter`
(public) et dans le menu du compte de `AppShell` (application).

---

## 5. Les dictionnaires

### 5.1 Des modules TypeScript, pas du JSON

```ts
// src/lib/i18n/dictionaries/fr/today.ts
export const today = {
  title: "Aujourd'hui",
  empty: "Rien de prévu aujourd'hui.",
  mealsLeft: (n: number) => (n <= 1 ? "1 repas à venir" : `${n} repas à venir`),
  askedBy: (prenom: string) => `Qu'est-ce que ${prenom} a mangé ?`,
} as const;

// src/lib/i18n/dictionaries/en/today.ts
import type { Namespace } from "../types";
export const today: Namespace<"today"> = {
  title: "Today",
  empty: "Nothing planned for today.",
  mealsLeft: (n) => (n === 1 ? "1 meal left" : `${n} meals left`),
  askedBy: (name) => `What did ${name} eat?`,
};
```

Le français est la source ; l'anglais est **typé d'après lui**. Une clé oubliée,
une clé en trop, un paramètre de mauvais type : `tsc` échoue au build. C'est le
seul mécanisme de complétude dont on a besoin, et il ne coûte pas une ligne
d'outillage.

Du JSON aurait imposé un vérificateur maison, un format d'interpolation à parser
et l'impossibilité d'écrire une règle de pluriel dans la langue qui la porte.

### 5.2 Un espace de noms par écran

Un dictionnaire monolithique de deux mille clés serait sérialisé en entier dans
la charge utile de chaque page. Le découpage suit les écrans, pas les
composants :

```
common      navigation, boutons, jours, mois, unités, actions
landing     la page d'accueil publique
discover    le parcours sans compte
method      les deux pages de méthode
onboarding  la création du foyer et de l'enfant
today       l'écran du jour, la fiche repas, le rattrapage
week        le planificateur
shopping    la liste de courses
foods       le catalogue et les découvertes
allergens   la page allergènes
stats       les statistiques
account     profil, foyer, aidants, invitations
voice       la dictée, les exemples, la carte de confirmation
program     les stades, les phrases de replanification, les recettes
emails      les modèles d'authentification
```

Une page charge `common` plus le sien. `landing`, le plus gros, ne pèse que sur
une page statique où il est prérendu.

### 5.3 Interpolation et pluriels : des messages-fonctions

Une chaîne qui prend un paramètre est une fonction. Pas de `{{name}}` à
remplacer, pas de moteur de gabarit : le typage des paramètres est gratuit, et
la règle de pluriel de chaque langue est écrite **dans cette langue**. Ce n'est
pas de la coquetterie — le français et l'anglais ne coupent pas au même endroit :

| n   | Français   | Anglais |
| --- | ---------- | ------- |
| 0   | 0 semaine  | 0 weeks |
| 1   | 1 semaine  | 1 week  |
| 2   | 2 semaines | 2 weeks |

Le `${n > 1 ? "s" : ""}` de `src/lib/age.ts` et de
`src/lib/shopping-quantity.ts` est donc faux en anglais, silencieusement. Trois
occurrences à déplacer dans les dictionnaires.

### 5.4 Côté client

La plupart des gros composants sont des composants client (`onboarding`,
`week-planner`, `today-meals`, `voice-provider`, `shopping-list`, `stats-view`,
`discover-flow`…). Ils ne peuvent pas appeler `getDictionary`.

Le layout de segment charge les espaces de noms de son sous-arbre et les fournit
par contexte :

```tsx
<I18nProvider locale={lang} dict={{ common, today, voice }}>
```

Les composants client lisent `useT("today")`. Le contexte ne porte que les
espaces de noms déclarés par le segment — c'est ce qui garde la charge utile
raisonnable. Les composants serveur, eux, importent directement.

### 5.5 Ce qu'on s'interdit

- **Une clé qui décrit le texte, pas l'endroit.** `today.empty`, jamais
  `nothingPlannedToday` : la clé doit survivre à une reformulation.
- **La concaténation.** `t.mealCount(n)` et jamais `n + " " + t.meals` — l'ordre
  des mots n'est pas universel, et la règle vaudra encore à la troisième langue.
- **Une chaîne partagée « parce que c'est le même mot ».** « Fruit » dans un
  filtre et « Fruit » dans un titre sont deux clés : elles divergeront.

### 5.6 Un effet de bord bienvenu

Le piège documenté dans `AGENTS.md` — SWC décode les entités HTML **avant** de
rogner les espaces de bord, ce qui fait disparaître un espace dans un texte JSX
multi-ligne — **disparaît de lui-même** pour tout texte déplacé dans un
dictionnaire : une chaîne JavaScript n'est pas du texte JSX, elle n'est pas
rognée. La règle reste écrite pour le JSX résiduel, mais sa surface se réduit à
presque rien.

En sens inverse, une règle nouvelle : **l'anglais ne prend pas d'espace
insécable avant `:` `;` `?` `!`**. Recopier la typographie française dans le
dictionnaire anglais est la faute la plus probable de tout ce chantier.

---

## 6. Le catalogue en base

### 6.1 Une colonne `translations` en JSONB

```sql
alter table public.foods     add column translations jsonb;
alter table public.allergens add column translations jsonb;
```

```json
{
  "en": {
    "name": "Carrot",
    "texture": "Cooked, finely puréed",
    "preparation": "Steam, then blend. Organic is a good idea (nitrates). One vegetable a day at first.",
    "prep_note": "peel and slice into rounds",
    "restrictions": null,
    "quantite_indicative": null,
    "portion_label": null
  }
}
```

**Pourquoi une colonne et pas une table jointe.** `getFoods()` est appelée sur
presque chaque page ; une jointure supplémentaire par requête, avec ses propres
politiques RLS, se paie partout. La colonne ne change aucune requête existante,
n'ajoute aucune politique, et surtout **ne touche pas** l'index unique
`foods_common_name_key` sur `name` — c'est lui que les migrations utilisent pour
« upserter » le catalogue par nom, et c'est le nom français qui reste la clé.
Ajouter l'espagnol sera une migration de données, pas de schéma.

Si le catalogue gagne un jour une interface d'édition, on promeut la colonne en
table `food_translations` ; la fonction de résolution ci-dessous est le seul
appelant à changer.

### 6.2 La résolution, en TypeScript, avec repli explicite

```ts
// src/lib/data/localize.ts
export function localizeFood(row: FoodRow, locale: Locale): FoodRow {
  if (locale === DEFAULT_LOCALE) return row;
  const t = row.translations?.[locale];
  if (!t) return row; // aliment propre au foyer, ou pas encore traduit
  return { ...row, ...pickNonNull(t) };
}
```

`getFoods(locale)` et `getAllergens(locale)` appliquent le repli à la sortie de
la requête. Trois propriétés en découlent :

1. **le repli est le français**, jamais une chaîne vide ni une clé nue ;
2. **un aliment ajouté par un foyer** (`household_id not null`) n'a pas de
   traduction, et s'affiche tel que le parent l'a écrit — ce qui est exactement
   la bonne réponse ;
3. **c'est testable** sans base, dans le jeu de tests `scripts/`.

Le champ `season` (JSONB) et les champs numériques ne sont pas concernés.

### 6.3 Les moments de repas

`meal_moments` est peuplé par un trigger à l'inscription, en français
(`Petit-déjeuner`, `Déjeuner`, `Goûter`, `Dîner`), et renommable — sauf que
`FEATURE_CUSTOM_MEALS` vaut `false` : ces libellés sont donc **de facto des
valeurs système**, pas de la donnée saisie.

On ajoute une colonne `slug` :

```sql
alter table public.meal_moments
  add column slug text check (slug is null or slug in
    ('breakfast', 'lunch', 'snack', 'dinner'));
```

Le trigger la renseigne, l'affichage devient `slug ? t.moments[slug] : label`, et
le jour où le renommage s'ouvre, renommer met `slug` à `null` — le libellé saisi
reprend la main, dans les deux langues. Les foyers existants sont rattrapés par
la migration, sur la correspondance des libellés français d'origine.

Le `label` reste en base : il sert de repli, et le lexique vocal comme les
requêtes historiques continuent de fonctionner.

### 6.4 Le travail de traduction du catalogue

Environ **70 aliments × 6 champs** et **16 allergènes × 7 champs**, soit un peu
plus de cinq cents fragments. Ce n'est pas de la traduction mot à mot :

- **les noms** suivent l'usage américain : `Courgette` → _Zucchini_, `Blanc de
poireau` → _Leek (white part)_, `Potiron`/`Courge` → _Pumpkin_ / _Winter
  squash_, `Petits pois` → _Peas_ ;
- **une poignée d'aliments n'existe pas aux États-Unis**, et c'est le seul
  endroit du catalogue qui demande un arbitrage plutôt qu'un dictionnaire :
  `Petit-suisse` et `Fromage blanc` n'ont pas d'équivalent au rayon américain
  (le plus proche est _whole-milk plain yogurt_ ou _whole-milk ricotta_),
  `Fromage à pâte pressée` devient _hard cheese (cheddar, gruyère)_,
  `Semoule` devient _semolina (couscous)_, `Farine infantile avec gluten`
  devient _iron-fortified infant cereal (wheat)_ — ce dernier est d'ailleurs le
  point où la méthode américaine et la nôtre se rejoignent le mieux, l'AAP
  mettant les céréales enrichies en fer au premier plan. Ces choix se prennent
  aliment par aliment, avec la relecture métier, pas au fil de la traduction ;
- **les gestes** deviennent des impératifs anglais complets, ponctués comme des
  phrases : « Vapeur puis mixer. » → _« Steam, then blend. »_ ;
- **les doses** passent aux cuillères américaines : « 2 c. à café de beurre de
  cacahuète (≈ 2 g de protéine) » → _« 2 tsp peanut butter (about 2 g of
  protein) »_ ;
- **les fenêtres** gardent les mois : _« from 4–6 months »_, avec le tiret demi-cadratin
  et non le trait d'union ;
- **les restrictions** sont le seul endroit où la traduction doit être
  littérale, mot pour mot : ce sont des consignes de sécurité.

Livré en une migration `00XX_catalog_translations.sql`, relue comme du contenu.

---

## 7. La grammaire fabriquée

C'est le cœur technique du chantier. Trois modules composent des phrases
françaises par concaténation ; ils doivent être fendus en deux — la logique
métier d'un côté, la fabrique de phrases de l'autre.

### 7.1 Le principe

**La structure d'une recette n'a pas de langue.** Quelles préparations existent,
lesquelles cuisent à la vapeur et lesquelles à l'eau, quel féculent se sert à
côté à partir de quelle texture, dans quel ordre viennent les étapes : c'est du
métier, ça ne bouge pas. Ce qui bouge, c'est la phrase qui le dit.

`src/lib/recipe.ts` garde donc tout son raisonnement et délègue chaque phrase à
une **grammaire** injectée :

```ts
// src/lib/recipe/grammar.ts
export type RecipeGrammar = {
  /** « la purée » / « la compote » / « le dessert » — nommable en milieu de phrase. */
  partName(course: RecipeCourse, cooked: boolean, chunky: boolean): string;
  /** L'étape de cuisson vapeur, seule ou commune. */
  steamStep(names: string[], minutes: number): string;
  /** Le geste de mise en texture, avec le bon verbe. */
  blendStep(
    names: string[],
    texture: Texture,
    withCookingWater: boolean,
  ): string;
  /** L'ajout de matière grasse, hors du feu. */
  fatStep(names: string[], spoons: number, partName: string): string;
  /** Le féculent gardé entier. */
  sideStep(): string;
  /** Comment un `prep_note` du catalogue s'insère en étape. */
  noteStep(note: string, host: string | null): string;
  /** L'annonce du menu : « purée de courge », « squash purée ». */
  dishName(partName: string, foods: string[]): string;
  joinNames(names: string[]): string;
};
```

`composeRecipe(items, months, locale)` choisit `GRAMMARS[locale]`. Les fonctions
privées actuelles — `withDe`, `lower`, `joinNames`, `spoons`, `partName`,
`blendVerb` — descendent dans `grammar.fr.ts` sans changer d'une ligne.

### 7.2 Ce que l'anglais fait autrement

`grammar.en.ts` n'est pas une transposition : plusieurs mécanismes français
n'ont pas d'équivalent, et inversement.

- **L'élision disparaît.** `withDe` (« d'huile » / « de haricot ») n'existe pas.
  À la place, l'anglais **inverse le complément** : « purée de courge » devient
  _squash purée_, jamais _purée of squash_. La forme `dishName` doit donc être
  un point d'extension, pas un gabarit à trous.
- **La décapitalisation ne s'applique pas pareil.** `lower()` recolle un geste
  du catalogue en milieu de phrase française. En anglais, une note est une
  **phrase indépendante** derrière son ingrédient en gras : _« **Egg** —
  hard-boil for 9 minutes, then peel. »_ Le catalogue anglais est donc rédigé
  capitalisé, et `noteStep` ne décapitalise rien.
- **L'énumération prend une virgule d'Oxford.** _carrot, potato, and leek_.
- **Le verbe de texture change de registre.** « Mixe en purée bien lisse » →
  _« Blend until completely smooth »_ ; « Écrase grossièrement, en gardant de
  petits morceaux fondants » → _« Mash coarsely, leaving soft, meltable
  pieces »_. Les textures elles-mêmes (`textureFor`, `program/schedule.ts`)
  passent d'une chaîne française libre à une **clé** (`smooth`, `grainy`,
  `mashed`, `morsels`), traduite à l'affichage — c'est un assainissement dont le
  français profite aussi : `recipe.ts` compare aujourd'hui `texture === "petits
morceaux fondants"`, une comparaison de chaîne d'interface pour piloter une
  règle métier.
- **Le tutoiement.** Le pas-à-pas français tutoie (« Cuis à la vapeur »).
  L'anglais américain n'a pas ce choix à faire : l'impératif est neutre.

### 7.3 Le genre de l'enfant

`src/lib/sexe.ts` produit un pronom (`il`/`elle`) et choisit une forme accordée
(`né`/`née`, `prêt`/`prête`). En anglais, l'accord n'existe pas : il ne reste que
le pronom. Deux conséquences :

- `agree()` devient une fonction de la grammaire de la locale. En anglais, elle
  renvoie systématiquement la forme unique — ce qui supprime des dizaines de
  paires de variantes dans le dictionnaire anglais ;
- **le repli change de valeur.** En français, `null` retombe sur le masculin,
  défaut grammatical assumé. En anglais, _he_ pour un enfant dont le parent n'a
  rien dit se lit comme une erreur : le repli est **they** (_they've already
  tried carrots_), qui est l'usage courant et n'oblige personne à répondre à une
  question qu'on ne pose pas.

### 7.4 Les autres phrases fabriquées

| Module                 | Ce qu'il fabrique                         | Traitement                                                                                                      |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `program/stage.ts`     | 8 stades (titre + résumé) et les conseils | Dictionnaire `program`, clés par stade                                                                          |
| `program/diff.ts`      | « on a ajusté demain… »                   | Messages-fonctions, règle D8 conservée                                                                          |
| `program/preview.ts`   | Aperçu du programme sans compte           | Dictionnaire `discover`                                                                                         |
| `age.ts`               | « 5 mois et 2 semaines », phases          | Messages-fonctions (pluriel !)                                                                                  |
| `portions.ts`          | « ~150 g », « 1 c. à café »               | Unités, §8.2                                                                                                    |
| `shopping-quantity.ts` | « 3 pots », « 2 portions »                | Messages-fonctions (pluriel !)                                                                                  |
| `stats.ts`             | Libellés d'axes, formats de dates         | Dictionnaire `stats` + `Intl`                                                                                   |
| `season.ts`            | Saisons                                   | Dictionnaire `common`                                                                                           |
| `categories.ts`        | 11 libellés de catégories                 | Dictionnaire `common` — **la clé reste française** (`légume`), c'est un identifiant métier lu par le générateur |

---

## 8. Formats, unités, calendrier

### 8.1 Les formateurs, en un seul endroit

Sept fichiers instancient aujourd'hui leur propre `Intl.DateTimeFormat("fr-FR")`
au niveau du module — donc au chargement, donc avec une locale figée à la
compilation. Ils convergent vers `src/lib/i18n/format.ts` :

```ts
export function dayFormat(locale: Locale): Intl.DateTimeFormat;
export function weekdayShort(locale: Locale): Intl.DateTimeFormat;
export function timeFormat(locale: Locale): Intl.DateTimeFormat; // 16 h 30 / 4:30 PM
export function rangeFormat(locale: Locale): Intl.DateTimeFormat;
```

Chacun mémoïse par locale, comme `clock.ts` le fait déjà pour ses fuseaux. Le
`Intl.DateTimeFormat("en-GB")` de `clock.ts` **ne change pas** : il n'affiche
rien, il découpe une date en parties pour le calcul, et `en-GB` est choisi pour
son format prévisible. Un commentaire l'y dira, sans quoi quelqu'un le
« corrigera ».

### 8.2 Les unités

Le modèle reste **en grammes** : `Portion.grams` alimente l'agrégation de la
liste de courses, et une conversion en amont ferait dériver les totaux. Seul
l'affichage change.

```ts
// src/lib/i18n/units.ts
export function formatPortion(p: Portion, locale: Locale): string;
export function formatShoppingWeight(grams: number, locale: Locale): string;
```

Règles de conversion, avec le même « arrondi de cuisine » que `roundGrams` :

| Grammes  | Français    | Anglais (US) |
| -------- | ----------- | ------------ |
| < 10 g   | 1 c. à café | 1 tsp        |
| 10–30 g  | ~20 g       | 1–2 tbsp     |
| 30–110 g | ~60 g       | about 2 oz   |
| ≥ 110 g  | ~150 g      | about 5 oz   |

Les repères de `portions.ts` tombent juste : 60 → 2 oz, 120 → 4 oz, 150 → 5 oz,
180 → 6 oz, 200 → 7 oz. Pour les courses, au-delà de 16 oz on passe en
livres (_2 lb 10 oz_).

Deux libellés à ne pas traduire mécaniquement : « 1 pot » (laitage) devient
_1 container_, pas _1 cup_ — une _cup_ américaine est une mesure de volume, et
l'ambiguïté est alimentaire.

Le tilde français (`~150 g`) devient _about_ en anglais : `~5 oz` se lit comme
une coquille.

### 8.3 La semaine

`startOfWeek` et `weekDays` (`src/lib/dates.ts`) prennent un premier jour de
semaine dérivé de la locale (lundi en `fr`, dimanche en `en-US`). Trois
appelants suivent : le planificateur hebdomadaire (`week-planner.tsx`, sa grille
et son en-tête), la liste de courses (la fenêtre couverte) et les statistiques
(l'agrégation hebdomadaire). C'est le point à vérifier en premier sur la recette
de test, parce qu'un décalage d'un jour ne se voit pas — il se déduit.

---

## 9. La voix

### 9.1 Transcription

`transcribe.ts` fixe `language_config: { languages: ["fr"], code_switching: false }`
à deux endroits. La locale y est injectée. Le choix du modèle est à revoir :
`solaria-3` a été retenu comme « le meilleur modèle sur du français » — la
comparaison est à refaire pour l'anglais, et le fichier doit pouvoir choisir un
modèle par langue.

`buildLexicon` (`lexicon.ts`) normalise en `fr-FR` et applique `MIN_LENGTH = 4`.
Les deux sont à passer en paramètres : la casse suit la locale, et le seuil de
longueur est un réglage empirique **mesuré sur du français** qu'il faudra
remesurer.

### 9.2 Compréhension

Les noms d'outils, leurs descriptions et **leurs valeurs d'énumération** sont des
littéraux français lus par le modèle (§4.4). Ils vivent dans une table par
locale, et le code s'appuie sur un type de domaine indépendant de la langue :

```ts
type DayKeyword = "today" | "yesterday" | "dayBefore" | "tomorrow" | "dayAfter" | "isoDate";
type Tense      = "past" | "present" | "future";

const TOOL_LOCALE: Record<Locale, {
  names:  Record<ToolName, string>;      // noter_repas / log_meal
  days:   Record<DayKeyword, string>;    // hier / yesterday
  tenses: Record<Tense, string>;         // passe / past
  descriptions: …;
}>;
```

`resolution.ts` cesse ainsi de comparer des chaînes françaises (`DAY_OFFSETS`
indexé par `"hier"`) et travaille sur le type de domaine. C'est encore un
assainissement dont le français profite : la table de correspondance
« mot français → décalage de jours » est aujourd'hui une donnée métier écrite en
français dans un fichier de logique.

Le prompt système (`context.ts`, `INSTRUCTIONS`) et les exemples de dictée
(`voice-examples.tsx`) sont traduits, et **réécrits** plutôt que traduits : un
parent américain ne dicte pas « il a mangé des poireaux à midi » mais _« he had
peas for lunch »_. Les exemples doivent sonner juste, sinon personne ne les
imite.

### 9.3 Évaluation

`scripts/fixtures/voice-cases.jsonl` est un jeu de cas français. Il lui faut un
pendant anglais — ce n'est pas une traduction du fichier, ce sont des énoncés
anglais réels avec leurs pièges propres (« _he ate around noon_ », les heures en
AM/PM, « _a couple of spoonfuls_ »). `voice-eval.ts` prend la locale en
paramètre et les deux jeux tournent séparément.

C'est le lot le plus incertain du chantier, et celui qu'il faut mesurer avant de
promettre quoi que ce soit : la commande vocale peut sortir en anglais **après**
le reste, sans bloquer le lancement (§14, lot 5).

---

## 10. Référencement, métadonnées, e-mails

### 10.1 hreflang

Chaque page publique déclare ses deux adresses. Sans réciprocité, la déclaration
est ignorée — c'est l'erreur classique.

```ts
alternates: {
  canonical: href(key, locale),
  languages: {
    "fr-FR": href(key, "fr"),
    "en-US": href(key, "en"),
    "x-default": href(key, "fr"),
  },
}
```

`x-default` pointe le français : c'est ce que reçoit un visiteur sans signal
(D1). `openGraph.locale` suit (`fr_FR` / `en_US`) avec `alternateLocale`.

`sitemap.ts` émet les deux jeux d'URL, chacun avec ses `alternates`. `robots.ts`
est inchangé. Les pages `/methode` restent en `noindex`, canoniques vers leur
pendant public de la bonne langue.

### 10.2 L'image de partage

`opengraph-image.tsx` contient du texte français en dur. Elle devient
`[lang]/opengraph-image.tsx`, avec `generateStaticParams` — deux images
prérendues au build. Attention au débordement : _« What to cook, how much, what
texture »_ n'a pas la longueur de son original.

### 10.3 Les e-mails d'authentification

Les modèles vivent dans la console Supabase (`supabase/email-templates/`). Ils ne
connaissent pas notre locale.

**Solution retenue :** la locale est écrite dans les métadonnées utilisateur à
l'inscription (`signInWithOtp({ options: { data: { lang } } })`), et le modèle
branche dessus avec un `if` de gabarit Go :

```
{{ if eq .Data.lang "en" }}Your sign-in code{{ else }}Votre code de connexion{{ end }}
```

**À vérifier avant de s'engager :** que GoTrue expose bien `.Data` dans les
modèles `magic-link` et `confirm-signup`, et qu'un utilisateur revenant sans
métadonnée retombe proprement sur le français. À défaut, repli sans risque :
un modèle bilingue, anglais sous un filet, français au-dessus. Deux e-mails, dix
lignes chacun — ce n'est pas le combat à mener.

### 10.4 Ce qui n'est pas concerné

Les URL d'authentification, les redirections OAuth et les jetons d'invitation
sont indifférents à la langue. Un lien d'invitation ouvert par un aidant
anglophone lui donne l'anglais, parce que la négociation joue à l'ouverture.

---

## 11. L'inventaire

| Zone                                                            | Volume                                       | Nature du travail                      |
| --------------------------------------------------------------- | -------------------------------------------- | -------------------------------------- |
| Interface (`src/components`, `src/app`)                         | ~1 500–2 000 chaînes, 60 fichiers            | Extraction + traduction                |
| Landing + `/decouvrir` + méthode                                | ~350 chaînes, éditorial long                 | **Réécriture**, pas traduction         |
| Catalogue en base                                               | ~500 champs                                  | Migration de données, relecture métier |
| Phrases fabriquées (`lib/program`, `recipe`, `age`, `portions`) | 9 modules                                    | Refonte : grammaire injectée           |
| Voix                                                            | 6 modules + 1 jeu de fixtures                | Table par locale + remesure            |
| Routage                                                         | `proxy.ts`, `routes.ts`, arborescence `app/` | Nouveau segment `[lang]`               |
| Formats                                                         | 7 formateurs dispersés + `dates.ts`          | Convergence vers un module             |
| E-mails, OG, sitemap                                            | 5 fichiers                                   | Duplication                            |

Le poste le plus lourd n'est pas la traduction : c'est **l'extraction**. Sortir
deux mille chaînes du JSX sans en casser une est un travail mécanique, long, et
qui se vérifie mal à l'œil — d'où §13.

---

## 12. L'éditorial anglais

### 12.1 Le registre

Les règles d'écriture de la landing (`src/app/page.tsx`) tiennent telles quelles
et se transposent : on parle à un parent fatigué, le bénéfice avant le
mécanisme, une situation concrète plutôt qu'une fonctionnalité nommée, jamais
d'injonction ni de culpabilisation.

Ce qui change dans la langue d'arrivée :

- **Les phrases raccourcissent.** Le français aime la subordonnée ; l'anglais
  américain coupe. Une phrase française de 25 mots en donne souvent deux.
- **Les contractions sont la norme.** _don't_, _you'll_, _it's_. Leur absence
  sonne institutionnel — exactement ce qu'on ne veut pas.
- **La voix est active.** « Le programme est ajusté » → _« We adjusted the
  plan »_.
- **Pas de tirets cadratins en cascade** — la règle 3 existait déjà, elle est
  encore plus vraie en anglais.
- **Pas d'espace insécable avant la ponctuation double.** Jamais.
- **Guillemets droits typographiques** `"…"`, pas `« … »`.

### 12.2 Le glossaire

Les décisions structurantes, à tenir partout. « Diversification » est la plus
importante : c'est le mot du produit, et il n'existe pas en anglais courant.

| Français                    | Anglais (US)          | Pourquoi pas autre chose                                                  |
| --------------------------- | --------------------- | ------------------------------------------------------------------------- |
| diversification alimentaire | starting solids       | _diversification_ n'existe pas dans ce sens ; _weaning_ veut dire sevrage |
| le programme                | your plan             | _program_ sonne institutionnel                                            |
| aidant                      | caregiver             |                                                                           |
| foyer                       | household             |                                                                           |
| moment de repas             | mealtime              |                                                                           |
| goûter                      | afternoon snack       |                                                                           |
| purée (salée)               | purée                 | passé dans l'usage américain                                              |
| compote                     | fruit purée           | _compote_ est un dessert de restaurant                                    |
| féculent                    | starchy food          |                                                                           |
| matière grasse              | healthy fat           | _fat_ seul a une charge négative                                          |
| morceaux fondants           | soft, meltable pieces | _meltable_ est le mot des recommandations américaines                     |
| découverte (d'un aliment)   | first taste           |                                                                           |
| rattrapage                  | catch-up              |                                                                           |
| fenêtre d'introduction      | introduction window   |                                                                           |
| dose d'entretien            | maintenance serving   |                                                                           |
| réaction                    | reaction              |                                                                           |
| c. à café / c. à soupe      | tsp / tbsp            | abréviations standard                                                     |
| Petite Cuillère             | Petite Cuillère       | marque ; _Little Spoon_ est déjà pris                                     |

### 12.3 Échantillons

Pour fixer le ton avant d'ouvrir le chantier.

**Signature de la marque**

> Les premiers repas de bébé, en toute confiance. Chaque jour, on vous dit quoi
> cuisiner, comment et en quelle quantité.
>
> _Baby's first meals, without the second-guessing. Every day, we tell you what
> to cook, how, and how much._

**Titre de la landing**

> Le repas de bébé, chaque jour, sans y penser
>
> _Baby's meals, sorted — one day at a time_

**Un stade** (`program/stage.ts`)

> **Le repas complet du midi** — Le midi devient un vrai repas — légume, protéine
> et fruit — et le goûter s'ouvre aux fruits, une quinzaine de jours après le
> premier légume.
>
> _**Lunch becomes a real meal**_ — _About two weeks in, lunch grows into a full
> meal: a vegetable, a protein, and a fruit. Fruit joins the afternoon snack
> too._

**Une étape de recette**

> Mets courgette et carotte à cuire ensemble à la vapeur 15 min. Mixe-les
> ensemble en purée bien lisse, en ajoutant un peu d'eau de cuisson si besoin.
>
> _Steam the zucchini and carrot together for 15 minutes. Blend until completely
> smooth, adding a little cooking water if needed._
>
> (« courgette » devient _zucchini_, pas _courgette_ : c'est l'américain.)

**Une consigne d'allergène**

> Délayé dans une compote ou un laitage. Jamais de cacahuète entière avant 3 ans.
>
> _Thinned into fruit purée or yogurt. Never whole peanuts before age 3._

**Une phrase de replanification** (règle D8 : jamais de vocabulaire d'écart)

> On a ajusté : le brocoli revient dès demain.
>
> _We've adjusted things — broccoli comes back tomorrow._

---

## 13. Garde-fous

L'extraction de deux mille chaînes ne se relit pas. Quatre filets, du moins cher
au plus cher :

1. **Le typage.** `en` est typé d'après `fr` : clé manquante ou en trop = échec
   de compilation. C'est gratuit et c'est le principal.
2. **Un test de parité** (`scripts/i18n.test.ts`, dans le `npm test` existant) :
   pour chaque clé, les deux langues ont la même arité de fonction, et aucune
   valeur anglaise n'est restée identique à la française sauf liste blanche
   explicite (les mots identiques dans les deux langues : _stop_, _menu_,
   _portion_, les prénoms…). C'est ce test qui attrape la chaîne oubliée.
3. **Un test de typographie** : aucune chaîne anglaise ne contient d'espace
   insécable, de `«`, `»`, ni d'entité HTML. Aucune chaîne française ne perd les
   siennes.
4. **Une recette de vérification manuelle**, une fois par langue : la landing,
   l'onboarding complet, une fiche repas avec deux préparations, la semaine (le
   premier jour !), les courses, la page allergènes, une dictée. Trente minutes,
   et c'est le seul moyen de voir ce qui déborde d'un bouton.

Un mot sur ce qu'on ne teste pas : la **justesse** de la traduction. Aucun test
ne l'attrape. C'est de la relecture, et elle doit se faire dans le produit, pas
dans un tableur.

---

## 14. Découpage en lots

Chaque lot est déployable et laisse le produit entier. Aucun ne rend le français
moins bon.

**Lot 1 — La plomberie, en français seul.**
Le segment `[lang]`, le proxy, la carte des routes, le module de locale, les
formateurs, le sélecteur de langue (désactivé). Les dictionnaires existent avec
une seule langue. Rien ne change à l'écran, et tout est en place. C'est le lot
qui doit être irréprochable : c'est lui qu'on ne refera pas.

**Lot 2 — L'extraction.**
Les ~2 000 chaînes de l'interface passent dans les dictionnaires français.
Toujours une seule langue. Mécanique, vérifiable écran par écran, sans risque
fonctionnel.

**Lot 3 — La grammaire.**
Le fendage de `recipe.ts`, les textures qui deviennent des clés, `agree()` dans
la grammaire, les unités, la semaine. Toujours en français : on prouve que la
version française est identique **au caractère près** avant d'introduire
l'anglais.

**Lot 4 — L'anglais.**
Le dictionnaire anglais, la grammaire anglaise, la migration du catalogue,
`hreflang`, l'image Open Graph, les e-mails, le sélecteur activé. C'est le lot
de traduction pure — et le seul qui se voie.

**Lot 5 — La voix en anglais.**
Table d'outils par locale, transcription, lexique, jeu de fixtures anglais,
remesure de la qualité. Sort après, et n'empêche rien : tant qu'il n'est pas
livré, le micro n'apparaît simplement pas en anglais.

---

## 15. Hors périmètre

- **Une méthode américaine.** Le programme reste calé sur les repères français
  et européens, et le dit (§2.5). Adapter le générateur aux recommandations de
  l'AAP est une décision produit à part entière.
- **Une troisième langue.** L'architecture l'accepte ; personne ne la traduit
  aujourd'hui.
- **Le choix de langue en base.** Voir D3.
- **La traduction du contenu saisi par un foyer.** Voir §2.3.
- **Une interface d'administration du catalogue.** La traduction passe par
  migration, comme le reste.
- **Les devises et le paiement.** Il n'y en a pas.
