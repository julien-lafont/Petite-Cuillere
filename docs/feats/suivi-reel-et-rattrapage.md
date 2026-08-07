# Suivi réel & rattrapage — le programme suit la vraie vie

> Le programme de diversification est théorique. La vie ne l'est pas. Cette
> fonctionnalité permet au parent de dire, en un geste, **ce qui s'est réellement
> passé** — et au programme de **se réparer tout seul** derrière, sans jamais
> culpabiliser.
>
> Fondé sur `auto-diversification-program.md` (le générateur), `ux-redesign.md`
> (décisions D2, D8, écran « Aujourd'hui »), `diversification-guide.md` (les règles
> métier de rattrapage).

Dernière mise à jour : 2026-08-06
Statut : **validé** — décisions A → G actées le 2026-08-06.

---

## 1. Le constat

Le générateur produit aujourd'hui un plan parfait, écrit en base jusqu'au premier
anniversaire, et **jamais démenti par le réel**. Or le plan sera raté, souvent :

| Situation réelle                                    | Fréquence     | Ce que fait l'app aujourd'hui                        |
| --------------------------------------------------- | ------------- | ---------------------------------------------------- |
| Bébé n'est pas à la maison (nounou, grands-parents) | Hebdo         | Rien — le repas reste « prévu »                      |
| L'ingrédient du jour n'est pas dans le frigo        | Hebdo         | Rien — le parent improvise en silence                |
| Le parent donne autre chose (reste, petit pot)      | Hebdo         | Rien                                                 |
| Le parent introduit un nouvel aliment hors plan     | Régulier      | Rien — le plan le reproposera plus tard, en double   |
| Bébé refuse                                         | Très fréquent | Noté — mais l'app ne dit rien, là où le parent doute |
| Interruption longue (vacances, maladie, gastro)     | Ponctuel      | Rien — le plan continue d'avancer sans l'enfant      |

Conséquence : au bout de deux semaines, l'écart entre l'écran et la réalité rend
l'écran faux. Un parent ne suit pas un programme faux — **il arrête l'app**. C'est
le vrai risque de rétention du produit, plus que n'importe quelle fonctionnalité
manquante.

### Le seul signal fiable dont on dispose

Un repas passé **non évalué** n'a peut-être pas été donné. C'est notre unique
indice, et il est ambigu : il peut aussi vouloir dire « tout s'est bien passé, je
n'ai simplement rien tapé ». Tout le design découle de la manière dont on lève
cette ambiguïté (§3).

---

## 2. La promesse, en une phrase

> **Dire ce qui s'est vraiment passé doit coûter moins cher que de ne rien dire.**

Trois corollaires qui gouvernent chaque décision qui suit :

| Principe                        | Conséquence                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------- |
| **Un geste, pas un formulaire** | Le cas le plus fréquent (« pas donné ») se règle en **1 tap**, sans modale.      |
| **Là où le parent est déjà**    | Sur « Aujourd'hui ». Jamais un menu, jamais un onglet « corriger le programme ». |
| **Jamais de dette**             | Aucun compteur de repas non renseignés, aucune série, aucun rouge (D8).          |

---

## 3. Le principe fondateur : prévu ≠ réel, et l'asymétrie de confiance

Aujourd'hui une ligne `meals` est **à la fois** la prévision et le journal. Il faut
les distinguer — mais sans dupliquer les tables (cf. §6) : une ligne de repas gagne
un **statut**.

```
prevu ──── le parent note (😋/😐/🙅) ──────────────▶ servi
  │
  ├─────── « pas donné » ────────────────────────▶ saute
  │
  └─────── « il a mangé autre chose » ───────────▶ remplace
```

### L'asymétrie de confiance — la décision centrale

Que fait-on d'un repas passé resté à `prevu` ? La bonne réponse n'est pas la même
selon ce qui est en jeu, parce que **le coût de l'erreur n'est pas le même** :

