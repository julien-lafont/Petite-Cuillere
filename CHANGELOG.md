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

## 2026.08.10.2

### Added

- **Every meal now has an hour, and the app knows what time it is.** Breakfast
  runs 6–10, lunch 11–14, snack 15–18, dinner 18–22. The day does not have to be
  covered end to end: 10:30 belongs to no meal, and that is on purpose.
- **« Aujourd'hui » opens on the meal in front of you.** The open card is the one
  whose hour is running, or the next one — not the first meal you forgot to fill
  in. A breakfast left blank used to hold the page all day: at 7 p.m. the open
  recipe was still the morning's, and dinner sat folded three lines below.
- **A meal you have not reported is claimed the same day.** Until now the app
  waited for midnight before asking about this morning. It appears in the
  reminder at the top of the page, above yesterday and the day before, under
  « Un repas d'aujourd'hui attend votre réponse ».
- **Each line says its hours**, and the meal under way is marked « maintenant ».

### Changed

- **Speaking to the app: the tense of your verb picks the meal.** « Il a mangé
  des courgettes » means the meal under way, or the last one finished. « Il
  mangera de la pomme » means the one running or the next. At 11:30 both land on
  lunch; at 10:30, between two meals, the first goes to breakfast and the second
  to lunch. Early and late in the day it crosses over: at 5 a.m. a past tense
  means yesterday's dinner, at 11 p.m. a future one means tomorrow's breakfast —
  shown with its date, and changeable with one tap.
- **When nothing settles it, the app asks instead of guessing.** At 10:30, « il
  mange de la pomme » names no meal — you are between two. The card keeps the
  foods it understood and asks « Petit-déjeuner ou déjeuner ? »; one tap and it
  is ready. Nothing is written before that.
- **« Tout s'est passé comme prévu » no longer confirms tonight's dinner.** It
  covers the meals whose hour has passed, and leaves the rest alone.

### Fixed

- **Tonight's dinner no longer counts as eaten at breakfast.** An ingredient
  planned for the evening was marked as discovered from the moment you woke up:
  the « nouveauté » tag vanished before the meal, and the programme thought it
  had moved a step further than it had. The same held for allergens, where it
  mattered most — one served at dinner showed as introduced all day. A meal
  counts once its hour has passed, or as soon as you have reported it, whichever
  comes first.
- **The week grid and the day page now agree on what is late.** The « ? » on a
  meal nobody reported appeared a day later on one screen than the other.
- **Between midnight and 2 a.m., the app knew the wrong day.** It ran on the
  server's clock, which is UTC, so a meal noted late at night could land on the
  day before.

### Internal

- Migration `0022` adds `meal_moments.start_minute` / `end_minute` (upper bound
  excluded) with a gist exclusion constraint on `(household_id, int4range)`: two
  moments of a household cannot overlap, and `currentMoment()` can therefore
  return one moment rather than a list. `position` is derived from the hour and
  renumbered on every write; `reorderMealMoment` is gone.
- Same migration: `households.timezone`, detected once by `time-zone-probe.tsx`.
  `src/lib/clock.ts` (`nowIn`, `addISODays`, `diffISODays`) replaces `new Date()`
  wherever a day or an hour is situated server-side.
- `src/lib/moments.ts` holds the rules, pure — `currentMoment`, `lastEndedSlot` /
  `nextSlot`, `phaseOf`, `isPastMeal`, `awaitsSignalAt` (moved out of
  `meals.types.ts`, where it could not know the time).
- The voice tools carry a `temps` parameter; the `MOMENT_HOURS` regexp table that
  guessed an hour from a label is gone.
- 45 tests without an API key (`npm test`): `scripts/moments.test.ts`,
  `scripts/voice-slots.test.ts`, and two new invariants. Family L adds 14 model
  cases with a per-case clock. Design: `docs/feats/creneaux-horaires.md`.

## 2026.08.10.1

### Added

