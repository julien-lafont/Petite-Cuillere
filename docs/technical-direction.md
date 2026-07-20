# Direction technique

> Ce document fige les **décisions techniques** du projet. Il est vivant : on le
> complète au fur et à mesure. Chaque décision notée ici est considérée comme
> validée sauf remise en question explicite.

Dernière mise à jour : 2026-07-20

---

## 1. Vue d'ensemble

Application web de suivi de l'alimentation d'un bébé (journal des repas +
diversification alimentaire), utilisable par **les deux parents** sur **mobile et
PC**, avec des données **centralisées et synchronisées** en temps réel.

Principe directeur : **une seule application responsive et adaptative**, pas deux
apps distinctes. Toutes les fonctions restent accessibles partout, mais chaque
appareil met en avant les écrans adaptés à son usage :

- 📱 **Mobile** → consultation + action rapide (que mange bébé aujourd'hui/demain,
  liste de courses, noter un repas).
- 💻 **PC** → pilotage (calendrier global, configuration des menus de la semaine,
  statistiques).

## 2. Stack technique (décidé)

| Brique                   | Choix                  | Rôle                                               |
| ------------------------ | ---------------------- | -------------------------------------------------- |
| Framework front          | **Next.js** (React)    | Structure de l'app, rendu, routing                 |
| Langage                  | **TypeScript**         | Sécurité de typage, moins d'erreurs en itérant     |
| Style                    | **Tailwind CSS**       | Fondation de style (classes utilitaires)           |
| Composants UI            | **shadcn/ui**          | Composants élégants, accessibles, personnalisables |
| Icônes                   | **lucide**             | Jeu d'icônes cohérent                              |
| Graphiques               | **Recharts**           | Statistiques (vue PC)                              |
| Données + Auth + Synchro | **Supabase**           | PostgreSQL, connexion, temps réel                  |
| Hébergement front        | **Vercel**             | Déploiement gratuit, URL publique                  |
| Hébergement données      | **Supabase (hébergé)** | Base managée                                       |

## 3. Décisions transverses

- **Authentification** : lien magique par email (magic link), sans mot de passe.
  Simple et sûr pour un usage familial.
- **Multi-utilisateur** : un **espace partagé** (`household`) qui relie un **nombre
  illimité d'aidants** (parents, grands-parents, nounou…) aux mêmes données, sans
  hiérarchie de droits. (Détails dans la spec fonctionnelle / modèle de données.)
- **Synchronisation** : temps réel via Supabase (une saisie sur un appareil se
  reflète immédiatement sur les autres).
- **Progressive Web App (PWA)** : prévue en fin de parcours (installable sur
  mobile, usage hors-ligne). Pas prioritaire au démarrage.

## 4. Méthode de travail

- **Docs-first** : on décrit les décisions dans `docs/` avant de construire.
- **Itératif** : on avance par étapes, on regarde le résultat tourner, on ajuste.
- **Données factices d'abord** : on construit d'abord le visuel et les écrans avec
  des données de démonstration, puis on branche Supabase. Cela permet de voir un
  résultat rapidement sans être bloqué par la mise en place de comptes.

## 5. Direction artistique (à affiner)

Ambiance **chaleureuse et rassurante mais nette**, qualité « vraie solution SaaS » :

- Tons doux (verts / pêche / crème), coins arrondis, beaucoup d'espace.
- Typographie moderne et lisible.
- Mode sombre envisagé.

## 6. À décider plus tard

- Détails du modèle de données (voir spec fonctionnelle).
- Gestion fine des droits
- Hébergement des données / conformité RGPD (région Supabase, etc.).
- Stratégie de tests.
