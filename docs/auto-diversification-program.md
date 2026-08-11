# Programme de diversification automatique — conception

> Génération longue durée d'un calendrier de repas, piloté par **deux horloges**
> (âge et ancienneté de diversification) et complété par une **piste allergènes**
> indépendante. Seuils **paramétrables/ajustables**, tous regroupés dans
> `src/lib/program/schedule.ts` et `src/lib/program/allergens.ts`.

Dernière mise à jour : 2026-08-06

---

## 1. Paramètres

| Paramètre                           | Origine                       | Rôle                                            |
| ----------------------------------- | ----------------------------- | ----------------------------------------------- |
| `startISO`                          | onboarding / régénération     | premier jour **généré**                         |
| `babies.diversification_started_on` | onboarding (étape « depuis ») | premier **repas solide** → l'ancienneté         |
| `babies.atopic_risk`                | onboarding (étape allergènes) | eczéma sévère / allergie œuf → arachide bloquée |
| durée                               | jusqu'au 1ᵉʳ anniversaire     | horizon de génération                           |

`startISO` et `diversification_started_on` sont **deux dates distinctes**.
Régénérer un programme ne remet pas l'ancienneté à zéro.

## 2. Les deux horloges

Décaler un démarrage tardif « de trois mois » serait dangereux : trois choses
sont attachées à l'**âge civil**, pas à l'ancienneté.

- **Les morceaux.** ESPGHAN : textures grumeleuses à 8-10 mois au plus tard.
  Au-delà de 9-10 mois, la cohorte ALSPAC retrouve à 7 ans une consommation
  moindre de fruits et légumes et plus de troubles alimentaires ; ELFE retrouve
  l'effet sur le développement à 3 ans.
- **La fenêtre allergènes**, 4-12 mois : retarder ne protège pas.
- **Le fer** : réserves natales épuisées vers 6 mois, > 90 % des besoins doivent
  ensuite venir du solide.

D'où deux tables, et une **intersection** — une catégorie n'est ouverte que si
les deux l'ouvrent.

> **Catégorie de créneau ≠ catégorie de catalogue.** Le catalogue distingue les
> céréales, les légumineuses et les tubercules ; le générateur, lui, ne connaît
> que cinq créneaux, et les trois y comptent pour un seul « féculent »
> (`slotGroupOf`, `src/lib/categories.ts`). Sans ce repli, un déjeuner à six mois
> recevrait un riz, des lentilles **et** une pomme de terre. Les catégories sans
> créneau — matières grasses, purées d'oléagineux, condiments — ne sont jamais
> planifiées d'elles-mêmes.

### 2.1 Plafond d'âge (`AGE_RULES`)

| Moment    | Seuil    | Catégories                                       |
| --------- | -------- | ------------------------------------------------ |
| Déjeuner  | 4 mois   | légume                                           |
|           | 5,5 mois | + protéine, fruit                                |
|           | 6 mois   | + féculent                                       |
| Goûter    | 4,5 mois | fruit (plancher ; c'est l'ancienneté qui décide) |
|           | 6 mois   | + laitier                                        |
| Dîner     | 8,5 mois | légume, féculent                                 |
| Petit-déj | 12 mois  | féculent, laitier                                |

### 2.2 Rampe d'ancienneté (`TENURE_RULES`), en jours depuis le premier solide

| Moment    | Seuil | Catégories        | Raison                                   |
| --------- | ----- | ----------------- | ---------------------------------------- |
| Déjeuner  | J0    | légume            |                                          |
|           | J8    | + protéine        | plancher fer si l'enfant a déjà ≥ 6 mois |
|           | J15   | + féculent, fruit |                                          |
| Goûter    | J13   | fruit             | 7 légumes × 2 j = 14 j → 1ᵉʳ fruit à J15 |
|           | J22   | + laitier         |                                          |
| Dîner     | J36   | légume, féculent  |                                          |
| Petit-déj | J50   | féculent, laitier |                                          |

