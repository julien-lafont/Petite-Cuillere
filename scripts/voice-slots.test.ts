/**
 * Which meal a sentence lands on — the deduction, without the model.
 *
 * Family L of `voice-eval.ts` checks one thing only: that the model can name
 * the tense of the parent's verb. Everything that happens *after* — crossing
 * that tense with the clock to pick a slot — is pure code, and this is where it
 * is pinned down. No API key, no network, and one row per line of the table in
 * docs/feats/creneaux-horaires.md §7.3.
 *
 *   npm run voice:slots
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveIntents } from "@/lib/voice/resolution";
import type { RawIntent, Tense, VoiceContext } from "@/lib/voice/types";

const BASE: VoiceContext = JSON.parse(
  readFileSync(
    join(process.cwd(), "scripts", "fixtures", "voice-context.json"),
    "utf8",
  ),
);

/** The reference household, with its clock moved. */
function at(time: string): VoiceContext {
  const [hours, minutes] = time.split(":").map(Number);
  return {
    ...BASE,
    now: `${BASE.today}T${time}`,
    nowMinutes: hours * 60 + minutes,
  };
}

/** One dictated meal, moment left unsaid — the ordinary case. */
function logMeal(
  time: string,
  tense: Tense,
  extra: Record<string, unknown> = {},
) {
  const ctx = at(time);
  const raw: RawIntent[] = [
    {
      tool: "noter_repas",
      params: {
        jour: "aujourd_hui",
        temps: tense,
        aliments: ["Carotte"],
        nature: tense === "passe" ? "constat" : "prevision",
        appreciation: "non_dit",
        ...extra,
      },
    } as RawIntent,
  ];
  const [intent] = resolveIntents(raw, ctx);
  assert.notEqual(intent.detail.type, "askClarification");
  if (intent.detail.type === "askClarification") throw new Error("unreachable");
  return { intent, slot: intent.detail.slot };
}

// ───────────────────────────────────────────────────────────────────────────
// Inside a slot: the tense changes nothing, the clock has already decided
// ───────────────────────────────────────────────────────────────────────────

test("inside a slot, every tense lands on the slot running", () => {
  for (const tense of ["passe", "present", "futur"] as const) {
    const { slot } = logMeal("12:30", tense);
    assert.equal(slot.momentLabel, "Déjeuner", tense);
    assert.equal(slot.date, BASE.today);
    assert.equal(slot.momentAmbiguous, false);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// In a gap: the tense is the whole answer
// ───────────────────────────────────────────────────────────────────────────

test("in a gap, the past tense takes the slot that just ended", () => {
  assert.equal(logMeal("10:30", "passe").slot.momentLabel, "Petit-déjeuner");
  assert.equal(logMeal("14:30", "passe").slot.momentLabel, "Déjeuner");
});

test("in a gap, the future tense takes the slot to come", () => {
  assert.equal(logMeal("10:30", "futur").slot.momentLabel, "Déjeuner");
  assert.equal(logMeal("14:30", "futur").slot.momentLabel, "Goûter");
});

test("in a gap, the present tense admits it cannot tell", () => {
  for (const time of ["10:30", "14:30"]) {
    const { intent, slot } = logMeal(time, "present");
    assert.equal(slot.momentAmbiguous, true, time);
    assert.equal(intent.ready, false, time);
    assert.ok(intent.issue, time);
    // The foods survive: the parent taps a meal, not the whole sentence again.
    assert.equal(
      intent.detail.type === "logMeal" && intent.detail.foods.length,
      1,
    );
  }
});

// ───────────────────────────────────────────────────────────────────────────
// Day edges: one day of overflow, never two
// ───────────────────────────────────────────────────────────────────────────

test("at 5 a.m. a past tense reaches yesterday's dinner", () => {
  const { slot } = logMeal("05:00", "passe");
  assert.equal(slot.momentLabel, "Dîner");
  assert.equal(slot.date, "2026-08-07");
  assert.equal(slot.dateLabel, "hier");
});

test("at 11:30 p.m. a future tense reaches tomorrow's breakfast", () => {
  const { slot } = logMeal("23:30", "futur");
  assert.equal(slot.momentLabel, "Petit-déjeuner");
  assert.equal(slot.date, "2026-08-09");
  assert.equal(slot.dateLabel, "demain");
});

// ───────────────────────────────────────────────────────────────────────────
// What the tense must never override
// ───────────────────────────────────────────────────────────────────────────

test("a named moment beats any deduction", () => {
  const gouter = BASE.moments.find((m) => m.label === "Goûter")!;
  const { slot } = logMeal("12:30", "passe", { moment_id: gouter.id });
  assert.equal(slot.momentLabel, "Goûter");
  assert.equal(slot.momentInferred, false);
  assert.equal(slot.momentAmbiguous, false);
});

test("a named day beats the tense, and never becomes ambiguous", () => {
  // « Samedi » has already decided: a past day means its last meal, a future
  // day means lunch — whatever the verb, whatever the hour.
  for (const tense of ["passe", "present", "futur"] as const) {
    assert.equal(
      logMeal("10:30", tense, { jour: "hier" }).slot.momentLabel,
      "Dîner",
    );
    const ahead = logMeal("10:30", tense, { jour: "demain" }).slot;
    assert.equal(ahead.momentLabel, "Déjeuner");
    assert.equal(ahead.momentAmbiguous, false);
  }
});

test("a missing tense falls back to the historical behaviour", () => {
  // The field is required, so this only happens when the model drops it. The
  // old rule — last slot whose hour has passed — must still hold, and must not
  // change the day.
  const ctx = at("14:30");
  const [intent] = resolveIntents(
    [
      {
        tool: "noter_repas",
        params: {
          jour: "aujourd_hui",
          aliments: ["Carotte"],
          nature: "constat",
          appreciation: "non_dit",
        },
      } as RawIntent,
    ],
    ctx,
  );
  if (intent.detail.type === "askClarification") throw new Error("unreachable");
  assert.equal(intent.detail.slot.momentLabel, "Déjeuner");
  assert.equal(intent.detail.slot.date, BASE.today);
  assert.equal(intent.detail.slot.momentAmbiguous, false);
});

// ───────────────────────────────────────────────────────────────────────────
// The other slot-bearing intents follow the same rule
// ───────────────────────────────────────────────────────────────────────────

test("skipping and rating a meal read the clock the same way", () => {
  const ctx = at("16:00");
  const [skip] = resolveIntents(
    [
      {
        tool: "repas_non_donne",
        params: { jour: "aujourd_hui", temps: "passe" },
      } as RawIntent,
    ],
    ctx,
  );
  const [rate] = resolveIntents(
    [
      {
        tool: "noter_appreciation",
        params: { jour: "aujourd_hui", temps: "passe", appreciation: "bien" },
      } as RawIntent,
    ],
    ctx,
  );
  for (const intent of [skip, rate]) {
    if (intent.detail.type === "askClarification")
      throw new Error("unreachable");
    assert.equal(intent.detail.slot.momentLabel, "Goûter");
  }
});