| Enjeu                    | Repas passé non renseigné       | Pourquoi                                                                                                                                             |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Découverte gustative** | **présumé fait**                | Si on se trompe, l'aliment revient de toute façon dans la rotation. Le coût est nul. Bloquer le plan sur un parent silencieux serait catastrophique. |
| **Allergène**            | **non confirmé** → à reproposer | Si on se trompe, on croit l'enfant protégé alors qu'il n'a jamais touché à l'arachide. Le coût est un préjudice de santé.                            |

C'est la seule asymétrie du produit, et elle est défendable telle quelle devant un
parent : « on n'insiste que sur ce qui compte pour sa sécurité ».

**Garde-fou** : un allergène non confirmé est reproposé **une seule fois**. Au-delà,
le programme avance quand même et l'allergène reste marqué « à confirmer » dans
_Découvertes_ — sans quoi le calendrier bouclerait indéfiniment sur l'œuf.

---

## 4. UI / UX

### 4.1 « Aujourd'hui » — deux questions, deux rangées

`MealQuickRating` (3 grandes cibles) est conservé : noter un repas vaut
confirmation qu'il a eu lieu. Les deux divergences forment une **seconde rangée**,
qui répond à ce que la première ne sait pas dire :

```
╭──────────────────────────────────────────────╮
│  Comment ça s'est passé ?                    │
│  ╭────────╮   ╭────────╮   ╭────────╮        │
│  │   😋   │   │   😐   │   │   🙅   │        │
│  │ adoré  │   │ moyen  │   │ refusé │        │
│  ╰────────╯   ╰────────╯   ╰────────╯        │
│  ╭─────────────────────╮ ╭─────────────────╮ │
│  ┆ ⇄ Il a mangé autre  ┆ ┆  ⊘  Pas donné   ┆ │
│  ┆   chose             ┆ ┆                 ┆ │
│  ╰─────────────────────╯ ╰─────────────────╯ │
│           + Ajouter une note ou un effet     │
╰──────────────────────────────────────────────╯
```

**Correction du 2026-08-07 — pourquoi ce ne sont plus des liens.** La première
version les posait en liens soulignés, en typographie secondaire. Ils se lisaient
comme des notes de bas de page, là où ils décrivent des situations aussi banales
que les trois autres : un repas chez la nounou, un frigo vide. Ils prennent donc
la même forme de tuile — la hiérarchie est tenue par la **taille** et le contour
en pointillés, pas par un changement de registre qui les rendait invisibles.

- **⊘ Pas donné** → **1 tap**, aucune modale, aucune confirmation. C'est la
  divergence la plus fréquente, elle doit être la moins chère. La tuile reste
  **enfoncée** et un second tap annule : il n'y a pas de bouton « Annuler »
  séparé à chercher.
- **⇄ Il a mangé autre chose** → ouvre la feuille §4.3. La tuile reste enfoncée
  tant que le repas est en statut `remplace`.

Le lien « Ajouter une note ou un effet » reste, en troisième position.

### 4.2 « Remplacer » — la correction **avant** le repas

La moitié des écarts se décident **devant le frigo**, pas après. Sur la fiche
recette, chaque ligne d'aliment porte son propre remplacement :

```
   Courgette  ~120 g  🌿 de saison            [ ⇄ Remplacer ]
   ╭──────────────────────────────────────╮
   │ Remplacer courgette par              │
   │  ( brocoli )  ( carotte )  ( courge ) │
   ╰──────────────────────────────────────╯
```

Trois substituts proposés instantanément, choisis par le moteur dans la **même
catégorie**, déjà connus de l'enfant, les moins servis en premier. Un tap = le repas
du jour est réécrit, la suite du plan est réajustée, la liste de courses aussi.

**Correction du 2026-08-07 — l'action s'appelle « Remplacer ».** Elle s'appelait
« je n'en ai pas », posé en lien sous l'aliment. Deux défauts : le libellé décrit
la situation du parent au lieu de nommer ce que le bouton fait — personne ne
comprenait qu'il y avait là une action — et la ligne supplémentaire sous chaque
aliment doublait la hauteur de la composition. Le bouton passe donc **sur la
ligne**, à droite, et le panneau de substituts ne s'ouvre qu'au clic, avec la
phrase qui manquait : « Remplacer courgette par ».