**Non-régression** : pour un démarrage à 4 mois, la table d'âge est partout la
plus contraignante — le comportement historique est conservé.

### 2.3 Texture et quantités

- `textureFor(âge, ancienneté)` : l'âge commande. L'ancienneté ne peut que
  retenir le **lisse**, et seulement les 10 premiers jours (`SMOOTH_TEXTURE_DAYS`).
- `portionRampFactor(ancienneté)` : montée « 2-3 c. à café → 50-60 g » sur les
  7 premiers jours, quel que soit l'âge de démarrage.

## 3. Piste découverte

- **1 nouveauté tous les 2 jours** : introduction + répétition le lendemain.
- **Alternance entre créneaux ouverts** — le goûter avance sur les fruits pendant
  que le midi avance sur les légumes. Exception : une catégorie qui vient de
  s'ouvrir et n'a encore aucun aliment passe en tête, sinon le créneau resterait
  vide.
- **Ordre** : `intro_order` du guide de l'Aiguelongue, suivi à la lettre.
  - Légumes, les 7 du guide : carotte → épinard → haricot vert → courgette →
    courge → potiron → blanc de poireau. Puis les ajouts : brocoli, panais,
    petits pois. Chou, navet et fenouil (goût fort) sont repoussés à ≥ 6 mois.
  - Fruits : pomme → poire → banane → jaunes (abricot, pêche) → rouges (fraise,
    framboise, myrtille).
- **Repli de créneau** : quand le répertoire d'une catégorie est encore trop
  mince, un aliment déjà servi le jour même peut être réutilisé — mieux vaut la
  même compote deux fois qu'un goûter annulé.
- Aliments consommés **avant** `startISO` → « déjà introduits », réutilisés dans
  le roulement mais pas re-découverts.
- **Matière grasse** ajoutée aux repas salés dès 6 mois.

## 4. Piste allergènes

Indépendante de la découverte : une cuillère de purée de sésame dans une compote
connue est une **dose**, pas une découverte gustative. Elle n'entame le rythme
des découvertes que si son support est un vrai aliment dont la catégorie est
ouverte (œuf, poisson, laitage, kiwi).

### 4.1 Catalogue — 16 allergènes, tous programmés

Ordonnés par force de la preuve, puis par fréquence chez l'enfant en France
(séries CICBAA). Fenêtres, doses et entretien vivent dans la table `allergens`.

| #     | Allergène                               | Fenêtre      | Entretien      | Note                                                   |
| ----- | --------------------------------------- | ------------ | -------------- | ------------------------------------------------------ |
| 1-3   | arachide, œuf, lait de vache            | **4-6 mois** | 2×/sem         | preuve d'essai randomisé (LEAP, PETIT)                 |
| 4-6   | gluten, poisson, sésame                 | 5-8 mois     | 2×/sem         |                                                        |
| 7-11  | noisette, amande, cajou, pistache, noix | 5-9 mois     | 2×/sem         | éclatés : la réactivité croisée n'est pas uniforme     |
| 12-13 | moutarde, soja                          | 6-10 mois    | 2×/sem · **0** | soja : trace seulement (ANSES, phyto-œstrogènes)       |
| 14-16 | fruits de mer, sarrasin, kiwi           | 8-12 mois    | 2×/sem         | fréquents en France, absents des listes anglo-saxonnes |

Chaque allergène est relié à ses aliments **vecteurs** par `foods.allergen_id`
(clé étrangère ; `allergen_type` ne sert plus qu'à l'affichage). Sans vecteur,
l'allergène n'est pas planifiable — et le programme le **dit** (`PlanNotice`).

### 4.2 Protocole en 3 doses

| Phase     | Quand          | Dose                              |
| --------- | -------------- | --------------------------------- |
| Test      | J1             | `starting_dose` — une pointe      |
| Montée    | J2             | `target_dose` — ≈ 2 g de protéine |
| Entretien | ensuite, à vie | `maintenance_per_week` (2)        |

