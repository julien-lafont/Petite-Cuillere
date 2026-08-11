/**
 * Meal-time-slot rules — the part that needs no model and no database.
 *
 * `voice-eval.ts` only checks that the model can name the tense of a verb. The
 * deduction that follows lives here, in pure functions, and this is where its
 * real coverage belongs: inclusive/exclusive bounds, the gaps between meals,
 * the 18:00 junction, and the two day edges.
 *
 * See docs/feats/creneaux-horaires.md §8.3.
 *
 *   npm run moments:test
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  awaitsSignalAt,
  currentMoment,
  cursorMoment,
  firstFreeWindow,
  isPastMeal,
  lastEndedMoment,
  lastEndedSlot,
  nextMoment,
  nextSlot,
  phaseOf,
  windowIssue,
  windowLabel,
  type TimedMoment,
} from "@/lib/moments";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

/** The household defaults: two gaps, and a flush junction at 18:00. */
const MOMENTS: TimedMoment[] = [
  { id: "pd", label: "Petit-déjeuner", startMinute: h(6), endMinute: h(10) },
  { id: "dej", label: "Déjeuner", startMinute: h(11), endMinute: h(14) },
  { id: "gou", label: "Goûter", startMinute: h(15), endMinute: h(18) },
  { id: "din", label: "Dîner", startMinute: h(18), endMinute: h(22) },
];

const TODAY = "2026-08-08";
const at = (hours: number, minutes = 0) => ({
  todayISO: TODAY,
  minutes: h(hours, minutes),
});

// ───────────────────────────────────────────────────────────────────────────
// Bounds
// ───────────────────────────────────────────────────────────────────────────

test("the start bound is included and the end bound is excluded", () => {
  assert.equal(currentMoment(MOMENTS, h(6))?.id, "pd");
  assert.equal(currentMoment(MOMENTS, h(9, 59))?.id, "pd");
  assert.equal(currentMoment(MOMENTS, h(10)), null);
});

test("18:00 belongs to the dinner that starts, not the snack that ends", () => {
  assert.equal(currentMoment(MOMENTS, h(17, 59))?.id, "gou");
  assert.equal(currentMoment(MOMENTS, h(18))?.id, "din");
  assert.equal(phaseOf(MOMENTS[2], h(18)), "past");
  assert.equal(phaseOf(MOMENTS[3], h(18)), "current");
});

test("the gaps between meals belong to no moment", () => {
  for (const minutes of [h(3), h(10, 30), h(14, 30), h(23)]) {
    assert.equal(currentMoment(MOMENTS, minutes), null);
  }
});

test("phaseOf answers past, current and future for the same moment", () => {
  assert.equal(phaseOf(MOMENTS[1], h(9)), "future");
  assert.equal(phaseOf(MOMENTS[1], h(12)), "current");
  assert.equal(phaseOf(MOMENTS[1], h(15)), "past");
});

// ───────────────────────────────────────────────────────────────────────────
// Neighbours
// ───────────────────────────────────────────────────────────────────────────

test("the last ended moment ignores the one currently running", () => {
  assert.equal(lastEndedMoment(MOMENTS, h(12))?.id, "pd");
  assert.equal(lastEndedMoment(MOMENTS, h(14, 30))?.id, "dej");
  assert.equal(lastEndedMoment(MOMENTS, h(5)), null);
});

test("the next moment is the first that has not started", () => {
  assert.equal(nextMoment(MOMENTS, h(5))?.id, "pd");
  assert.equal(nextMoment(MOMENTS, h(12))?.id, "gou");
  assert.equal(nextMoment(MOMENTS, h(23)), null);
});

// ───────────────────────────────────────────────────────────────────────────
// The cursor — which meal the day's thread unfolds
// ───────────────────────────────────────────────────────────────────────────

test("the cursor takes the running meal, then the one ahead", () => {
  assert.equal(cursorMoment(MOMENTS, h(12))?.id, "dej");
  assert.equal(cursorMoment(MOMENTS, h(14, 30))?.id, "gou");
  // 02:00 — nothing has started yet, so the whole day is still ahead.
  assert.equal(cursorMoment(MOMENTS, h(2))?.id, "pd");
});

test("with nothing ahead, the cursor falls back on the nearest — the last ended", () => {
  // 20:00 with no dinner on the programme: the snack, ended two hours ago,
  // rather than a lunch the clock left long before it.
  const noDinner = MOMENTS.slice(0, 3);
  assert.equal(cursorMoment(noDinner, h(20))?.id, "gou");
  assert.equal(cursorMoment(MOMENTS, h(23))?.id, "din");
});

