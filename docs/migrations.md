# Migrations Supabase

> Comment le schéma de la base change : une migration se crée en local, se pousse
> sur `main`, et Supabase l'applique à la production.
>
> Ce document décrit le geste. La configuration à faire une fois pour toutes est
> en fin de page.

Dernière mise à jour : 2026-08-11

---

## En un geste

```sh
npm run db:new -- meal_photo   # crée supabase/migrations/<horodatage>_meal_photo.sql
npm run db:push                # l'applique au projet lié
git push origin main           # Supabase l'applique à la production
```

```sh
npm run db:status              # ce que la production a déjà appliqué
```

---

## Le principe

**`supabase/migrations/` est le seul chemin vers le schéma.** On ne colle plus de
SQL dans l'éditeur web : ce qui n'est pas dans le dépôt n'existe pas, et
`git log supabase/migrations` est l'historique exact de la production.

**C'est Supabase qui déploie, pas nous.** L'intégration GitHub du projet surveille
`main` : à chaque push, les migrations que la base ne connaît pas encore sont
appliquées. Il n'y a ni workflow GitHub Actions, ni secret à tenir, ni script — la
liste de ce qui est appliqué vit dans la base elle-même, dans
`supabase_migrations.schema_migrations`.

**Une migration part avec le commit, pas avec la release.** Elle est donc en place
avant que le build Vercel qui la suppose ne soit en ligne. Corollaire, et c'est la
seule contrainte réelle d'écriture : **une migration doit laisser tourner le code
déjà déployé**. Ajouter une colonne, une table, une valeur d'énumération : sans
risque. En renommer ou en supprimer une : deux migrations et deux releases —
d'abord ajouter et écrire dans les deux endroits, déployer, puis supprimer.

---

## Le déroulé

### 1. Créer le fichier

```sh
npm run db:new -- meal_photo
```

Le nom est un identifiant : anglais, `snake_case`, comme tout nom de fichier du
dépôt. Le CLI le préfixe d'un horodatage (`20260811083232_meal_photo.sql`) ; les
vingt-trois premières migrations sont numérotées `0001` à `0023`, format que le
CLI accepte tout aussi bien — les deux se trient dans le bon ordre, et il n'y a
rien à renommer.

Le contenu se commente **en français**, comme les vingt-trois qui précèdent : une
migration dit pourquoi le produit a changé de forme.

### 2. L'écrire

Elle sera appliquée telle quelle en production, une seule fois, sans relecture du
résultat.

Il n'y a **pas de migration inverse** — le CLI Supabase n'en gère pas. Le retour
arrière d'une migration est une migration de plus.

### 3. L'essayer

```sh
npm run db:push
```

La cible est le projet lié — faute de projet de recette, c'est la production. La
commande sert donc au dépannage ; le geste normal est le push. Le CLI affiche la
liste de ce qu'il va appliquer et demande confirmation.

### 4. Pousser

```sh
git push origin main
```

Supabase prend la suite. Le résultat se lit dans le dashboard, **Project Settings →
Integrations → GitHub**. En cas d'échec, la migration n'est pas appliquée à moitié :
chaque fichier est joué dans une transaction, et l'historique n'enregistre que ce
qui a réussi. On corrige, on repousse.

---

## L'outillage

| Commande                | Ce qu'elle fait                                              |
| ----------------------- | ------------------------------------------------------------ |
| `npm run db:status`     | l'état local face à celui de la production, ne touche à rien |
| `npm run db:push`       | applique au projet lié ce qui lui manque                     |
| `npm run db:new -- <n>` | crée le prochain fichier de migration                        |

Ce sont des appels directs au CLI Supabase (`supabase migration list --linked`,
`db push --linked`, `migration new`), installé en dépendance de développement :
rien de maison à maintenir, et les messages d'erreur sont ceux de l'outil.

---

## Ce que ça ne couvre pas

- **`supabase/reset.sql`** reste un script à part, à coller à la main, et il dérive
  du schéma réel. Le remplacer par un `seed.sql` rejoué au-dessus des migrations
  est un chantier à lui seul (cf. `audit-technique.md`, C8).
- **Les types TypeScript** ne sont pas régénérés depuis le schéma : une colonne
  renommée ne fait pas encore échouer `tsc` (C7).
- **Le reste de `config.toml`** — API, Auth, seed — est ignoré par l'intégration.
  Seules les migrations partent (ainsi que les edge functions et les buckets
  déclarés, dont nous n'avons ni les uns ni les autres).
- **Les templates d'email** vivent dans le dashboard Supabase, hors du dépôt
  (cf. [`deploiement.md`](./deploiement.md)).

---

## À configurer une fois

### L'intégration GitHub

Dans le dashboard : **Project Settings → Integrations → GitHub → Authorize
GitHub**, choisir le dépôt, laisser le répertoire de travail à `.` (le dossier
`supabase/` est à la racine), puis **Enable integration**. Activer enfin
**Deploy to production** en désignant `main` comme branche de production.

L'intégration est disponible sur tous les plans ; seules les branches de
pré-visualisation demandent le plan Pro.

### Le CLI en local

```sh
supabase login          # une fois par machine, ouvre le navigateur
supabase link --project-ref <ref>
```

La référence du projet est celle qui apparaît dans
`NEXT_PUBLIC_SUPABASE_URL` (`https://<ref>.supabase.co`). Le lien s'écrit dans
`supabase/.temp/`, qui n'est pas versionné : chaque machine le fait une fois. Les
commandes `db:*` passent par ce lien et demandent au besoin le mot de passe de la
base — il n'y a donc aucun secret à stocker dans le dépôt.

### L'historique de la base

Les vingt-trois migrations existantes ont été appliquées à la main dans l'éditeur
SQL, qui n'en tient pas registre : la table d'historique est donc vide, et les
outils croiraient avoir tout à faire. Une fois, avant le premier push d'une
migration :

```sh
npx supabase migration repair --linked --status applied
```

Elle demande confirmation, puis inscrit les fichiers présents comme déjà
appliqués, **sans en rejouer un seul**. `npm run db:status` le confirme : la
colonne **Remote** se remplit. Après quoi le sujet est clos — seules les migrations
suivantes partent.
