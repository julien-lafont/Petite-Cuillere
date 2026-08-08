---
name: release
description: Ship Petite Cuillère to production — write the CHANGELOG section from the commits, clear the guardrails, tag and push main (Vercel deploys). Use when the user asks for a release, a deployment, a production push, or simply says "release".
---

# Release

`main` is production: Vercel deploys every push, with no staging and no CI. A
push is an immediate go-live, visible to parents who rely on the app. The full
process lives in `docs/release.md` (in French, like everything under `docs/`) —
this file says how to run it.

The mechanics are in `scripts/release.sh`. **Your only real job is writing the
CHANGELOG section**: the script does the rest, and refuses to publish a version
it cannot find in the file.

## Steps

### 1. See where things stand

```sh
./scripts/release.sh status
```

Prints the next version number and the commits since the last tag.

If the list is empty there is nothing to ship — say so and stop.

### 2. Understand what changed

Do not settle for commit subjects. Read the diffs of anything non-obvious
(`git show <sha>`): a subject says what was done, not what it changes for someone
opening the app.

### 3. Write the section

At the top of `CHANGELOG.md`, under the **exact** heading `## <version>` — the
script checks that shape.

Sections, in this order, keeping only those with content: **Added**, **Changed**,
**Fixed**, **Removed**, **Internal**.

The first four are written **from the parent's point of view**: what they could
not do before, what they can do now, or what annoyed them and no longer does. No
component names, no file names, no framework vocabulary.

> ✅ "Buttons finally respond to a tap on mobile. You ended up tapping twice, or
> assuming the app had frozen."
>
> ❌ "Added an `:active` state to the `base` layer in `globals.css`."

**Internal** collects refactors, debt and tooling, in the language of the code —
there, file names are welcome.

A commit line is not a changelog line: several commits often make one entry, and
a purely mechanical commit makes none.

**Write in English**, like the commit messages and every technical document
outside `docs/` (see `AGENTS.md`). Quoted UI strings stay in French, as they
appear on screen.

### 4. Publish

```sh
./scripts/release.sh publish
```

Guardrails (all blocking), then the CHANGELOG commit, an annotated tag, and a
push of both branch and tag.

**If a guardrail fails: fix the cause, do not work around it.** No `--no-verify`,
no editing the script to skip a step, no manual `git push`. If the fix falls
outside the scope of the release, stop and explain.

The build writes its log to `/tmp/petite-cuillere-build.log` on failure.

### 5. Hand back

State what was published and under which tag, then name the two things you cannot
do yourself:

- follow the deployment on Vercel (no CLI is installed in this repo);
- **open the site on a phone** and exercise what the release touched.

Never claim the release is live or working: you pushed a tag, that is all you
know. This machine's network sometimes blocks `petite-cuillere.fr` (Cloudflare
Gateway) and returns HTTP 200 with a block page — a `curl` proves nothing either
way.

## Guardrails on the process itself

- **Never release unless asked**, even if the work looks finished. This is a
  production deployment.
- **Never release from a branch other than `main`**; the script will refuse.
- If there are uncommitted changes, **ask** what to do with them rather than
  sweeping them in: they would go to production.
- If the release contains a Supabase migration (`supabase/`), flag it: the script
  does not run migrations, they must be applied first.
