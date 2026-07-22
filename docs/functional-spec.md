# Spécification fonctionnelle & Backlog

> Document **vivant** décrivant ce que fait l'application, pour qui, et dans quel
> ordre on le construit. On l'enrichit ensemble avant de coder.
>
> Légende priorités : **[MVP]** = version minimale · **[V1]** = souhaité rapidement ·
> **[V2+]** = plus tard · **[?]** = à discuter.

Dernière mise à jour : 2026-07-20

---

## 1. Vision

Aider **toutes les personnes qui s'occupent** d'un bébé en cours de diversification
alimentaire à **planifier, suivre et retenir** ce que mange l'enfant : quoi préparer
chaque jour, quoi acheter, quels aliments et allergènes ont été introduits, et comment
bébé a réagi.

Objectif ressenti : _« Le matin je sais quoi préparer ; en faisant les courses je
sais quoi acheter ; et je garde une trace fiable de ce que bébé a déjà goûté. »_

## 2. Utilisateurs & contextes d'usage

- **Aidant·e** : toute personne qui s'occupe de bébé — père, mère, grand-parent,
  nounou, etc. **Nombre illimité**, **aucune hiérarchie** : tous ont les mêmes droits
  et voient les mêmes données. Chacun peut indiquer sa **relation** à l'enfant (libellé
  descriptif, sans effet sur les droits).
- **Bébé** : sujet du suivi. **Un seul bébé** dans l'interface au départ, mais le
  modèle de données est conçu pour en accueillir **plusieurs** plus tard (décidé).

Contextes :

| Contexte                 | Appareil  | Besoins prioritaires                                            |
| ------------------------ | --------- | --------------------------------------------------------------- |
| Le matin / en journée    | 📱 Mobile | Que mange bébé aujourd'hui / demain ? Noter ce qui a été mangé. |
| Avant les courses        | 📱 Mobile | Liste des ingrédients à acheter pour la semaine.                |
| Le week-end, préparation | 💻 PC     | Configurer les menus de la semaine, vue calendrier globale.     |
| Recul / bilan            | 💻 PC     | Statistiques, aliments découverts, réactions.                   |

## 3. Périmètre fonctionnel

### 3.1 Planification des repas

- **[MVP]** Voir les repas prévus **aujourd'hui** et **demain** (vue mobile).
- **[MVP]** Vue **calendrier de la semaine** (vue mobile et PC).
- **[V1]** Configurer/éditer les menus d'une semaine (quel aliment, quel moment).
- **[V1]** **Génération assistée** : l'app **propose** un menu de semaine adapté à
  l'âge de bébé (à partir du référentiel), que le parent **ajuste** ensuite.
- **[V1]** **Moments de repas personnalisables** par foyer (par défaut :
  petit-déjeuner, déjeuner, goûter, dîner ; renommables/ajout/retrait).
- **[V2+]** Modèles de semaine réutilisables / duplication d'une semaine.
- **[V2+]** **Programme de diversification automatique** (remplissage longue durée) :
  l'utilisateur choisit le **jour de démarrage** de la diversification et la **durée**
  de génération (défaut : **6 prochains mois**) ; en fonction de l'**âge projeté** qui
  évolue dans le temps, des **recommandations** (`diversification-guide.md`) et des
  **moments de repas**, l'app organise un **roulement intelligent** parmi tous les
  aliments disponibles (introduction progressive, variété, respect des fenêtres d'âge
  et des allergènes). Extension longue durée du générateur de semaine.
  → **Conception détaillée validée** : `docs/auto-diversification-program.md`.

### 3.2 Suivi / journal des repas

- **[MVP]** Noter le résultat d'un repas via une **échelle simple** : bien mangé /
  moyen / refusé (décidé).
- **[V1]** Ajouter une **note libre** sur un repas.
- **[V2+]** Photo du repas / de l'assiette.

### 3.3 Liste de courses

- **[MVP]** Générer la **liste des ingrédients** à acheter pour la semaine à partir
  des menus planifiés.
- **[V1]** Cocher les articles achetés.
- **[V2+]** Regrouper par catégorie / rayon, gérer les quantités.

### 3.4 Diversification (découverte des aliments)

> S'appuie sur le référentiel `docs/diversification-guide.md` (calendrier par âge,
> allergènes, préparation).

