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

## 2026.08.09.2

### Added

- **The microphone hears you now.** Last release shipped it as a preview: it
  opened, it showed your real voice level, and then it replayed the example
  sentence printed on screen — whatever you had actually said was thrown away.
  It transcribes for real. What comes back is your own sentence, and you still
  reread it before anything is written.
- **A pause no longer cuts you off.** The mic waits three seconds of silence
  instead of a second and a half, and a dictation can run to forty-five seconds.
  Hunting for the word « butternut » in the middle of a sentence no longer ends
  the recording.
- **When the mic gives up, it says which problem it is.** A permission your
  browser refused and a connection that dropped are two different things, and
  they used to produce the same screen.

### Changed

- The voice entry points say what they lead to: « Enregistrer un repas » and
  « Modifier le menu » rather than « Noter un repas » and « Changer quelque
  chose », and the written path is now « Chatter ».

### Fixed

- **The catch-up card shows the meal it is asking about.** « Il vous restait un
  repas à renseigner » held each meal on a single line, and the four faces took
  so much of a phone's width that the food was cut after three letters —
  « Déjeuner · Haricot ve… ». You were asked how a meal went without being able
  to see what it was. The foods now have their own line, all of them, and a
  chevron opens what was planned: quantities, allergen, season, restrictions.
  The four answers are labelled (adoré, moyen, refusé, pas donné) instead of
  being bare emoji.
- Screen readers announced those four buttons as "bien", "moyen", "refuse" —
  internal values, unaccented. They read the on-screen labels now.

### Internal

- Transcription goes through Gladia behind one signature
  (`src/lib/voice/transcribe.ts`), in two regimes `VOICE_TRANSCRIPTION` switches
  between: `pre-recorded` (`solaria-3`, the better model on real French, text
  arrives once the sentence is over) and `live` (`solaria-1`, words appear while
  you speak). The trade-off is accuracy against seeing the text come, not fast
  against slow — so both ship, and the variable exists to measure without
  redeploying. **Needs `GLADIA_API_KEY` in the environment**; without it the mic
  answers « Le micro n'est pas disponible. Écrivez-le, c'est pareil. »
- The key never reaches the browser. Live mode hands out a single-use WebSocket
  URL the server opened; pre-recorded audio transits `POST /api/voix/transcrire`
  and is released with the request — nothing on disk, nothing in the database.
- `src/lib/voice/dictation.ts` holds the whole audio path, so
  `voice-listening.tsx` only draws. A single PCM capture feeds both regimes,
  which is what keeps level, silence detection and the timer identical on both
  sides.
- The household lexicon (`src/lib/voice/lexicon.ts`) is deliberately shorter
  than the spec called for, and that is a measurement rather than an oversight:
  a term that looks like a common word costs more than it fixes. "Léa" turned
  « il a mangé des poireaux » into « Léa mangé des poireaux »; « Goûter » turned
  « il a goûté » into « il a Goûter ». Names, allergens and the catalogue stay;
  moment labels and command verbs are out.
- `PendingMeal` now carries the meal the page had already loaded, so the
  catch-up strip reuses `MealComposition` with no extra query.

## 2026.08.09.1

### Added

- **Say it the way you would tell someone.** A new field at the top of
  "Aujourd'hui" takes one ordinary French sentence — « Il a mangé des poireaux et
  de la pomme ce midi, il a adoré » — and turns it into the entries you would
  otherwise have made by hand: the meal, its foods, how it went. Before, that was
  four screens: the meal card, "autre chose", two foods, OK.
- **One sentence can carry several things at once.** "Poireaux et pomme à midi,
  il a adoré, et demain soir on ne sera pas là" produces one card per action, and
  each is confirmed with a single tap. **Nothing is ever written without that
  tap** — what you dictate is a proposal, never a change.
- **It answers questions, too.** "Qu'est-ce qu'il doit manger ce soir ?",
  "Quand est-ce qu'il teste l'arachide ?" — questions that had no screen, and
  were never going to have one.
- **A food it does not recognise is offered for creation**, under the name you
  used, rather than being quietly dropped or mistaken for a similar one. Same for
  the meal it cannot place: it asks instead of guessing.
- **The microphone is a preview for now.** It opens and shows your real voice
  level, but transcription is not connected yet, and the screen says so: « Aperçu
  — la transcription arrive bientôt. En attendant, c'est la phrase d'exemple qui
  est rejouée. » Writing the sentence is the path that works today.

### Internal

- Comprehension sits behind a provider layer (`src/lib/voice/providers/`):
  `VOICE_MODEL` picks the model and its prefix picks the vendor (`claude-`,
  `gemini-`, `gpt-`). The default is `gpt-5.6-terra` at effort `low`, chosen by
  measurement rather than by taste — 46/48 on the reference set, median 1.8 s.
  The effort default follows the provider, because `low` is the best setting on
  Terra and Gemini and the only leaky one on Opus 5 (it enumerates `moment_id`
  after politely refusing).
- `npm run voice:eval` replays a reference household through the real
  `understand()` and `resolveIntents()` paths, asserting resolved intents and
  never wording. `npm run voice:invariants` needs no API key: it forges the tool
  calls a compromised model would send and checks the application holds anyway.
- `resolveFood` now refuses a string that is a catalog identifier. In production
  identifiers are uuids, which no lookup pass brings near a name — but that is a
  property of their shape, not a guarantee.
- `POST /api/voix` understands and never writes; execution goes through
  `executeOrders`, which adds no business rule and reuses the existing actions
  with their replanning, shopping recount and RLS.

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
- Three markdown files under `docs/` that had never been through Prettier now
  are, so that the formatting guardrail could block too.
- `AGENTS.md` states which language goes where — English for the technical shell
  (commits, changelog, tooling, technical markdown outside `docs/`), French for
  the product (UI copy, `docs/`, comments in `src/`). Each new file used to be a
  coin toss. `supabase/email-templates/README.md` was translated to match.

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
