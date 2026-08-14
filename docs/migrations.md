# Migrations Supabase

> Comment le schéma de la base change : une migration se crée en local, s'applique
> au staging, puis part en production au push sur `main`.
>
> Ce document décrit le geste. La configuration à faire une fois pour toutes est
> en fin de page.

Dernière mise à jour : 2026-08-14

---

## En un geste

```sh
npm run db:new -- meal_photo   # crée supabase/migrations/<horodatage>_meal_photo.sql
npm run db:push                # l'applique au staging, où l'app tourne en local
git push origin main           # Supabase l'applique à la production
```

```sh
npm run db:status              # ce que le staging a déjà appliqué
```

---

## Le principe

**Deux projets Supabase, un seul dossier de migrations.** Le **staging** est la base
que `.env.local` désigne : c'est là que l'app tourne en développement, et c'est le
projet auquel le CLI est lié. La **production** n'est jamais touchée à la main —
elle reçoit les migrations par l'intégration GitHub. Le même dossier alimente les
deux, dans cet ordre, ce qui fait du staging l'endroit où une migration se trompe
sans conséquence.

**`supabase/migrations/` est le seul chemin vers le schéma.** On ne colle plus de
SQL dans l'éditeur web : ce qui n'est pas dans le dépôt n'existe pas, et
`git log supabase/migrations` est l'historique exact de la production.

**C'est Supabase qui déploie, pas nous.** L'intégration GitHub du projet de
production surveille `main` : à chaque push, les migrations que la base ne connaît
pas encore sont appliquées. Il n'y a ni workflow GitHub Actions, ni secret à tenir,
ni script — la liste de ce qui est appliqué vit dans chaque base, dans
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

**Le préfixe est une clé, et deux fichiers ne peuvent pas la partager.** C'est lui
seul, jamais le nom du fichier, que Supabase inscrit dans
`supabase_migrations.schema_migrations` : deux `0029_` font une version pour la
base, et le second arrivé passe pour déjà appliqué — sans erreur, sans ligne de
journal, et avec une table absente que le code déployé, lui, suppose là. Le piège
se referme surtout quand deux branches vivent en parallèle, chacune numérotant à
partir du même dernier fichier vu.

Le garde-fou est `scripts/migrations.test.ts`, joué par `npm test` : il refuse un
préfixe en double. Quand il se déclenche, on **renomme le fichier** pour le
prochain numéro libre — au-dessus de tout ce qui est déjà appliqué, jamais dans un
trou — et on relance `npm run db:push`.

Le contenu se commente **en français**, comme les vingt-trois qui précèdent : une
migration dit pourquoi le produit a changé de forme.

### 2. L'écrire

Elle sera appliquée telle quelle en production, une seule fois, sans relecture du
résultat.

Il n'y a **pas de migration inverse** — le CLI Supabase n'en gère pas. Le retour
arrière d'une migration est une migration de plus.

### 3. L'appliquer au staging

```sh
npm run db:push
```

C'est l'étape normale du développement, pas un dépannage : la migration s'applique
au projet lié, donc à la base sur laquelle l'app tourne en local. On enchaîne
aussitôt sur le code qui en dépend, et on le voit fonctionner avant de committer.

Le CLI affiche la liste de ce qu'il va appliquer et demande confirmation. Comme il
ne joue que ce que la base ne connaît pas, la commande se relance sans dommage.

### 4. Pousser

```sh
git push origin main
```

Supabase prend la suite, sur la production cette fois. Le résultat se lit dans le
dashboard du projet de production, **Project Settings → Integrations → GitHub**. En
cas d'échec, la migration n'est pas appliquée à moitié : chaque fichier est joué
dans une transaction, et l'historique n'enregistre que ce qui a réussi. On corrige,
on repousse.

Le staging l'a déjà, la production ne l'a pas encore : les deux tables d'historique
sont indépendantes, et c'est le dépôt qui les fait converger. Une migration oubliée
dans un commit non poussé est donc une migration que le staging connaît seul — le
symptôme est une app qui marche en local et casse en ligne.