- **[V1]** **« Que peut manger bébé maintenant ? »** : à partir de la date de
  naissance, l'app filtre/suggère les aliments adaptés à l'âge (âge d'introduction).
- **[V1]** Enregistrer un **nouvel aliment introduit** : date du 1er essai.
- **[V1]** Noter la **réaction** : aimé / mitigé / refusé / réaction allergique.
- **[V1]** **Historique par aliment** : combien de fois il a été proposé, et une
  **synthèse d'acceptation** — a-t-il été bien accepté **depuis le début** et **sur les
  3 dernières fois** ? (calculée à partir des repas notés).
- **[V1]** Liste des aliments **déjà testés** vs **à découvrir** (adaptés à l'âge).
- **[V1]** **Vigilance / restrictions** : signaler ce qui est déconseillé selon l'âge
  (ex. miel avant 12 mois, poissons à limiter, pas de sel/sucre).

### 3.5 Suivi des allergènes ⚠️

> Sujet de **sécurité** : on veut savoir précisément quels allergènes ont été
> introduits, quand, combien de fois, et si des effets indésirables ont suivi.
> S'appuie sur `docs/diversification-guide.md` (fenêtres d'introduction).

- **[V1]** Définir, **pour chaque repas**, la liste des **allergènes** présents — en
  plus des aliments (ex. une épice, du lactose, de l'œuf, du gluten).
- **[V1]** Pour chaque allergène : **date du 1er essai**, **nombre d'expositions**,
  et **historique** des prises.
- **[V1]** Après chaque prise, pouvoir **associer des effets indésirables** observés
  (type, sévérité, délai d'apparition, note).
- **[V1]** **Page récapitulative dédiée** : tableau de bord des allergènes (introduits
  / à introduire, nombre d'expositions, effets observés), pour un suivi d'un coup d'œil.
- **[V1]** S'appuyer sur les **fenêtres d'introduction recommandées** (introduction
  précoce et progressive : arachide, gluten, œuf, poisson…).

### 3.6 Aide à la préparation des repas

- **[V1]** Pour chaque aliment : un **conseil de préparation en texte libre** —
  comment le préparer au mieux (texture selon l'âge, cuisson, astuces, conservation).
- **[V1]** Quantité indicative de départ.
- **[V2+]** Idées d'associations d'aliments adaptées à l'âge.

### 3.7 Statistiques (vue PC)

- **[V1]** Répartition des aliments / catégories sur une période.
- **[V2+]** Diversité alimentaire, aliments favoris, tendances.

### 3.8 Compte, aidants & profil bébé

- **[MVP]** Connexion par lien magique (email).
- **[MVP]** Un **espace partagé** rassemblant tous les aidants autour du/des bébé(s).
- **[V1]** **Inviter** de nouveaux aidants (nombre illimité), renseigner leur relation
  à l'enfant. Tous ont les mêmes droits.
- **[MVP]** Profil bébé : prénom, **date de naissance réelle**.
- **[MVP]** **Date de terme théorique** → calcul de l'**âge corrigé** en cas de
  prématurité. L'âge corrigé est utilisé pour piloter la diversification lorsque la
  naissance a eu lieu **≥ 4 semaines** avant le terme.

### 3.9 Transverse

- **[MVP]** Interface responsive + adaptative (mobile/PC).
- **[V2+]** PWA (installable, hors-ligne).
- **[V2+]** Notifications / rappels.
- **[V2+]** Mode sombre.

## 4. Modèle de données (esquisse)

> Esquisse à valider — c'est la traduction des fonctionnalités en structures de
> données. On l'affinera avant de créer la base.

- **household** (espace partagé) — `id`, `nom`, date de création. Rassemble les
  aidants et le(s) bébé(s).
- **user** (aidant·e) — `id`, email, `household_id`, `relation` (père/mère/
  grand-parent/nounou/autre — descriptif). **Nombre illimité par espace, mêmes droits.**
- **baby** (bébé) — `id`, `household_id`, prénom, `date_naissance` (réelle),
  `date_terme_théorique`. L'**âge corrigé** se calcule à partir de ces deux dates
  (appliqué si prématurité ≥ 4 semaines). _(Table dédiée → prêt pour plusieurs enfants.)_
- **food** (aliment) — catalogue **commun pré-rempli** (issu de
  `docs/diversification-guide.md`), enrichissable par le foyer :
  `id`, nom, `catégorie`, `âge_introduction_min` (mois), `est_allergène` (bool),
  `type_allergène`, `texture_recommandée`, `conseils_préparation`, `restrictions`
  (ex. « à éviter avant 12 mois »), `quantité_indicative`,
  `household_id` (null = aliment du catalogue commun).
- **meal_moment** (moment de repas) — `id`, `household_id`, `libellé`, `ordre`.
  Créés par défaut (petit-déj/déjeuner/goûter/dîner) mais **personnalisables** par foyer.
- **allergen** (allergène) — catalogue **pré-rempli** (issu du référentiel) +
  ajouts : `id`, nom, `type`, `fenêtre_introduction` (âge reco), `note`, `household_id`
  (null = commun). Ex. : gluten, œuf, arachide, lactose, poisson, fruits à coque, épices.
- **meal** (repas planifié) — `id`, `baby_id`, date, `meal_moment_id`,
  `résultat` (bien mangé / moyen / refusé / non renseigné), `note`.
- **meal_item** (aliment d'un repas) — `meal_id`, `food_id`.
- **meal_allergen** (allergène d'un repas) — `meal_id`, `allergen_id`. Permet de
  tracer les allergènes introduits repas par repas, indépendamment des aliments.
- **intake_observation** (effet indésirable observé) — `id`, `meal_id`,
  `allergen_id` ou `food_id` (optionnel, ce qui est suspecté), `type_effet`,
  `sévérité`, `délai_apparition`, `note`, horodatage.
- **food_introduction** (synthèse par aliment) — `baby_id`, `food_id`, `date_1er_essai`,
  aimé (bool). Le **nombre d'expositions** et la **synthèse d'acceptation**
  (début / 3 dernières fois) sont **calculés** depuis l'historique des repas.
- **allergen_introduction** (synthèse par allergène) — `baby_id`, `allergen_id`,
  `date_1er_essai`, nombre d'expositions et effets **calculés** depuis l'historique.

Décisions actées :

- **Catalogue commun pré-rempli** (fondé sur le référentiel), + ajouts par foyer.
- **Repas lié à un bébé** (`baby_id`) → compatible multi-enfants plus tard.
- Résultat du repas = **échelle simple** (pas de champ quantité libre).
- Un repas = **liste d'ingrédients simples** (pas de notion de recette en MVP/V1).

## 5. Hors périmètre (pour l'instant)

- Conseils médicaux / nutritionnels prescriptifs.
- Partage public / réseau social.
- Gestion de plusieurs foyers par utilisateur.

## 6. Décisions actées

1. ✅ **Un seul bébé** dans l'UI, mais modèle **extensible** à plusieurs.
2. ✅ **Catalogue d'aliments pré-rempli** (référentiel de diversification) + ajouts.
3. ✅ **Échelle simple** pour le repas mangé : bien mangé / moyen / refusé.
4. ✅ **Ingrédients simples** d'abord ; notion de **recette** repoussée en V2.
5. ✅ **Suivi des allergènes** et **aide à la préparation** intégrés au périmètre V1.

## 7. Autres décisions actées

6. ✅ **Planification assistée** : l'app propose un menu de semaine adapté à l'âge,
   ajustable ensuite (générateur en V1).
7. ✅ **Moments de repas personnalisables** par foyer (valeurs par défaut fournies).
8. ✅ **Liste de courses** : agrégation simple des ingrédients de la semaine.
9. ✅ **Préparation** : conseil en **texte libre** par aliment.
10. ✅ **Aidants illimités**, sans hiérarchie ; relation à l'enfant purement descriptive.
11. ✅ Profil bébé avec **date de naissance réelle + date de terme** → **âge corrigé**
    (appliqué si prématurité ≥ 4 semaines).
12. ✅ **Historique d'acceptation par aliment** : nombre d'expositions + synthèse
    (depuis le début / 3 dernières fois), calculés depuis les repas.
13. ✅ **Allergènes définis par repas**, avec suivi des expositions, **effets
    indésirables** par prise, et **page récapitulative dédiée** (V1).

## 8. Questions encore ouvertes (plus tard)

- Gestion d'un **stock maison** pour affiner la liste de courses (V2+).
- **Champs structurés** de préparation (texture/cuisson) si le texte libre montre ses
  limites (V2+).
- Règles précises du **générateur de menus** (variété, rotation, équilibre) — à
  détailler au moment de le construire.