- **Tomato, aubergine, pepper and beetroot join the catalogue.** Tomato is the
  vegetable French households buy most, and none of these four were there. Prune
  arrives too, for the days transit needs a hand — with a portion of its own, so
  the app no longer suggests the 180 g it gives any other fruit.
- **The allergens page tells you what actually hurts.** Never a whole peanut or
  nut before 3, never raw or lightly cooked egg before 5, no large predatory
  fish, cow's milk as a drink only from 12 months. Each one stands out on its own
  in red instead of being buried mid-sentence in a preparation tip.
- **The version number sits at the bottom of every public page.** Small, out of
  the way — it is the one thing we will ask you to read back when you report
  something.

### Changed

- **Today's page follows your day instead of stacking four recipes.** Only the
  next meal is open. A meal you have reported folds down to a single line — a
  tick, its name, what was in it — and the recipe folds away with it, because
  once the meal is over it has nothing left to say. Meals still to come are lines
  too, which you can open to cook ahead. Four meals now fit where one used to.
- **Reporting a meal is one row of three buttons.** « Ce repas est fait »,
  « Repas sauté », « Le menu a changé » — same shape, each saying what it does.
  Before, six targets in five different styles asked how the meal _went_ before
  ever asking whether it happened at all.
- **Saying whether your baby liked it is now optional, and comes afterwards.**
  The three faces appear on the folded line, once the meal is settled. Closing a
  meal no longer requires rating it.
- **On a computer, « Aujourd'hui » opens on the meal.** The microphone moved into
  the header, beside the title. Its card used to push the first recipe 575 px
  down the screen, so the page opened on a promise rather than on what you came
  for. The rolling examples now live in the listening panel, where you actually
  need them.
- **A first allergen no longer asks for a confirmation of its own.** The warning
  is still there, in the meal it concerns, but reporting the meal is enough.
- **Warnings on an ingredient fold into a single icon.** A four-ingredient recipe
  could carry three full red lines under it, and the list stopped being readable.
  The sentence comes back on hover or to a screen reader.
- **Batch-cooking advice only mentions what freezes well.** It suggested
  preparing ten portions of petit-suisse and freezing them — the repetition was
  real, the advice was not.
- **The method pages drop their breadcrumb** and their table of contents now
  reuses each rule's own wording, so you recognise where you land.

### Fixed

- **An allergen your baby has never tasted no longer counts as introduced.** A
  first exposure the programme had merely _scheduled_ — sometimes months out —
  was read as one that had already happened, which could show a child as covered
  against an allergen they had never met.
- **The programme stopped skipping the allergen it had just scheduled.** Same
  cause, other end: when regenerating, it treated its own planned introduction as
  already done and moved on.
- **Removing an appreciation no longer un-does the meal.** Clearing the face on a
  meal you had confirmed put it back to "not reported yet".
- **The shopping list counts foods with their own portion correctly**, prunes
  included.

### Removed

- **The freezing tip is gone from today's meal card.** House-keeping advice, in a
  full-width green band, sitting right above the one thing the page asks of you.
  It stays where it belongs, on the programme preview and in the shopping list.

### Internal

- Requires migrations `0020_allergen_restrictions` (`allergens.restrictions`) and
  `0021_catalog_legumes_et_pruneau` (`foods.portion_label`, `foods.portion_grams`
  and the five new catalogue entries). **Both must be run in Supabase before this
  version is deployed** — `foods.portion_label` is selected by the meal query
  that every screen depends on.
- `meal-quick-rating.tsx` gives way to `meal-actions.tsx` (the three-button bar)
  and `meal-summary-row.tsx` (the folded line). `today-meals.tsx` holds the
  thread's cursor; `MealCard` gains `notice` and `batchHint`.
- New server action `setMealServed`: confirming a meal happened is now separate
  from rating it, and `setMealResult` no longer demotes a confirmed meal when its
  result is cleared.
