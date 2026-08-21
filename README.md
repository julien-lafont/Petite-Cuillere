# 🍼 Petite Cuillère

Baby's first meals, without the guesswork. A web app for families going through
weaning: **plan** the meals, **log** what actually got eaten, and **keep track** of
which foods and allergens have been introduced — and how baby reacted.

Built for **everyone who feeds the baby** (parents, grandparents, childminders), on
**phone and desktop**, with a single shared, always-in-sync set of data.

🔗 **[petite-cuillere.fr](https://petite-cuillere.fr)**

## What it does

- **A whole program, from a birth date** — a few questions and the weeks ahead are
  laid out: which foods to introduce when, in what order, with the allergens
  spread through them. You see it before creating an account, on
  [`/decouvrir`](https://petite-cuillere.fr/decouvrir) — the account only keeps it
  from being lost.
- **Today** — the day as a thread. The meal whose hour is running is the one that
  is open, with what to cook, how to prepare it and roughly how much; a meal you
  have answered folds down to a single line, and the ones still ahead open when
  you want to cook in advance.
- **Say it instead of filling it in** — the microphone is in reach on every
  screen, and takes one ordinary French sentence: « Il a mangé des poireaux et de
  la pomme ce midi, il a adoré ». It turns it into the entries you would have made
  by hand, handles several things at once, and answers questions that have no
  screen of their own (« Quand est-ce qu'il teste l'arachide ? »). **Nothing is
  written without a tap** — what you dictate is a proposal. Typing the sentence
  does the same thing.
- **Meal log** — first whether the meal happened at all (done, skipped, menu
  changed), then, if you feel like it, a loved / so-so / refused face and a
  free-form note. A meal nobody reported is asked about later rather than lost.
- **Weekly planner** — lay out the week's meals, or let the app propose one that
  fits baby's age and adjust from there. A missing ingredient or a change of menu
  is a one-line correction, and the rest of the program follows.
- **Shopping list** — every ingredient the week needs, aggregated, tickable, and
  in the order you walk a shop rather than in the order of the alphabet.
- **Food discovery** — what baby can eat right now, what's already been tried, and
  how well each food has gone down over time.
- **Allergen tracking** — first exposure, how many times since, and any reaction
  observed, on a dashboard of its own.
- **Progression** — the step back: how the meals split by category, how the range
  of foods widened, which ones land best.
- **Shared household, and more than one child** — invite as many helpers as you
  like; everyone sees and edits the same data. A second child gets a program of
  their own, switched from the navigation.
- **The method, in the open** — two public pages explain how the program is built
  and how allergens are introduced, and are readable without an account.

## Stack

Next.js · TypeScript · Tailwind CSS · shadcn/ui · Supabase (PostgreSQL, auth,
realtime) · deployed on Vercel. The spoken path adds a transcription provider
(Gladia) and a language model, both behind an interface of their own.

## Getting started

You'll need a [Supabase](https://supabase.com) project — the app has no local
fallback for its data layer. Development runs against a **staging** project, kept
separate from production; both are fed by the same `supabase/migrations/`.

```bash
npm install
npm run dev
```

`.env.local` holds the configuration. Only the first two lines are needed to boot
the app:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# Understanding a sentence — the default model is gpt-5.6-terra. Point
# VOICE_MODEL at a claude-* or gemini-* id and the matching key applies
# (ANTHROPIC_API_KEY, GEMINI_API_KEY).
OPENAI_API_KEY=<key>

# Transcribing the voice. Without it the microphone answers « Le micro n'est
# pas disponible. Écrivez-le, c'est pareil. » — and the written path still works.
GLADIA_API_KEY=<key>
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

Other scripts: `npm run build`, `npm run lint`, `npm run format`, and `npm test`
for the rules that hold without any API key — meal hours, voice slot resolution,
and the invariants that check the application holds when a model sends the tool
calls a compromised one would. `npm run voice:eval` is the one that does need a
key: it replays a reference household through the real understanding path.

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
| [`feats/`](./docs/feats)                                      | **Feature design**, one document each — the observation, the UX, the business rules, the data model, the batches.       | You're preparing a feature **before building it**.        |
| [`release.md`](./docs/release.md)                             | **Release process** — guardrails, numbering, keeping the changelog, going back.                                         | You're **shipping to production**.                        |
| [`deploiement.md`](./docs/deploiement.md)                     | **Going live** — domain, Vercel, DNS, Supabase auth URLs, indexing.                                                     | You're deploying, or **moving to another domain**.        |
| [`migrations.md`](./docs/migrations.md)                       | **Database migrations** — writing one, trying it out, letting Supabase apply it to production on push; the setup.       | You're **changing the schema**.                           |
| [`audit-technique.md`](./docs/audit-technique.md)             | **Foundations & tech debt** — measured diagnosis, prioritised work (C1 → C20), sequencing and tracking indicators.      | You're deciding **what to shore up** before going faster. |

[`CHANGELOG.md`](./CHANGELOG.md) is the other way in: what changed, release by
release, written from the parent's point of view.

## How we work

**Docs first** — decisions get written down before they get built — then
**iteratively**: small steps, run it, look at it, adjust.

## License

[MIT](./LICENSE). The app tells parents what to feed a baby: the code that
decides it should be readable by anyone who wants to check it, and reusable by
anyone who wants to build on it.
