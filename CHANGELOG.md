# Changelog

What changed in Petite Cuillère, release by release, newest first.

Each section maps to a **git tag** and a **production deployment**. The number is
the date followed by a rank: `2026.08.08.1` is the first release of 8 August
2026, `2026.08.08.2` the second. No major/minor/patch — the site ships
continuously and exposes no public API whose breaking changes would need
announcing; the date is what you actually look for when scanning back through the
log.

Sections: **Added**, **Changed**, **Fixed**, **Removed**, **Internal**. The first
four are written from the parent's point of view; **Internal** covers what never
shows on screen but is worth finding again.

This file is in English, like every technical document outside `docs/` — see
`AGENTS.md`. The process that produces these sections is described in
[`docs/release.md`](./docs/release.md) (in French, as everything under `docs/`).

---

## 2026.08.08.1

First tracked release. Earlier work is summarised at the end of this file.

### Fixed

- **Buttons finally respond to a tap on mobile.** Pressing one produced nothing
  visible — no colour change, no movement. You ended up tapping twice, or
  assuming the app had frozen. Everything tappable now presses down clearly under
  the finger.
- **The buttons that open a window were the most silent of all.** "Modifier",
  "Générer le programme" and "Ajouter un aliment" had no feedback whatsoever, as
  a side effect of the rule that set them apart from the others.
- **Meal dialogs opened on the previous meal's values** for one frame before
  correcting themselves.

### Internal

- The pressed state is declared once, in the `base` layer, for everything
  tappable: the hand-rolled tiles across some twenty components now respond like
  real buttons without having been touched.
- The three meal dialogs (`meal-plan`, `meal-log`, `meal-evaluate`) reloaded their
  form from an effect, i.e. after paint. They now adjust state during render.
  Along the way: a dead ref removed from `meal-log-dialog`, and meal-selection
  reading factored out into `src/lib/meal-selection.ts`.
- The repository has a changelog and a tooled release process
  (`docs/release.md`, `scripts/release.sh`), with guardrails that all block —
  hence the lint fixes above, which were the precondition.
- Four markdown files that had never been through Prettier now are, so that the
  formatting guardrail could block too.

---

## Before tracking

Reconstructed from git history. This work was never tagged at the time, so these
are milestones rather than releases.

### 2026-08-08

- Redesigned meal card and upcoming days on the "Today" screen.
- "One day at a time" planner view below large screens.
- "Morning market" art direction, page prefetching, and SEO-minded URLs.
- Fixed an overflowing bar and late reveals on mobile, on the public landing page.

### 2026-08-07

- Public "method" pages and landing page redesign.
- Real meal tracking, catch-up, food catalogue and cooking methods.

### 2026-08-06

- "How this program is built" pages.
- Weaning seniority and allergen introduction protocol.

### 2026-07-26 and earlier

- Google sign-in, helper invitations, child profile, automatic program, Supabase
  foundation, and the first version of the interface.
