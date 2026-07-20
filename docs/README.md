# 🍼 Baby Food Tracker — Documentation

Application web d'aide à l'alimentation d'un bébé en cours de diversification :
**planifier** les repas, **suivre** ce qui est mangé, **retenir** les aliments et
allergènes introduits et les réactions — utilisable par **tous les aidants** (parents,
grands-parents, nounou…) sur **mobile et PC**, données **centralisées et synchronisées**.

> ⚠️ Outil d'**organisation**, **pas un avis médical**. Contenu à faire valider par un
> professionnel de santé avant tout usage réel.

## 📚 Les documents

| Document | Rôle | À lire quand… |
|---|---|---|
| [`functional-spec.md`](./functional-spec.md) | **Spec fonctionnelle & backlog** : ce que fait l'app, pour qui, périmètre priorisé (MVP/V1/V2+), modèle de données, décisions actées. | On veut comprendre **quoi** on construit et **pourquoi**. |
| [`technical-direction.md`](./technical-direction.md) | **Décisions techniques** : stack, auth, méthode de travail, direction artistique. | On veut comprendre **comment** c'est construit. |
| [`diversification-guide.md`](./diversification-guide.md) | **Référentiel métier** : calendrier de diversification par âge, allergènes, préparation, restrictions. Source du catalogue d'aliments. | On travaille sur le **contenu métier** (aliments, allergènes, âges). |
| [`roadmap.md`](./roadmap.md) | **Feuille de route** : traduction de la spec en itérations de construction concrètes, avec un résultat visible à chaque étape. | On veut savoir **dans quel ordre** on construit. |

## 🧭 Où en est-on ?

- ✅ Phase **docs-first** : cadrage fonctionnel et technique posé.
- ⏭️ Prochaine étape : **construction**, en suivant la [roadmap](./roadmap.md).

## 🛠️ Stack en bref

Next.js · TypeScript · Tailwind · shadcn/ui · Supabase (PostgreSQL + Auth + temps réel) ·
déploiement Vercel.

## 🤝 Méthode

**Docs-first** (on décide à l'écrit avant de coder) puis **itératif** : on construit par
petits pas, on regarde le résultat tourner, on ajuste. Les documents ci-dessus sont
**vivants** — on les met à jour au fil des décisions.
