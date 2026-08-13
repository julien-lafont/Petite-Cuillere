<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Which language goes where

**English** — the technical shell:

- commit messages and `CHANGELOG.md`;
- every technical markdown file outside `docs/` — this file, `README.md`, skill
  definitions, the READMEs that sit next to code;
- tooling scripts (`scripts/`), **including their comments and their console
  output**;
- **every identifier in the source**: file names, variables, functions, types,
  fields, enum members, CSS classes, database columns. `resolveFood`, never
  `resoudreAliment`.

**French** — the product:

- everything a parent can read: UI copy, emails, error messages;
- every document under `docs/`;
- comments in the application source (`src/`), which explain the reasoning behind
  the product and stay in the language that reasoning was done in;
- **string literals that a model or a person reads as prose** — system prompts,
  LLM tool names and their descriptions, `aria-label`s. They are copy, not code,
  even when they sit inside a TypeScript object.

Rationale: the two audiences are different. `docs/` and `src/` are where the
product is thought through, in the language it is designed in. Everything around
them — how you build it, ship it, and read its history — is the part a newcomer,
a tool, or a future agent reaches first, and English is the common ground there.
The dividing line is not "code vs prose" but "product vs plumbing": that is why
`scripts/release.sh` is English while a comment in `globals.css` is French.

Identifiers sit on the plumbing side of that line, and the split runs _inside_
a single file: a function named in English, its comment in French, and the
sentence it returns in French. The reason is mechanical rather than aesthetic —
tooling, stack traces, autocomplete and every library we call are English, so a
French identifier is the only word in its own call site that has to be
translated before it can be read. URL segments are the exception that proves
the rule: `/aujourdhui` and `/api/voix` are addresses the product owns, not
identifiers, and they stay French.

When writing French, keep the orthography correct — accents, `«` `»`, non-breaking
spaces. Never substitute ASCII lookalikes. In particular, a non-breaking space goes
before `:` — `l'appui : comment le programme est construit`, not
`l'appui: …` or `l'appui : …` with a regular space.

When that `:` sits inside JSX text spanning more than one source line, swapping the
character in place can silently reintroduce a **double** space — the same class of bug
as the `&nbsp;`/`&apos;` trap below, because SWC's per-line trimming strips only literal
ASCII spaces, never the non-breaking one, so an auto-inserted join space can stack on
top of it. Isolate the non-breaking space and colon in their own expression instead —
`{" : "}`, exactly as `page.tsx` (`Voice`, `Proof`) does — rather than leaving the
colon as plain text at the start of a wrapped line. Verify with `node`, requiring
`next/dist/build/swc`'s `transformSync` on the snippet, rather than guessing: `tsc` and
reading the JSX will not reveal a stray space.

# Comments carry the why, and stop there

**Do not narrate the code.** A comment exists to hold what the code cannot say:
the product decision behind a rule, the constraint that forbids the obvious
alternative, the bug that a strange line is working around. If the sentence you
are about to write can be deduced by reading the two lines below it, delete it.

Default to one or two lines. Explaining _what_ or _how_ is worth the space only
when the mechanism is genuinely hard — a compiler quirk, an ordering that looks
arbitrary, a query whose shape is dictated by an index. In that case the comment
earns its length by naming the trap, not by paraphrasing the statements.

```ts
// ✗ paraphrase — the code already says all of it
// Boucle sur les repas, filtre ceux du jour, puis les trie par heure
// croissante avant de retourner le tableau résultant.

// ✓ the reason, which the code cannot say
// Un lait seul n'est pas un repas : on ne le compte pas dans la journée.
```

The same restraint applies to what you leave behind while working: no comment
that describes the change rather than the code (`// nouveau`, `// remplace
l'ancien calcul`, `// fix du bug de tri`). That belongs in the commit message,
where it stays true — a comment about an edit is stale as soon as the next one
lands.

# JSX — never HTML entities in text

**Never write `&apos;`, `&nbsp;`, or any other HTML entity in JSX.** Write the
apostrophe as `'` and the non-breaking space as the U+00A0 character itself
(`«`+`non-breaking space`), exactly as everywhere else in the code.

Reason: Next's JSX compiler (SWC) **decodes entities before trimming edge
whitespace**, instead of the other way round. So as soon as a text contains an
entity _and_ spans several lines, the space that separated it from the
neighbouring expression disappears at render time:

```tsx
// ✗ rendered by SWC: « Mathismange peu à peu »
<p>
  À 13 mois, {prenom} mange peu à peu comme le reste de la famille&nbsp;: vous
  n&apos;avez plus besoin de nous.
</p>

// ✓ rendered: « Mathis mange peu à peu »
<p>
  À 13 mois, {prenom} mange peu à peu comme le reste de la famille : vous n'avez
  plus besoin de nous.
</p>
```

