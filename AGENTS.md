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
spaces. Never substitute ASCII lookalikes.

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

# Every dynamic route has its `loading.tsx`

**Never add a dynamically rendered route without writing its `loading.tsx` next
to the `page.tsx`.**

Reason: Next **skips prefetching entirely** for a dynamic route that has no
`loading.tsx`. Clicking the link then does nothing visible until the full server
response — about a second here, the time for the proxy's `getUser()` plus the
page's own queries. With the file, the shell is prefetched, navigation starts
instantly, and the skeleton holds the space while the content streams in.

All our pages read from Supabase, so they are **all** dynamic. The left-hand
column of `next build` confirms it, `ƒ` marking on-demand routes — that is the
list of the ones that need a `loading.tsx`.

The skeleton reuses the page's frame (header, then blocks) from the shapes in
`src/components/skeletons.tsx`, so that real content arriving shifts nothing
under the parent's eyes. It does not have to match the page pixel for pixel.

On the navigation side, click acknowledgement is already in place: `NavPending`
(`src/components/nav-pending.tsx`), placed **inside** a `<Link>`, sets
`data-pending` there during navigation — hence the `has-[[data-pending]]`
variants that give the link its selected look the moment it is clicked. Every new
primary navigation link reuses it.

# Tap feedback is global, not per-component

The pressed state for everything tappable lives once in `src/app/globals.css`
(« Acquittement du toucher »), in the `base` layer. Do not re-add per-component
`active:` geometry — Tailwind v4 puts every `hover:` variant behind
`@media (hover: hover)`, so on touch the base layer is the only thing that fires.
A component that genuinely needs something else overrides it with a utility
(`active:scale-100`).
