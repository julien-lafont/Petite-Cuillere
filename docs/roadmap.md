# Feuille de route (roadmap)

> Traduction de la [spec fonctionnelle](./functional-spec.md) en **itérations de
> construction concrètes**. Principe : à **chaque itération, un résultat visible et
> testable**. On avance dans l'ordre, on regarde tourner, on ajuste.
>
> Ce document est **vivant** : on coche et on affine au fur et à mesure.

Dernière mise à jour : 2026-07-20

---

## Vue d'ensemble

| # | Itération | Livre surtout | Statut |
|---|---|---|---|
| 0 | Fondations techniques | Coquille de l'app + design system | ✅ Fait |
| 1 | Écrans clés en maquette | Mobile « Aujourd'hui/Demain » + PC « Semaine » | ✅ Fait |
| 2 | Supabase & socle données | Connexion réelle + données persistées | ✅ Fait |
| 3 | Catalogue & diversification | « Que peut manger bébé ? » + fiches aliments | ✅ Fait |
| 4 | Planification & journal | Menus de la semaine + noter les repas | ✅ Fait |
| 5 | Liste de courses | Courses de la semaine | ✅ Fait |
| 6 | Suivi des allergènes | Allergènes par repas + effets + page récap | ✅ Fait |
| 7 | Diversification avancée | Historique d'acceptation par aliment | ⬜ À faire |
| 8 | Statistiques (PC) | Graphiques de suivi | ⬜ À faire |
| 9 | Finitions & mise en ligne | PWA, déploiement, invitations, mode sombre | ⬜ À faire |

Cap **MVP** : itérations 0 → 4 (voir + planifier + noter les repas, avec vraies données).
Cap **V1** : itérations 5 → 8. Cap **V2+** : itération 9 et au-delà.

---

## Itération 0 — Fondations techniques
**Objectif** : voir tout de suite une app qui tourne, belle, même vide.
- Créer le projet **Next.js + TypeScript + Tailwind + shadcn/ui**.
- Poser le **design system** : palette (verts/pêche/crème), typographie, arrondis, espacements.
- **Coquille responsive/adaptative** : navigation mobile (barre en bas) vs PC (barre latérale).
- **Résultat visible** : l'app s'ouvre dans le navigateur, avec une page d'accueil soignée.

## Itération 1 — Écrans clés en maquette (données factices)
**Objectif** : valider l'ergonomie des écrans phares avant de brancher la base.
- 📱 Vue mobile **« Aujourd'hui / Demain »** (repas prévus, résultat à noter).
- 💻 Vue PC **calendrier de la semaine**.
- Fiche **bébé** (prénom, dates, âge / âge corrigé).
- **Résultat visible** : on navigue dans les vraies écrans avec des données de démo.

## Itération 2 — Supabase & socle données
**Objectif** : passer des données factices aux vraies données partagées.
- Création du compte **Supabase** (guidée pas à pas).
- **Schéma** : `household`, `user`, `baby`, `meal_moment`, `meal`, `meal_item`,
  `food`, `allergen` (+ règles d'accès / RLS).
- **Auth par lien magique** + rattachement à l'espace partagé.
- **Résultat visible** : je me connecte pour de vrai, je crée le profil bébé, ça persiste.

## Itération 3 — Catalogue & diversification
**Objectif** : donner du contenu métier et la fonction « intelligente » phare.
- **Seed** du catalogue d'aliments et des allergènes depuis
  [`diversification-guide.md`](./diversification-guide.md).
- **« Que peut manger bébé maintenant ? »** piloté par l'âge (et l'**âge corrigé**).
- **Fiche aliment** : catégorie, âge d'introduction, conseil de préparation, restrictions.
- **Résultat visible** : la liste des aliments adaptés à l'âge de mon bébé, avec conseils.

## Itération 4 — Planification & journal des repas *(fin du MVP)*
**Objectif** : le cœur du quotidien.
- Configurer/éditer les **menus de la semaine** ; **moments de repas personnalisables**.
- **Génération assistée** d'un menu de semaine adapté à l'âge, ajustable.
- **Noter un repas** (adoré / moyen / refusé) + note libre.
- **Résultat visible** : je planifie ma semaine et je note ce que bébé a mangé.

## Itération 5 — Liste de courses
**Objectif** : le réflexe « avant les courses ».
- **Agrégation** des ingrédients des repas planifiés de la semaine.
- Cocher les articles achetés.
- **Résultat visible** : ma liste de courses de la semaine sur le téléphone.

## Itération 6 — Suivi des allergènes ⚠️
**Objectif** : la sécurité, pilier V1.
- Définir les **allergènes par repas** (`meal_allergen`).
- Saisir les **effets indésirables** après une prise (`intake_observation`).
- **Page récapitulative dédiée** : introduits / à introduire, expositions, effets.
- Rappel « en cas de doute, consultez un professionnel ».
- **Résultat visible** : un tableau de bord clair du suivi des allergènes.

## Itération 7 — Diversification avancée
**Objectif** : la mémoire fine des aliments.
- **Historique par aliment** : nombre d'expositions, synthèse d'acceptation
  (depuis le début / 3 dernières fois).
- Aliments **déjà testés** vs **à découvrir**.
- **Résultat visible** : pour chaque aliment, « testé 4×, bien accepté récemment ».

## Itération 8 — Statistiques (vue PC)
**Objectif** : le recul.
- **Recharts** : répartition des aliments / catégories sur une période.
- **Résultat visible** : des graphiques de suivi sur grand écran.

## Itération 9 — Finitions & mise en ligne
**Objectif** : un vrai produit accessible partout.
- **Invitations** d'aidants (illimité).
- **PWA** (installable, hors-ligne), **mode sombre**.
- **Déploiement Vercel** → une **vraie URL** à ouvrir sur le téléphone.
- **Résultat visible** : l'app installée sur mon mobile, partagée avec les autres aidants.

---

## Notes de méthode
- On peut **réordonner** selon l'envie (ex. déployer en ligne plus tôt pour tester sur mobile).
- Chaque itération se termine par une **démo** (je lance l'app) et un point d'ajustement.
- On met à jour les statuts (⬜ → 🔄 en cours → ✅ fait) dans le tableau ci-dessus.