La dose est écrite sur `meal_items.dose` et **prime sur la portion calculée** à
l'affichage : une pointe de cuillère de beurre de cacahuète n'est pas un repère
à ajuster selon l'appétit.

Fondement : analyses conjointes LEAP + EAT, reprises en France (Revue du
Praticien) — « 1 petite cuillère à café 4 fois par semaine, soit 2 g de protéine
d'arachide par semaine ». Un allergène introduit puis abandonné ne protège pas.

### 4.3 Planification à rebours

- Démarrage après `START_AFTER_TENURE_DAYS` (5 jours de solide).
- Pas nominal **3 jours** ; resserré à rebours de l'échéance
  `min(fin de fenêtre, 12 mois)` via `adaptiveGapDays`, **jamais sous 2 jours**
  (`MIN_GAP_DAYS`) — en deçà, une réaction ne serait plus imputable.
- Sous ce plancher, le programme **cesse de comprimer** et émet une
  `PlanNotice` « window-too-tight » plutôt que d'entasser les introductions.
- Jamais deux nouveaux allergènes le même jour.
- Entretien plafonné à `MAX_MAINTENANCE_PER_DAY` (2) doses par jour, et **un
  seul créneau pris par jour** — sinon deux protéines atterrissent dans le même
  repas, quand le guide n'en prévoit que 10 g. Ce qui est marqué `dose_only` au
  catalogue ne prend aucun créneau : une pointe de moutarde et une cuillère de
  purée de sésame peuvent tomber le même jour.
- Une dose portée par un vrai aliment **tient la place** de sa catégorie au lieu
  de s'y ajouter.
- Un additif n'est posé que sur un créneau qui a de quoi le délayer.

### 4.4 Sécurité

- `allergen_introductions.had_reaction` est **lu** : l'allergène et tous ses
  vecteurs sortent du programme, avec une notice explicite.
- `atopic_risk` + `requires_medical_advice` → arachide non planifiée (LEAP).
- Restrictions conservées : fruits à coque et arachide entiers < 3 ans, œuf peu
  cuit < 5 ans, miel < 12 mois.

### 4.5 Couverture vérifiée

| Démarrage   | Résultat                                                 |
| ----------- | -------------------------------------------------------- |
| 4 à 5 mois  | 16/16, **tous dans leur fenêtre**                        |
| 6 à 10 mois | 16/16 avant 12 mois (les fenêtres 4-6 sont déjà passées) |
| 11 mois     | 13/16 + notice d'orientation médicale                    |

## 5. Écriture en base & ré-exécution

- Génère **uniquement à partir de `startISO`** (jamais le passé).
- **Régénération = écrase la période** (supprime puis recrée les `meals`).
- Écrit : `meals` + `meal_items` (avec `dose`) + `meal_allergens` +
  `food_introductions` + `allergen_introductions` (première exposition prévue).

## 6. Moments de repas personnalisés

Mapping par heuristique de nom (`classifyMoment`). Les moments non reconnus
reçoivent le profil « autre » (légume + féculent dès 6 mois / J36).

## 7. Explication au parent

Deux surfaces, toutes deux alimentées par les **mêmes** seuils :

- `src/lib/program/stage.ts` → bandeau hebdomadaire « ce qui change cette semaine ».
- `/methode` et `/methode/allergenes` → les pages de méthode, sourcées, écrites
  pour un parent (cf. règles d'écriture en tête de `components/method-page.tsx`).

## 8. À affiner plus tard

- Seuils éditables dans l'UI.
- Objectif « 10 expositions » plus rigoureux (suivi réel via `food_introductions`).
- Prise en compte des aliments **refusés** pour les reproposer autrement.
- Ratio ⅓ féculent / ⅔ légumes chiffré dans les portions.