C'est le geste le plus rentable de toute la fonctionnalité : il transforme un
abandon silencieux en une donnée propre, **et** il rend service au parent dans la
seconde.

### 4.3 La feuille « Qu'est-ce qu'il a mangé ? »

Une seule feuille (bottom sheet mobile / dialog PC), trois zones, aucun défilement
infini :

```
╭──────────────────────────────────────────╮
│  Ce midi — mardi 6 août                  │
│                                          │
│  ╭────────────────────────────────────╮  │
│  │   ⊘  Rien / on a sauté ce repas    │  │
│  ╰────────────────────────────────────╯  │
│                                          │
│  Ce qui était prévu                      │
│  ( carotte ✓ ) ( huile de colza ✓ )      │
│                                          │
│  Il a mangé plutôt…                      │
│  ( petits pois ) ( courgette ) ( pomme ) │
│  ( brocoli ) ( poire ) ( banane )        │
│  [ 🔍 chercher un aliment ]              │
│                                          │
│  ⚠ Le petit pois, il ne l'a jamais goûté │
│    — on le reproposera demain.           │
│                                          │
│              [ Annuler ] [ C'est noté ]  │
╰──────────────────────────────────────────╯
```

Décisions de design :

1. **Les aliments prévus sont pré-cochés.** Le cas « il a mangé la carotte **plus**
   un yaourt » se règle en un tap, sans tout ressaisir.
2. **Les aliments proposés sont ceux qu'il connaît déjà**, triés par pertinence
   (même catégorie que le prévu d'abord). La recherche ouvre le catalogue entier.
3. **On prévient, on ne bloque jamais.** Un aliment hors ordre, hors âge, ou deux
   nouveautés le même jour : un message factuel, calme, et le bouton reste actif.
   Refuser un enregistrement, c'est perdre le parent pour de bon.
4. **Le message d'impact est affiché avant validation** (« on le reproposera
   demain ») : le parent comprend que le programme vit, il n'a pas à le deviner.

Le composant réutilise `MealFoodPicker`, déjà écrit.

### 4.4 La bande de rattrapage — les jours précédents

En haut d'« Aujourd'hui », quand des repas passés sont restés sans signal :

```
╭──────────────────────────────────────────╮
│  Hier, il vous restait deux repas         │
│                                           │
│  Déjeuner · carotte      😋  😐  🙅  ⊘   │
│  Goûter   · pomme        😋  😐  🙅  ⊘   │
│                                           │
│  ╭─────────────────────────────────────╮  │
│  │   Tout s'est passé comme prévu      │  │
│  ╰─────────────────────────────────────╯  │
╰──────────────────────────────────────────╯
```

- **Portée : 2 jours glissants maximum.** Au-delà, la bande disparaît d'elle-même.
  Un parent absent une semaine ne doit pas retrouver quinze lignes en retard : ce
  serait exactement la dette qu'on s'interdit (D8).
- **« Tout s'est passé comme prévu »** confirme tout d'un coup. C'est le chemin
  nominal, et il coûte **un tap pour deux jours**. C'est ce bouton qui rend le
  système viable.
- Ton : « il vous restait deux repas », jamais « 2 repas non renseignés ».
- La bande n'apparaît que si l'enfant a **au moins un repas confirmé** dans les 7
  jours : inutile de harceler quelqu'un qui n'a jamais commencé à noter.

### 4.5 « Ma semaine » — la grille dit le réel

La grille de `week-planner.tsx` gagne un vocabulaire visuel de statut, sans rien
ajouter d'autre :

| Statut               | Rendu de la case                                                |
| -------------------- | --------------------------------------------------------------- |
| À venir              | inchangé                                                        |
| Passé, `servi`       | pastille de résultat, comme aujourd'hui                         |
| Passé, `remplace`    | pastille + les aliments **réels** affichés, aucun signe négatif |
| Passé, `saute`       | case grisée, aliments barrés, mention « pas donné »             |
| Passé, `prevu`       | contour pointillé + « ? » discret → tap = feuille §4.3          |
| Futur, marqué absent | case grisée, « pas là »                                         |