test("a day with nothing left to answer has no cursor at all", () => {
  // The caller only passes the meals still awaiting a signal: once they are all
  // settled, the thread unfolds nothing — there is nothing left to do.
  assert.equal(cursorMoment([], h(20)), null);
});

// ───────────────────────────────────────────────────────────────────────────
// Day edges — the overflow is worth exactly one day
// ───────────────────────────────────────────────────────────────────────────

test("before the first meal, the last ended slot is yesterday's dinner", () => {
  const slot = lastEndedSlot(MOMENTS, at(5))!;
  assert.equal(slot.moment.id, "din");
  assert.equal(slot.dateISO, "2026-08-07");
});

test("after the last meal, the next slot is tomorrow's breakfast", () => {
  const slot = nextSlot(MOMENTS, at(23, 30))!;
  assert.equal(slot.moment.id, "pd");
  assert.equal(slot.dateISO, "2026-08-09");
});

test("inside the day, neither neighbour changes the date", () => {
  assert.equal(lastEndedSlot(MOMENTS, at(16))!.dateISO, TODAY);
  assert.equal(nextSlot(MOMENTS, at(16))!.dateISO, TODAY);
});

// ───────────────────────────────────────────────────────────────────────────
// Meals
// ───────────────────────────────────────────────────────────────────────────

test("tonight's dinner is not a past meal in the morning", () => {
  const dinner = { date: TODAY, status: "prevu" };
  assert.equal(isPastMeal(dinner, MOMENTS[3], at(8)), false);
  assert.equal(isPastMeal(dinner, MOMENTS[3], at(22)), true);
});

test("a meal the parent reported counts before its slot ends", () => {
  // 12:30, lunch runs to 14:00: the parent said it happened, so it happened.
  const lunch = { date: TODAY, status: "servi" };
  assert.equal(isPastMeal(lunch, MOMENTS[1], at(12, 30)), true);
});

test("any earlier day is past, any later day is not", () => {
  assert.equal(
    isPastMeal({ date: "2026-08-07", status: "prevu" }, MOMENTS[3], at(8)),
    true,
  );
  assert.equal(
    isPastMeal({ date: "2026-08-09", status: "servi" }, MOMENTS[0], at(23)),
    false,
  );
});

test("only a filled, unanswered, finished meal awaits a signal", () => {
  const full = { date: TODAY, status: "prevu", meal_items: [{}] };
  assert.equal(awaitsSignalAt(full, MOMENTS[1], at(15)), true);
  assert.equal(awaitsSignalAt(full, MOMENTS[1], at(12)), false);
  assert.equal(
    awaitsSignalAt({ ...full, status: "servi" }, MOMENTS[1], at(15)),
    false,
  );
  assert.equal(
    awaitsSignalAt({ ...full, meal_items: [] }, MOMENTS[1], at(15)),
    false,
  );
});

// ───────────────────────────────────────────────────────────────────────────
// Editing and display
// ───────────────────────────────────────────────────────────────────────────

test("the window label follows French typography", () => {
  assert.equal(windowLabel(MOMENTS[1]), "11 h – 14 h");
  assert.equal(
    windowLabel({ ...MOMENTS[1], startMinute: h(11, 30) }),
    "11 h 30 – 14 h",
  );
});

test("a window that ends before it starts is refused", () => {
  assert.ok(windowIssue({ startMinute: h(14), endMinute: h(11) }, []));
  assert.ok(windowIssue({ startMinute: h(11), endMinute: h(11) }, []));
});

test("a touching window is allowed, an overlapping one is not", () => {
  // 18:00 is the snack's excluded end: starting there is legal.
  assert.equal(
    windowIssue({ startMinute: h(18), endMinute: h(20) }, [MOMENTS[2]]),
    null,
  );
  const clash = windowIssue({ startMinute: h(17), endMinute: h(20) }, [
    MOMENTS[2],
  ]);
  assert.ok(clash?.includes("Goûter"));
});

test("the suggested window is the first free hour from 8 a.m.", () => {
  assert.deepEqual(firstFreeWindow(MOMENTS), {
    startMinute: h(10),
    endMinute: h(11),
  });
  // A day with nothing before noon: the search starts at 8, not at midnight.
  assert.deepEqual(firstFreeWindow([MOMENTS[3]]), {
    startMinute: h(8),
    endMinute: h(9),
  });
});

test("a fully booked afternoon falls back to the early hours", () => {
  const packed: TimedMoment[] = [
    { id: "a", label: "A", startMinute: h(8), endMinute: h(24) },
  ];
  assert.deepEqual(firstFreeWindow(packed), {
    startMinute: h(0),
    endMinute: h(1),
  });
});