- `src/lib/batch-cooking.ts` — the closed list of foods worth cooking in batches
  and freezing, shared by the shopping list and the programme preview.
- `portionFor()` takes the food itself as a third source of quantity, after the
  allergen protocol dose and the per-category rule.
- `APP_VERSION` is read from this file at build time in `next.config.ts` and
  inlined through `env`: Vercel's shallow clone carries no tags, and the
  release script already refuses to publish a version with no section here.
- `Crumb` and the breadcrumb rendering leave `method-page.tsx`.

## 2026.08.09.4

### Changed

- **The voice section on the homepage reads like a conversation now.** What you
  can say sits in its own column, and what the app understood — the meal, the
  mood, the note that it's a first — sits in the other, each one labelled so
  it's clear the two aren't the same list. It used to be a single busy example.
- **The four reasons under the headline are stacked, not squeezed into a row.**
  Easier to read at a glance on a phone.
- **The catch-up list stays a single line per meal on a tablet or a computer**,
  instead of stacking two full-width blocks and taking over the whole first
  screen.
- **Today's header is a touch shorter.** The reassurance line under your baby's
  age is gone now that the voice block right underneath already says it.

### Fixed

- **The voice confirmation button now says "Confirm."** It used to say "Noted"
  before anything was actually saved, which read as done when it wasn't yet.

### Internal

- Documented the non-breaking-space-before-colon rule in `AGENTS.md`, including
  a JSX line-wrap trap that can silently turn it into a double space, and how to
  check for it with the project's own compiler instead of guessing.
- Updated the voice command spec: the "questions" lot now answers seven of eight
  reference cases — only meal portions are missing — and the floating-button
  history is recorded in one place instead of scattered across two sections.

## 2026.08.09.3

### Added

- **The microphone follows you everywhere.** It used to live at the top of
  « Aujourd'hui », and nowhere else: telling the app something from the weekly
  view meant navigating back first. On a phone it is now a button at the centre
  of the bottom bar, within thumb's reach from every screen, whichever hand is
  free.
- **« Que puis-je dire ? » while it is listening.** An example rotates under the
  stop button and the full list is one tap away — during the seconds you are
  looking for your words, which is exactly when you need them. They disappear as
  soon as you start speaking, and reading them does not close the mic.
- **« Mon foyer » is in the bottom bar.** It was a small unlabelled icon in the
  header; it is now a target with a name, alongside the other three.

### Changed

- **« Aujourd'hui » opens on today's meal again.** The voice card took up almost
  the whole first screen of a small phone, so you had to scroll to find out what
  was for lunch. It is gone from the phone — the microphone in the bottom bar
  does the same job without the space. On a computer, where the card costs three
  times less room, it stays.
- Once a meal is recorded, the confirmation floats above the bottom bar instead
  of being inserted into the page — reading back what has just been saved no
  longer makes it jump under your eyes.

### Internal

- `voice-composer` becomes `voice-provider`, mounted by `app-shell` rather than
  by a page: both entry points, the wide-screen card and the thumb pill, now
  drive one and the same sheet. `voice-dock` is the pill, `voice-examples` the
  ticker and the four families shared by the card and the listening sheet.
- The four pieces the confirmation card needs to be drawn were props passed down
  by « Aujourd'hui ». `loadVoiceDisplay` (`voice.actions.ts`) loads them on first
  open, while the browser asks for microphone permission, instead of three
  queries on every navigation for a card nobody has requested yet. Not to be
  confused with `loadVoiceContext`, which prepares what the model reads.
- The primer bubble reads `localStorage` through `useSyncExternalStore`: the
  server renders "already seen", the client tells the truth at hydration, and
  there is no cascading render.
- The landing page gains a voice section, its examples copied word for word from
  `voice-examples.tsx` and its exchange from `voice-intent-block.tsx` — the usual
  rule, kept manually: never advertise a sentence the engine could not handle.

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