Et l'anticipation, symétrique du rattrapage : sur une case **future**, la feuille
propose en tête **« On ne sera pas là »**, applicable au repas ou à la journée
entière. Le plan se décale avant même que le problème existe.

### 4.6 Le retour au parent — la transparence

Après chaque signal qui modifie le plan, un bandeau court, non modal, non
anxiogène, à l'endroit où le geste a été fait :

> **C'est noté.** Le brocoli sera reproposé demain, et le reste de la semaine
> décale d'un jour.

Et dans le briefing hebdomadaire (`week-briefing.tsx`, déjà en place), une ligne
supplémentaire : « Cette semaine, le programme s'est adapté 3 fois. » — factuel,
valorisant, jamais comptable.

### 4.7 Ce qu'on ne fait **pas**

- Aucun « taux de suivi du programme », aucun pourcentage, aucun graphique
  d'assiduité. Ce serait un compteur de culpabilité déguisé.
- Aucune notification push de rappel dans cette version.
- Aucune demande de **raison** (« pourquoi n'a-t-il pas mangé ? »). On ne la
  saurait pas quoi en faire, et c'est un champ de plus.
- Aucun blocage : tout enregistrement du réel est accepté, toujours.

---

## 5. Les règles de rattrapage

Le cœur métier. Objectif : **revenir au plan idéal au plus vite, sans jamais violer
une règle de sécurité**. Chaque règle est une fonction pure, testable, dans
`src/lib/program/`.

| #       | Situation                                             | Règle                                                                                                                                                                        | Justification                                                                                                                                                                                               |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1**  | Découverte prévue non donnée (`saute` / `remplace`)   | L'aliment **n'entre pas** dans les connus : il redevient la prochaine découverte, à sa place dans `intro_order`.                                                             | Le plan n'a rien perdu, il a juste attendu.                                                                                                                                                                 |
| **R2**  | Nouvel aliment donné **hors programme**               | Il entre dans les connus, et sa **répétition J+1 est programmée demain**, en priorité sur la découverte prévue, qui décale d'un jour.                                        | Règle des 2 jours d'affilée du guide — c'est la demande explicite du cadrage.                                                                                                                               |
| **R3**  | Deux nouveautés le même jour                          | Acceptées. La **prochaine découverte est repoussée d'un jour** (refroidissement), et les deux sont marquées co-suspectes en cas d'effet observé.                             | On ne réprimande pas, on protège l'imputabilité d'une réaction.                                                                                                                                             |
| **R4**  | Repas sauté sans remplacement                         | Aucune conséquence, sauf R1/R6 pour ce qu'il portait. La journée n'est pas « rattrapée » ailleurs.                                                                           | Un repas de moins n'est pas un problème nutritionnel à cet âge.                                                                                                                                             |
| **R5**  | Aliment **refusé** (`result = refuse`)                | **Le plan ne bouge pas.** L'aliment compte comme exposition et est **reproposé le lendemain**, comme n'importe quelle découverte. Aucun report, aucune pénalité de rotation. | L'acceptation demande 8 à 10 expositions : c'est la répétition qui la construit. Reporter ferait du refus un cas particulier — et une punition implicite — là où il est le comportement normal de l'enfant. |
| **R6**  | Allergène J1 (test) non confirmé                      | L'exposition **n'est pas comptée**. Reproposé une fois, à la première occasion compatible avec sa fenêtre. Ensuite : le plan avance, statut « à confirmer ».                 | Asymétrie de confiance (§3), avec garde-fou anti-boucle.                                                                                                                                                    |
| **R7**  | Allergène J1 confirmé, **J2 (montée) non fait**       | On reprend à la **dose de montée**, pas au test, dans les 3 jours.                                                                                                           | Le protocole n'est pas à refaire depuis le début ; le seuil déjà toléré est acquis.                                                                                                                         |
| **R8**  | Allergène vecteur donné hors programme (œuf, yaourt…) | Déclenche le protocole : compté comme J1, **montée programmée demain**, et l'allergène sort de la file d'attente.                                                            | Sinon le programme le reproposerait en « première fois » plus tard, à tort.                                                                                                                                 |
| **R9**  | Aliment donné hors âge ou sous restriction (miel…)    | Enregistré. Message factuel non bloquant + renvoi vers le médecin si la restriction est sanitaire.                                                                           | Enregistrer la réalité prime ; l'app informe, elle ne juge pas.                                                                                                                                             |
| **R10** | Ordre d'introduction non respecté                     | Accepté sans réserve. L'aliment sort de la file, le reste continue.                                                                                                          | `intro_order` est une préférence pédagogique, pas une règle de sécurité.                                                                                                                                    |
| **R11** | Interruption ≥ 7 jours sans aucun solide confirmé     | La **rampe d'ancienneté est gelée** pendant l'interruption (`tenureDays` -= jours d'arrêt) ; le plafond d'âge, lui, continue. Reprise annoncée.                              | Un enfant qui n'a rien mangé de solide en trois semaines n'est pas à J40 d'expérience — mais le fer et la fenêtre allergènes, eux, n'attendent pas (`schedule.ts`).                                         |
| **R12** | Absence déclarée à l'avance                           | Les repas concernés passent `saute` avant l'heure ; le plan est recalculé immédiatement, la liste de courses aussi.                                                          | Le meilleur signal est celui donné en avance.                                                                                                                                                               |

### Précision sur R5 — le refus ne crée aucune exception

Un refus **n'allonge pas** non plus la paire de deux jours : si l'aliment est refusé
les deux jours, il repart en rotation ordinaire, sans marquage ni pénalité. La
rotation étant pilotée par le nombre d'usages (`byLeastUsed` dans `plan.ts`), il
reviendra de lui-même sous quelques jours — c'est le mécanisme qui produit
naturellement les 8 à 10 expositions, sans qu'aucune règle spécifique au refus
n'ait à exister.

Conséquence heureuse : **un refus ne déclenche aucune replanification**. La note
🙅 reste ce qu'elle est aujourd'hui — un signal d'appréciation — et le moteur n'a
besoin d'aucune notion de report (§7.2). Le seul effet du refus est **rédactionnel** :
la vignette de retour affiche « Un refus, c'est normal — on le repropose demain.
Il faut souvent huit à dix essais avant qu'un goût soit accepté. »

### Règle transverse : on ne réécrit jamais le passé, ni aujourd'hui

La replanification part **de demain**. Aujourd'hui est intouchable : le parent a
peut-être déjà acheté, cuisiné, ou lu la fiche. Seule exception, à sa main : la
substitution §4.2, qu'il déclenche lui-même.

---

## 6. Modèle de données

Quatre colonnes, aucune table nouvelle. Le choix d'étendre `meals` plutôt que de
créer un couple `planned_meals` / `logged_meals` est délibéré : toute l'app (grille,
courses, stats, briefing, `MealWithDetails`) lit une seule table, et la dupliquer
coûterait une refonte transverse pour un bénéfice de pureté.

```sql
-- migrations/0017_meal_reality.sql

alter table public.meals
  -- Ce qui s'est réellement passé. 'prevu' = aucun signal (défaut).
  add column if not exists status text not null default 'prevu'
    check (status in ('prevu', 'servi', 'remplace', 'saute')),
  -- Horodatage du signal : sert au « depuis quand est-ce en attente ».
  add column if not exists logged_at timestamptz,
  -- Un repas composé ou corrigé par le parent n'est jamais réécrit par le moteur.
  add column if not exists locked boolean not null default false,
  -- Ce que le programme avait prévu, avant correction. Sert l'affichage
  -- « prévu → réel » et le message de rattrapage. Volontairement dénormalisé :
  -- une trace d'affichage, pas une source de vérité.
  add column if not exists planned_food_ids uuid[];

alter table public.meal_items
  add column if not exists source text not null default 'programme'
    check (source in ('programme', 'parent')),
  -- Granularité fine : « la purée oui, la cuillère d'œuf non ». Utilisée
  -- uniquement pour les items porteurs d'allergène (§4.1, protocole).
  add column if not exists skipped boolean not null default false;

create index if not exists meals_baby_status_date_idx
  on public.meals (baby_id, status, date);
```

**Invariants** :

- `result` non nul ⟹ `status` ∈ {`servi`, `remplace`} — géré par l'action serveur,
  pas par une contrainte, pour ne pas casser les données existantes.
- `saute` ⟹ les `meal_items` sont **conservés** (c'est le prévu, utile à
  l'affichage), mais ignorés par tous les calculs d'exposition.
- Migration des données existantes : tout repas passé portant un `result` devient
  `servi` ; le reste reste `prevu`. Aucun repas n'est perdu.

### Ce que ça change dans les lectures existantes

| Endroit                                    | Changement                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `getFoodStats` (`food-stats.ts`)           | Exclure `status = 'saute'` et les items `skipped` du décompte d'expositions.                               |
| `program.actions.ts` / `alreadyIntroduced` | Idem, et **exclure les allergènes** des repas non confirmés (§3).                                          |
| `shopping.ts` / liste de courses           | Ne plus agréger les repas `saute`. Les cases cochées sont indexées par aliment et semaine : rien à migrer. |
| `week-briefing.ts`                         | Nouvelle ligne « le programme s'est adapté N fois ».                                                       |
| `getIntroductionCounts`                    | Idem `getFoodStats`.                                                                                       |

---

## 7. Le moteur de replanification

### 7.1 Ce qui est déjà là, et qu'on garde

`buildPlan` (`src/lib/program/plan.ts`) est une **fonction pure**, déterministe,
qui reconstruit tout le plan à partir d'un état de départ. C'est exactement ce
qu'il faut : replanifier, c'est **relancer `buildPlan` depuis demain avec un état
de départ enrichi du réel**. Aucune logique incrémentale à écrire, aucun risque de
dérive entre deux chemins de code.

Le travail consiste à lui donner ce qu'il ignore encore.

### 7.2 Les entrées à ajouter à `buildPlan`

```ts
/** Ce que la vraie vie impose au plan. Toutes les entrées sont facultatives. */
export type PlanReality = {
  /** Découverte de la veille encore à répéter aujourd'hui (R2, règle des 2 jours). */
  repeatToday?: string | null;
  /** Allergène dont la dose de montée reste à servir (R7). */
  pendingAllergen?: { allergenId: string; foodId: string } | null;
  /** Créneaux fixés par le parent — jamais réécrits, mais pris en compte (R12). */
  locked?: { date: string; momentId: string; foodIds: string[] }[];
  /** Jours d'interruption à retrancher de l'ancienneté (R11). */
  interruptionDays?: number;
};
```

Impacts internes, tous locaux :

- `pendingRepeat` et `pendingAllergen` sont **initialisés** depuis `reality` au lieu
  de démarrer à `null` — c'est le raccord entre l'histoire réelle et la suite du plan.
- `tenureDaysAt(...)` est diminué de `interruptionDays`.
- Les créneaux `locked` ne sont pas composés, mais leurs aliments alimentent
  `introduced` et `usage` (sinon la rotation se répéterait).

### 7.3 L'écriture : diff plutôt que « delete + insert »

`generateProgram` efface aujourd'hui toute la période avant de réinsérer. Sur une
replanification, c'est inacceptable : cela détruirait les repas verrouillés, ferait
clignoter la grille et changerait des jours identiques pour rien.

```
replanFrom(babyId, fromISO)
  ├─ 1. lire le réel  (statuts, items, résultats, observations, absences)
  ├─ 2. dériver l'état de départ + PlanReality      → lib/program/reality.ts (pur)
  ├─ 3. buildPlan(from = demain, to = 1er anniversaire)
  ├─ 4. diff avec l'existant, par (date, moment) :
  │       · verrouillé          → intact
  │       · composition égale   → intact (ligne non touchée)
  │       · composition changée → update des meal_items seuls
  │       · absent d'un côté    → insert / delete
  └─ 5. renvoyer un PlanDiff → phrase de retour au parent (§4.6)
```

```ts
export type PlanDiff = {
  changedDays: number;
  /** « le brocoli sera reproposé demain » */
  repeatedFood?: string;
  /** Nombre de jours dont les découvertes ont glissé. */
  shiftedDays: number;
  /** Allergènes remis en file. */
  requeuedAllergens: string[];
};
```

La mise en phrase vit dans un module pur (`lib/program/diff.ts`), testable, à
l'image de `stage.ts` pour le briefing.

### 7.4 Quand replanifier

Seulement quand le réel **change le plan**. Une note « adoré » sur un repas conforme
ne déclenche rien.

| Signal                                    | Replanification |
| ----------------------------------------- | --------------- |
| 😋 / 😐 / 🙅 sur un repas conforme        | non (R5)        |
| ⊘ pas donné                               | oui             |
| ⟳ mangé autre chose                       | oui             |
| Substitution « je n'ai pas ça »           | oui             |
| Absence déclarée à l'avance               | oui             |
| Confirmation groupée « tout comme prévu » | non             |

### 7.5 Coût et périmètre de recalcul

Une replanification complète jusqu'au premier anniversaire, c'est ~700 repas
réécrits — ce que `generateProgram` fait déjà à l'inscription, en une requête
acceptable. Avec le diff (§7.3), l'écriture réelle se limite en pratique à quelques
dizaines de lignes. Deux garde-fous :

- Recalcul **synchrone** dans l'action serveur (le parent voit le résultat tout de
  suite), suivi de `revalidatePath("/", "layout")` comme partout ailleurs.
- Si la mesure montre un problème, la parade est connue : réduire l'**horizon écrit
  en base** à 6 semaines glissantes et calculer le long terme à la volée avec
  `preview.ts`, déjà capable de le faire sans base. À trancher sur mesure, pas
  a priori.

---

## 8. Découpage en lots

Chaque lot est livrable seul et visible.

| Lot   | Contenu                                                                                                                             | Résultat visible                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **1** | Migration `0017` + statuts en lecture (stats, courses, `alreadyIntroduced`) + `⊘ Pas donné` en 1 tap + rendu grille                 | Le parent peut dire « pas donné ». Rien ne bouge encore dans le plan. |
| **2** | `PlanReality` + `reality.ts` + `replanFrom` avec diff + phrase de retour (R1, R2, R4)                                               | **Le programme se répare tout seul.** C'est le cœur.                  |
| **3** | Feuille « il a mangé autre chose » (§4.3) + bande de rattrapage 2 jours + « tout comme prévu » + message de refus (R3, R5, R9, R10) | Le rattrapage devient un réflexe de 2 secondes.                       |
| **4** | Piste allergènes : confirmation, R6, R7, R8, statut « à confirmer » dans Découvertes                                                | Le suivi de sécurité cesse de mentir.                                 |
| **5** | Substitution « je n'ai pas ça » (§4.2) + absences déclarées à l'avance (R12)                                                        | L'app anticipe au lieu de constater.                                  |
| **6** | Interruption longue et gel de l'ancienneté (R11) + reprise en douceur                                                               | Le retour de vacances ne casse plus le programme.                     |

Ordre délibéré : le lot 2 doit précéder les lots d'UI. Un geste de correction qui
ne change rien au plan serait pire que pas de geste du tout — le parent ferait le
travail pour rien et cesserait de le faire.

### État : les six lots sont implémentés

Où vit quoi, pour qui reprend le sujet :

| Pièce                          | Fichier                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Schéma                         | `supabase/migrations/0017_meal_reality.sql`, consolidé dans `supabase/reset.sql`  |
| Vocabulaire des statuts        | `src/lib/data/meals.types.ts` (`isConfirmed`, `countsAsExposure`, `awaitsSignal`) |
| Dérivation du réel (pure)      | `src/lib/program/reality.ts`                                                      |
| Raccord au générateur          | `src/lib/program/plan.ts` (entrée `reality`)                                      |
| Diff et mise en phrase (pures) | `src/lib/program/diff.ts`                                                         |
| Remplaçants (pure)             | `src/lib/program/substitute.ts`                                                   |
| Génération et replanification  | `src/lib/data/program.actions.ts` (`generateProgram`, `replanFrom`)               |
| Actions du réel                | `src/lib/data/meal-reality.actions.ts`                                            |
| Feuille de correction          | `src/components/meal-reality-sheet.tsx`                                           |
| Bande de rattrapage            | `src/components/catch-up-strip.tsx`                                               |
| Confirmation d'exposition      | `src/components/allergen-exposure-banner.tsx`                                     |
| Composition et « Remplacer »   | `src/components/meal-composition.tsx`                                             |

Deux écarts assumés par rapport au texte ci-dessus, tous deux dans le sens de la
prudence :

1. **La montée d'allergène due « aujourd'hui » tombe demain.** La
   replanification s'interdisant de réécrire le jour même (décision C), un
   vecteur donné hors programme la veille voit sa dose cible programmée le
   lendemain — soit dans la fenêtre de trois jours que R7 autorise.
2. **Un aliment porteur d'une dose prescrite n'est pas substituable.** Échanger
   l'œuf du protocole contre autre chose casserait le palier sans que le parent
   puisse le savoir : « Remplacer » n'apparaît pas sur ces lignes-là.

---

## 9. Risques et points de vigilance

1. **La liste de courses qui bouge après les courses.** Le cadrage accepte le
   principe (« tant pis »), mais il faut le rendre visible : dans _Ma semaine_,
   signaler les aliments ajoutés depuis le dernier passage plutôt que de laisser
   le parent découvrir un manque devant sa casserole. À traiter au lot 5.
2. **Le parent qui corrige tout, tout le temps.** Si l'app se met à décaler le plan
   à chaque geste, l'enfant ne découvre plus rien. Garde-fou : le décalage des
   découvertes est plafonné — au-delà de 3 reports consécutifs du même aliment, le
   programme passe au suivant et le range en rotation.
3. **Deux aidants qui saisissent en même temps** (co-parent, nounou). La
   replanification n'est pas commutative. Parade minimale : `logged_at` fait foi,
   dernier signal gagnant, et la replanification repart toujours de l'état complet
   en base — deux saisies concurrentes convergent donc vers le même plan.
4. **Le statut `remplace` n'est pas un jugement.** Vigilance rédactionnelle
   permanente : jamais « écart », « non respecté », « manqué ». Le vocabulaire du
   produit est « ce qu'il a mangé », point.
5. **Hypothèses non testées.** Comme tout `ux-redesign.md`, ce document est une
   proposition. Les deux points à confronter à de vrais parents en priorité : le
   bouton « Tout s'est passé comme prévu » (est-il utilisé ? ment-il ?) et la
   fenêtre de 2 jours de la bande de rattrapage.

---

## 10. Décisions actées (2026-08-06)

| #   | Décision                                                                                                        | Alternative écartée                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Asymétrie de confiance** : repas non renseigné = présumé fait pour le goût, non confirmé pour les allergènes. | Tout présumer fait (dangereux) ; tout demander (insupportable).                                                                                           |
| B   | **Statut sur `meals`**, pas de table de journal séparée.                                                        | `planned_meals` + `logged_meals` : plus pur, refonte transverse.                                                                                          |
| C   | **Replanification depuis demain**, jamais du jour même ni du passé.                                             | Replanifier le jour même : casse ce qui est déjà acheté/cuisiné.                                                                                          |
| D   | **Bande de rattrapage limitée à 2 jours**, avec confirmation groupée.                                           | Backlog complet : crée exactement la dette que D8 interdit.                                                                                               |
| E   | **Replanification complète** jusqu'au premier anniversaire, à chaque signal structurant.                        | Horizon glissant de 6 semaines : à faire seulement si la mesure l'impose.                                                                                 |
| F   | **Aucune raison demandée** au parent pour un repas non donné.                                                   | Un menu de motifs : coût de saisie sans usage aval.                                                                                                       |
| G   | **Un aliment refusé est reproposé le lendemain**, sans exception (R5 amendée).                                  | Report de 3 à 5 jours : faisait du refus un cas particulier, alors qu'il est le comportement normal — et c'est la répétition qui construit l'acceptation. |
