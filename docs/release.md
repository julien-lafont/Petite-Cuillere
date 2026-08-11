# Release & journal des versions

> Comment on met Petite Cuillère en production, et comment on tient le
> [`CHANGELOG.md`](../CHANGELOG.md).
>
> Ce document décrit le **geste**. Ce qu'il faut avoir configuré une fois pour
> toutes hors du code — Vercel, DNS, Supabase — vit dans
> [`deploiement.md`](./deploiement.md).

Dernière mise à jour : 2026-08-08

---

## En un geste

```sh
./scripts/release.sh status    # où on en est
./scripts/release.sh check     # les garde-fous, sans rien toucher
./scripts/release.sh publish   # garde-fous, commit du CHANGELOG, tag, push
```

Avec un agent : **`/release`**. Il fait la seule chose que le script ne sait pas
faire — écrire la section du CHANGELOG en lisant les commits — puis appelle
`publish`.

---

## Le principe

**`main` est la production.** Vercel déploie chaque push sur cette branche ; il
n'y a ni environnement de recette, ni CI, ni étape d'approbation. Un push est
donc une mise en ligne, immédiate et visible par les parents qui utilisent l'app.

Trois conséquences, qui expliquent tout le reste de ce document :

1. **Les garde-fous passent avant le push**, pas après — il n'y a personne
   d'autre pour les faire tourner.
2. **On tague ce qu'on déploie.** Sans tag, on ne sait pas dire ce qui est en
   ligne, ni de quand date une régression, ni quoi mettre dans le journal.
3. **Le CHANGELOG s'écrit au moment de la release**, jamais après coup : c'est le
   seul moment où l'on a encore en tête ce qui a changé et pourquoi.

## Le numéro de version

`2026.08.08.1` — la date, puis le rang dans la journée. La deuxième release du
même jour est `2026.08.08.2`. Le tag git est le numéro préfixé de `v`.

Pas de majeur/mineur/patch : le site est déployé en continu et n'expose aucune
API publique dont il faudrait annoncer les ruptures. Le numéro sert à répondre à
« c'était en ligne quand ? » — la date y répond directement.

Le rang est calculé à partir du **plus haut tag existant du jour**, pas du nombre
de tags : un tag supprimé ne fait donc jamais réattribuer un numéro déjà publié.

---

## Le déroulé

### 1. Le travail est commité sur `main`

Un ou plusieurs commits **en anglais**, au format conventionnel
(`fix(ux): …`, `feat(planning): …`). Rien de particulier à faire à ce stade : la
release n'est pas un commit de plus, c'est un point posé sur l'historique.

### 2. Écrire la section du CHANGELOG

```sh
./scripts/release.sh status
```

donne le numéro de la prochaine version et **la liste des commits depuis le
dernier tag**. C'est la matière première.

La section se rédige à la main, en tête de `CHANGELOG.md`, sous le titre exact
`## <version>` — le script refuse de publier une version qu'il n'y trouve pas.

**Le CHANGELOG s'écrit en anglais**, comme les messages de commit et comme tout
document technique hors `docs/` (la règle et sa raison sont dans `AGENTS.md`). Ce
document-ci reste en français : il est dans `docs/`, où l'on réfléchit le produit.
Les libellés d'interface cités gardent évidemment leur français d'écran.

Rubriques : **Added**, **Changed**, **Fixed**, **Removed**, **Internal**.

Les quatre premières se lisent **du point de vue du parent** : ce qu'il pouvait
faire avant, ce qu'il peut faire maintenant. Pas de nom de composant, pas de nom
de fichier, pas de vocabulaire de framework. « Buttons finally respond to a tap on
mobile » plutôt que « added an `:active` state to the base layer ».

« Internal » recueille le reste — refactorisations, dette, outillage — dans le
vocabulaire du code.

Une ligne de commit n'est pas une ligne de changelog. Plusieurs commits font
souvent une seule entrée ; un commit de pure mécanique n'en fait aucune.

### 3. Publier

```sh
./scripts/release.sh publish
```

Le script enchaîne, et s'arrête au premier échec :

| Garde-fou                          | Pourquoi                                                       |
| ---------------------------------- | -------------------------------------------------------------- |
| branche `main`                     | c'est elle que Vercel déploie                                  |
| arbre propre (hors `CHANGELOG.md`) | on tague un état reproductible, pas le contenu d'un éditeur    |
| à jour avec `origin/main`          | sinon le tag désigne un état qui n'a jamais existé en ligne    |
| au moins un commit depuis le tag   | rien à publier, rien à faire                                   |
| `prettier --check`                 | le format ne doit pas polluer le diff de la release suivante   |
| `tsc --noEmit`                     | Next ne typecheck pas tout au build                            |
| `npm run lint`                     | **bloquant** — voir ci-dessous                                 |
| `npm run build`                    | le seul moyen de savoir que Vercel ne se cassera pas la figure |

puis commite le CHANGELOG (`release: <version>`), pose le tag annoté, et pousse
la branche **et** le tag.

Vercel prend la suite tout seul.

### 4. Vérifier

Le script ne vérifie rien après le push, et c'est volontaire : il n'existe pas de
sonde fiable côté machine de développement — le réseau y bloque parfois le
domaine, et un `curl` qui échoue pour cette raison ferait passer une release
saine pour un échec.

À faire soi-même, une fois le déploiement Vercel au vert :

- ouvrir <https://petite-cuillere.fr> **sur un téléphone**, pas seulement au
  navigateur de bureau — l'app s'utilise debout, d'une main ;
- exercer ce que la release a touché.

En cas de casse, le retour arrière le plus court est le **rollback Vercel**
(Deployments → le déploiement précédent → _Promote to Production_) : instantané,
et il laisse le temps de corriger proprement plutôt que de pousser un correctif
dans l'urgence.

---

## Le lint est bloquant

Il l'est depuis le 2026-08-08, date à laquelle les quatre erreurs
`react-hooks` qui traînaient sur `main` ont été corrigées. C'était la condition
pour qu'il le devienne : un garde-fou qu'on contourne dès le premier jour
n'apprend qu'une chose, à le contourner.

Si l'une de ces vérifications devient un jour insupportable, **on la retire du
script** — explicitement, en connaissance de cause. On ne prend pas l'habitude de
passer outre.

---

## Ce que le process ne couvre pas

- **Les migrations Supabase** ne sont pas jouées par la release, et n'ont pas à
  l'être : l'intégration GitHub de Supabase les applique à la production dès que le
  fichier arrive sur `main`, donc avant que le build Vercel de la release ne soit
  en ligne. Le geste et sa configuration sont dans
  [`migrations.md`](./migrations.md).
- **Les variables d'environnement Next sont figées au build** : en changer une
  dans Vercel n'a aucun effet tant qu'on n'a pas redéployé
  (cf. [`deploiement.md`](./deploiement.md)).
- **Les templates d'email** vivent dans le dashboard Supabase, hors du dépôt.
