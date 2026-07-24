# Programme de diversification automatique — conception

> Génération longue durée d'un calendrier de repas adapté à l'âge, avec roulement
> intelligent. Fondé sur `diversification-guide.md` (PNNS 4 2022 + ameli + Aiguelongue).
> Seuils **paramétrables/ajustables**.

Dernière mise à jour : 2026-07-21

---

## 1. Paramètres (saisis par l'utilisateur)

- **Date de démarrage** de la diversification.
- **Durée** de génération — défaut **6 mois**.

Déduits : moments de repas du foyer, **âge projeté** du bébé, catalogue disponible.

## 2. Principe : un âge projeté qui évolue

La génération se fait **jour par jour**. Pour chaque jour, on calcule l'**âge projeté du
bébé ce jour-là** (en mois, décimales possibles). Conséquences automatiques :

- de nouveaux **aliments se débloquent** quand leur `age_introduction_min` est atteint ;
- de nouveaux **créneaux de repas** s'ouvrent (voir §3) ;
- la **texture** conseillée évolue (voir §5).

## 3. Ouverture progressive des créneaux (rythme « progressif » validé)

| Âge projeté | Petit-déj | Déjeuner | Goûter | Dîner |
|---|---|---|---|---|
| < 4 mois | lait | lait | lait | lait |
| **≥ 4 mois** | lait | **1 légume** | lait | lait |
| **≥ 5,5 mois** | lait | **légume + protéine + fruit** (repas complet) | **fruit** | lait |
| **≥ 6 mois** | lait | + **féculent + MG** | fruit (+ laitage) | lait |
| **≥ 7 mois** | lait | complet | fruit (+ laitage) | **légume + féculent** |
| **≥ 12 mois** | **solide** (pain/laitage) | complet | fruit + laitage | complet |

- Les créneaux « lait » restent au lait (tétée/biberon), non générés en solide.
- Lait ≈ **500–750 mL/jour** dès 6 mois (indicatif, affiché mais non « planifié »).

## 4. Sélection des aliments (roulement intelligent)

- **1 seul aliment nouveau à la fois**, placé dans le **créneau ouvert le plus récent**.
- **Répétition systématique** : chaque nouvel aliment est servi **2 jours d'affilée**
  (introduction + 1 répétition) → les nouveautés arrivent tous les 2 jours.
- **Aliments déjà mangés** : ceux consommés **avant la date de démarrage** (repas
  antérieurs) sont considérés « déjà introduits » — non re-découverts, mais réutilisés
  dans le roulement.
- **Ordre de découverte** : suit le champ **`intro_order`** (guide Aiguelongue).
  Légumes : carotte → épinard → haricot vert → courgette → courge → potiron → blanc de
  poireau → brocoli → panais → petits pois ; légumes à goût fort/fibreux (chou, navet,
  fenouil) en dernier. Pomme de terre = liant (féculent, dès 6 mois). Fruits :
  pomme → poire → banane → jaunes → rouges. **Pas de fruit avant 5,5 mois.**
- **Rotation / variété** : les aliments « connus » tournent pour remplir les autres
  créneaux solides (on change de légume/fruit chaque jour).
- **Matière grasse** ajoutée aux repas salés dès qu'ils existent (huile colza/noix, beurre).

## 5. Allergènes majeurs

- Introduits **un nouveau tous les 3 jours**, isolément, pour surveiller une réaction.
- Uniquement quand un **créneau solide** est ouvert et la **fenêtre d'âge** atteinte.
- Ordre : selon le catalogue d'allergènes (œuf, lait, poisson, arachide, gluten…).
- Écrit un lien `meal_allergen` sur le repas concerné (traçabilité).

## 6. Textures selon l'âge projeté

- < 8 mois : **mixé/lisse** · 8–10 mois : **écrasé/mouliné** · ≥ 10 mois : **morceaux**.
- Annotation d'affichage (n'empêche pas la génération).

## 7. Sécurité (garde-fous)

- Respect de `age_introduction_min` et des `restrictions` (miel < 12 mois exclu…).
- Allergènes « jamais entier avant 3 ans » : jamais proposés sous forme à risque.
- Rappel visible « à valider avec un professionnel de santé ».

## 8. Écriture en base & ré-exécution

- Génère **uniquement à partir de la date de démarrage** (jamais le passé).
- **Régénération = écrase toute la période** (supprime puis recrée `meals` de la période
  pour ce bébé), choix validé.
- Écrit : `meals` + `meal_items` (+ `meal_allergens` les jours d'introduction) +
  `food_introductions` (date du 1er essai).

## 9. Moments de repas personnalisés

Le template suppose les 4 moments standard. Si le foyer a personnalisé ses moments,
mapping **par heuristique de nom** (petit-déj / déjeuner / goûter / dîner) ; les moments
non reconnus reçoivent une composition « repas solide » par défaut selon l'âge.

## 10. Ouvertures / à affiner plus tard

- Seuils d'âge éditables dans l'UI.
- Objectif « 10 expositions » plus rigoureux (suivi réel via `food_introductions`).
- Prise en compte des aliments **refusés** pour les reproposer autrement.