---

## L'outillage

| Commande                | Ce qu'elle fait                                             |
| ----------------------- | ----------------------------------------------------------- |
| `npm run db:status`     | l'état du dossier face à celui du staging, ne touche à rien |
| `npm run db:push`       | applique au staging ce qui lui manque                       |
| `npm run db:new -- <n>` | crée le prochain fichier de migration                       |

Ce sont des appels directs au CLI Supabase (`supabase migration list --linked`,
`db push --linked`, `migration new`), installé en dépendance de développement :
rien de maison à maintenir, et les messages d'erreur sont ceux de l'outil.

`--linked` désigne toujours le staging, puisque c'est lui qui est lié. Pour
interroger la production, il faut la viser explicitement :
`npx supabase migration list --db-url <chaîne de connexion du projet de production>`.

---

## Ce que ça ne couvre pas

- **`supabase/reset.sql`** reste un script à part, à coller à la main, et il dérive
  du schéma réel. Le remplacer par un `seed.sql` rejoué au-dessus des migrations
  est un chantier à lui seul (cf. `audit-technique.md`, C8).
- **Les types TypeScript** ne sont pas régénérés depuis le schéma : une colonne
  renommée ne fait pas encore échouer `tsc` (C7).
- **Les droits sur les nouvelles fonctions.** Le projet n'expose plus d'office ce
  qui naît dans `public` : une fonction destinée à l'API de données a besoin de son
  `grant execute on function … to anon, authenticated`, écrit dans la migration qui
  la crée. Sans lui, `supabase.rpc(…)` rend une erreur que la plupart des écrans
  affichent comme un résultat vide.
- **Les données** : le staging et la production n'ont ni le même contenu ni les
  mêmes comptes. Une migration qui suppose des données existantes doit se
  débrouiller des deux.
- **Le reste de `config.toml`** — API, Auth, seed — est ignoré par l'intégration.
  Seules les migrations partent (ainsi que les edge functions et les buckets
  déclarés, dont nous n'avons ni les uns ni les autres).
- **Les templates d'email** vivent dans le dashboard Supabase, hors du dépôt
  (cf. [`deploiement.md`](./deploiement.md)).

---

## À configurer une fois

### L'intégration GitHub

Sur le projet **de production**, pas celui de staging. Dans son dashboard :
**Project Settings → Integrations → GitHub → Authorize GitHub**, choisir le dépôt,
laisser le répertoire de travail à `.` (le dossier `supabase/` est à la racine),
puis **Enable integration**. Activer enfin **Deploy to production** en désignant
`main` comme branche de production.

L'intégration est disponible sur tous les plans ; seules les branches de
pré-visualisation demandent le plan Pro.

### Le CLI en local

```sh
supabase login          # une fois par machine, ouvre le navigateur
supabase link --project-ref <ref du staging>
```

La référence à utiliser est celle du staging, c'est-à-dire celle que contient déjà
`NEXT_PUBLIC_SUPABASE_URL` dans `.env.local` (`https://<ref>.supabase.co`) : le CLI
et l'app visent ainsi la même base. Le lien s'écrit dans `supabase/.temp/`, qui
n'est pas versionné — chaque machine le fait une fois. Les commandes `db:*` passent
par ce lien et demandent au besoin le mot de passe de la base, donc aucun secret
n'est stocké dans le dépôt.

### L'historique des bases

Les vingt-trois migrations existantes ont été appliquées à la main dans l'éditeur
SQL, qui n'en tient pas registre : la table d'historique est vide, et les outils
croiraient avoir tout à faire. L'adoption se fait **par base**, une fois chacune,
avant le premier push d'une migration :

```sh
npx supabase migration repair --linked --status applied            # le staging
npx supabase migration repair --db-url <production> --status applied
```

La commande demande confirmation, puis inscrit les fichiers présents comme déjà
appliqués, **sans en rejouer un seul**. `npm run db:status` le confirme pour le
staging : la colonne **Remote** se remplit. Après quoi le sujet est clos — seules
les migrations suivantes partent.
