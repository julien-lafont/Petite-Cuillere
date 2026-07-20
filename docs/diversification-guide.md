# Référentiel de diversification alimentaire

> Base de connaissance « métier » qui alimentera le **catalogue d'aliments**, le
> **calendrier de diversification** (« que peut manger bébé à son âge ? ») et le
> **suivi des allergènes** de l'application.
>
> ⚠️ **Avertissement** : contenu à visée organisationnelle, **pas un avis médical**.
> Source principale : Cabinet de pédiatrie Aiguelongue
> (https://sites.google.com/site/cabinetpediatrieaiguelongue/alimentation).
> À faire valider par un professionnel de santé avant tout usage réel.

Dernière mise à jour : 2026-07-20

---

## 1. Calendrier d'introduction par âge

### 4–5 mois — Légumes
- **Commencer par** : carotte, puis épinards, haricots verts, courgettes (épépinées),
  courge, potiron, blanc de poireau.
- **À éviter au début** : chou, navet, salsifis, artichaut, fenouil, poivron, aubergine.
- **Quantité** : 2–3 cuillères à café → 50–60 g en une semaine.
- **Texture** : cuits et finement mixés.
- **Conseil** : un seul légume par jour, en changer tous les 2 jours.

### 5–5½ mois — Fruits & premières protéines
- **Fruits** : pomme, poire, banane, puis fruits jaunes (abricot, pêche), puis rouges
  (fraise, framboise, myrtille). Cuits, bien mixés, **sans sucre ajouté**.
  Mono-saveur jusqu'à 8–9 mois.
- **Protéines** (dès 5½ mois) : viande, poisson, œuf dur — **10 g** (2 c. à café),
  associées aux légumes/fruits.

### 5–6 mois — Laitages & premiers allergènes
- **Produits laitiers** : petits suisses dès 5 mois ; fromage blanc et yaourts à 6 mois.
  Préférer les « laitages-bébé » à base de lait 2e âge.
- **Arachide** (allergène) : entre 4 et 6 mois, via beurre de cacahuète (2 g au début),
  mélangé dans compote/yaourt. Progression : 10 g/semaine ou 5 g deux fois/semaine.
- **Gluten** (allergène) : dès 6 mois, progressivement — 1 petite c. à café de céréales
  avec gluten dans un biberon/jour, puis 2 c. à café vers 7 mois.

### 6 mois — Matières grasses & lait 2e âge
- **Passage au lait 2e âge** à l'introduction des protéines. Au moins ½ litre/jour.
- **Matières grasses** : 1 c. à café d'huile végétale crue (colza, noix, soja), ou
  noisette de beurre frais, ou 1 c. à café de crème fraîche.

### 8–9 mois — Féculents & céréales
- **Légumes secs** (lentilles, haricots secs, pois chiches) : uniquement **mixés**.
- **Céréales** : semoule vers 8 mois, puis riz et pâtes.
- **Biscuits bébé** : vers 8 mois, sous surveillance.

### 9 mois
- **Pain** : dès 9 mois.
- **Chocolat** : vers 9–10 mois.

### 12 mois et +
- **Lait de croissance** (contenant du DHA).
- **Légumes crus** : vers 12 mois. **Crudités** : entre 12 et 18 mois.
- **Œuf moins cuit** possible vers 1 an. **Fruits de mer** permis.

## 2. Allergènes — calendrier d'introduction

L'introduction **précoce et progressive** des allergènes est recommandée (fenêtre 4–6 mois
pour certains). À suivre attentivement dans l'app.

| Allergène | Fenêtre d'introduction | Modalités |
|---|---|---|
| Arachide (cacahuète) | 4–6 mois | Beurre de cacahuète, 2 g puis +10 g/sem |
| Gluten | dès 6 mois | Céréales avec gluten, très progressif |
| Œuf | dès 5½ mois (dur) | Bien cuit d'abord ; moins cuit vers 1 an |
| Poisson | dès 5½ mois | Voir espèces à limiter (§3) |
| Fruits à coque | à préciser | Sous forme adaptée (jamais entiers : risque de fausse route) |
| Produits laitiers | 5–6 mois | Laitages bébé |
| Fruits de mer | vers 12 mois | — |

> Principe applicatif : pour chaque allergène, l'app aide à **introduire tôt**, à
> **noter la date du 1er essai** et à **surveiller la réaction** sur les jours suivants.

## 3. Restrictions & vigilance

- **Miel** : interdit **avant 1 an** (risque de botulisme).
- **Pas de sel ajouté.**
- **Pas de sucre ajouté** dans les fruits.
- **Poissons à limiter** (métaux lourds) : thon, flétan, requin, espadon, marlin,
  lamproie, saumon.
- **Poissons bio-accumulateurs de PCB** (à éviter) : anguille, barbeau, brème, carpe, silure.

## 4. Préparation & conservation

- Fruits et légumes **cuits** au début, puis crus progressivement.
- Textures : **finement mixé** au début → écrasé/moulliné → morceaux fondants avec l'âge.
- Surgelés : qualité au moins équivalente au frais.
- **Bio recommandé** pour carotte et épinards (riches en nitrates).
- Un petit pot entamé se conserve **48 h au réfrigérateur** s'il n'y a pas eu de
  contact avec la salive.

## 5. Traduction en données (impact sur le catalogue)

Chaque aliment du catalogue portera idéalement :
- `catégorie` (légume / fruit / protéine / féculent / laitier / matière grasse / autre)
- `âge_introduction_min` (en mois)
- `est_allergène` (bool) + `type_allergène` éventuel
- `texture_recommandée` selon l'âge
- `conseils_préparation` (cuisson, astuces)
- `restrictions` / `à_éviter_avant` (ex. miel < 12 mois)
- `quantité_indicative` de départ
