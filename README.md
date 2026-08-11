# 🍼 Petite Cuillère

Baby's first meals, without the guesswork. A web app for families going through
weaning: **plan** the meals, **log** what actually got eaten, and **keep track** of
which foods and allergens have been introduced — and how baby reacted.

Built for **everyone who feeds the baby** (parents, grandparents, childminders), on
**phone and desktop**, with a single shared, always-in-sync set of data.

🔗 **[petite-cuillere.fr](https://petite-cuillere.fr)**

## What it does

- **Today and tomorrow** — what to cook, how to prepare it, and roughly how much.
- **Weekly planner** — lay out the week's meals, or let the app propose one that
  fits baby's age and adjust from there.
- **Meal log** — a simple loved / so-so / refused scale, plus a free-form note.
- **Shopping list** — every ingredient the week needs, aggregated and tickable.
- **Food discovery** — what baby can eat right now, what's already been tried, and
  how well each food has gone down over time.
- **Allergen tracking** — first exposure, how many times since, and any reaction
  observed, on a dashboard of its own.
- **Shared household** — invite as many helpers as you like; everyone sees and
  edits the same data.

## Stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL, auth,
realtime) · deployed on Vercel.

## Getting started

You'll need a [Supabase](https://supabase.com) project — the app has no local
fallback for its data layer. Development runs against a **staging** project, kept
separate from production; both are fed by the same `supabase/migrations/`.

```bash
npm install
cp .env.local.example .env.local   # then fill in the two Supabase values
npm run dev
```

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Bring the staging schema up to date — the migrations create the tables and seed the
shared food and allergen catalogue:

```bash
supabase login && supabase link --project-ref <staging-ref>   # once per machine
npm run db:push
```

`npm run db:status` shows where staging stands and `npm run db:new -- <name>` starts
the next migration. Production needs none of this: Supabase's GitHub integration
applies migrations on its own once they land on `main` — the whole process is in
[`docs/migrations.md`](./docs/migrations.md). Then open
[http://localhost:3000](http://localhost:3000).

Sign-in is passwordless: a six-digit code by email, or Google. Both need a little
setup on the Supabase side — see [`docs/deploiement.md`](./docs/deploiement.md).

Other scripts: `npm run build`, `npm run lint`, `npm run format`.

## Documentation

The docs are written in French and live in [`docs/`](./docs). They're kept alive as
decisions are made, rather than written once and left to rot.

| Document                                                      | What it covers                                                                                                          | Read it when…                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`functional-spec.md`](./docs/functional-spec.md)             | **Spec & backlog** — what the app does, for whom, scope by priority (MVP/V1/V2+), data model, decisions taken.          | You need to know **what** we're building, and **why**.    |
| [`technical-direction.md`](./docs/technical-direction.md)     | **Technical decisions** — stack, auth, working method, art direction.                                                   | You need to know **how** it's put together.               |
| [`diversification-guide.md`](./docs/diversification-guide.md) | **Domain reference** — weaning timeline by age, allergens, preparation, restrictions. The source of the food catalogue. | You're working on the **domain content**.                 |
| [`ux-redesign.md`](./docs/ux-redesign.md)                     | **UX redesign** — user framing, what was wrong with the old flow, the new entry path, information architecture.         | You're working on **screens and experience**.             |
| [`roadmap.md`](./docs/roadmap.md)                             | **Roadmap** — the spec turned into build iterations, each one shipping something you can see.                           | You want to know **what order** things get built in.      |
| [`deploiement.md`](./docs/deploiement.md)                     | **Going live** — domain, Vercel, DNS, Supabase auth URLs, indexing.                                                     | You're deploying, or **moving to another domain**.        |
| [`migrations.md`](./docs/migrations.md)                       | **Database migrations** — writing one, trying it out, letting Supabase apply it to production on push; the setup.       | You're **changing the schema**.                           |
| [`audit-technique.md`](./docs/audit-technique.md)             | **Foundations & tech debt** — measured diagnosis, prioritised work (C1 → C20), sequencing and tracking indicators.      | You're deciding **what to shore up** before going faster. |

## How we work

**Docs first** — decisions get written down before they get built — then
**iteratively**: small steps, run it, look at it, adjust.