`tsc` and esbuild handle this correctly: the bug shows up neither when reading
the code nor at typecheck — only on screen.

Adding `{" "}` **fixes nothing**: Prettier removes it as soon as the line fits,
and the bug comes back. That is why `react/no-unescaped-entities` is configured
as `{ forbid: [">", "}"] }` in `eslint.config.mjs` — the literal apostrophe is
deliberate, not an oversight.

To check after the fact, compare the strings emitted by both compilers: any
edge-whitespace difference between `tsc` and Next's SWC (`next/dist/build/swc`)
is an occurrence of this bug.

# A dynamic route reached by a `<Link>` needs a loading shell

**Never add a route that is both rendered on demand and reachable from an in-app
`<Link>` without a loading shell covering it.**

Reason: Next **skips prefetching entirely** for a dynamic route with no
`loading.tsx` above it. Clicking the link then does nothing visible until the
full server response — about a second here, the time for the proxy's `getUser()`
plus the page's own queries. With the file, the shell is prefetched, navigation
starts instantly, and the skeleton holds the space while the content streams in.

There are two ways out, and the first one is usually better:

- **make the route static.** A page that only needs the common catalogue reads it
  through `createPublicClient()` (`src/lib/supabase/public.ts`) — `getPublicFoods`,
  `getPublicAllergens` — instead of the cookie-bound `createClient()`. It is then
  prerendered at build, served from the CDN and prefetched whole, and needs no
  skeleton at all. This is what all of `/decouvrir` does;
- **give it a loading shell.** For everything that genuinely needs the session,
  which is all of `(app)`.

Two things the predicate turns on, both easy to get wrong:

- **reached by a `<Link>`.** Prefetching only exists for in-app navigation. A
  route entered cold from outside — `/rejoindre/[token]`, opened from an
  invitation email — has no previous page to prefetch from, so a skeleton buys
  nothing. Its absence there is deliberate, and the file says so;
- **covered, not adjacent.** A `loading.tsx` applies to its segment _and every
  segment below it_. `/methode/allergenes` needs none of its own —
  `/methode/loading.tsx` already covers it. Put the file where the shell stops
  changing, not mechanically next to every `page.tsx`.

Dynamism propagates upward: a single `await cookies()`, or one call to a reader
in `src/lib/data/*.ts`, turns the whole route dynamic. A route can therefore
cross the line from a commit that never touched it — which is how `/decouvrir`
silently lost its prerendering, on the page every public call-to-action points
at. The left-hand column of `next build` is the ground truth, `ƒ` marking
on-demand routes; re-read it whenever a page gains a data call.

Note that automatic prefetching **runs in production only**. In `next dev` every
navigation goes to the server and the skeleton always shows, so the effect of
this rule cannot be judged locally — the build output can, which is why it is the
check named above.

The skeleton reuses the page's frame (header, then blocks) from the shapes in
`src/components/skeletons.tsx`, so that real content arriving shifts nothing
under the parent's eyes. It does not have to match the page pixel for pixel.

On the navigation side, click acknowledgement is already in place: `NavPending`
(`src/components/nav-pending.tsx`), placed **inside** a `<Link>`, sets
`data-pending` there during navigation — hence the `has-[[data-pending]]`
variants that give the link its selected look the moment it is clicked. Every new
primary navigation link reuses it.

# The schema changes through a migration file, never through SQL to paste

**Never hand out SQL for someone to run in the Supabase editor.** A schema change
is a new file in `supabase/migrations/`, created with `npm run db:new -- <name>`
and applied to staging with `npm run db:push` — which is where the app runs
locally, so the change can be seen working before it is committed.

Reason: Supabase's GitHub integration applies that folder to production on every
push to `main`, against the history table it keeps inside the database. SQL run
outside the folder is invisible to both — the schema and the repo drift apart
silently, and the next push reasons from a history that no longer describes the
database.

The process and its one-off setup are in [`docs/migrations.md`](docs/migrations.md).

Two consequences when writing one:

- **it must leave the deployed code running** — the migration goes out a minute
  before the build that needs it. Adding is safe; renaming or dropping takes two
  migrations and two releases;
- **there is no down migration** — the CLI has none. Going back is one more
  migration.

# Tap feedback is global, not per-component

The pressed state for everything tappable lives once in `src/app/globals.css`
(« Acquittement du toucher »), in the `base` layer. Do not re-add per-component
`active:` geometry — Tailwind v4 puts every `hover:` variant behind
`@media (hover: hover)`, so on touch the base layer is the only thing that fires.
A component that genuinely needs something else overrides it with a utility
(`active:scale-100`).
