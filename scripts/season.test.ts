/**
 * Seasonality — the verdict must never contradict the months printed with it.
 *
 * `/aliments` shows « De saison · sept.–déc. » on one line, the shopping list
 * and the recipe show « Frais » or « Surgelé ok » on another, and all three
 * read the same season. A ±1 month margin used to sit in between: it labelled
 * a range « De saison » in a month that range does not contain, and it advised
 * fresh strawberries in August.
 *
 *   npm run season:test
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  formatSeason,
  freshnessAdvice,
  inSeason,
  monthsToSeason,
  seasonToMonths,
  type Season,
} from "@/lib/season";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The shapes the catalogue holds, plus the ones the food editor can produce. */
const SEASONS: Record<string, Season> = {
  Abricot: [[6, 8]],
  Carotte: [[5, 11]],
  Potiron: [[9, 12]],
  Raisin: [[9, 10]],
  Fraise: [[5, 7]],
  "Blanc de poireau": [
    [1, 4],
    [9, 12],
  ],
  Kiwi: [
    [11, 12],
    [1, 3],
  ],
  Épinard: [
    [3, 6],
    [9, 11],
  ],
  "single month": [[7, 7]],
  "all year round": [[1, 12]],
  "across december": [[11, 2]],
};

test("the verdict covers exactly the months on display", () => {
  for (const [name, season] of Object.entries(SEASONS)) {
    const shown = seasonToMonths(season);
    for (const month of MONTHS) {
      assert.equal(
        inSeason(season, month),
        shown.includes(month),
        `${name} (${formatSeason(season)}) in month ${month}`,
      );
    }
  }
});

test("fresh inside the season, frozen outside of it", () => {
  for (const [name, season] of Object.entries(SEASONS)) {
    const shown = seasonToMonths(season);
    for (const month of MONTHS) {
      assert.equal(
        freshnessAdvice(season, month),
        shown.includes(month) ? "frais" : "surgele",
        `${name} in month ${month}`,
      );
    }
  }
});

test("a season covering the year does not wrap past itself", () => {
  const allYear = monthsToSeason(MONTHS);
  for (const month of MONTHS) {
    assert.equal(inSeason(allYear, month), true, `month ${month}`);
  }
});

test("no season means no buying advice at all", () => {
  for (const month of MONTHS) {
    assert.equal(freshnessAdvice(null, month), null);
    assert.equal(freshnessAdvice([], month), null);
    assert.equal(inSeason(null, month), false);
  }
});

test("the checkbox editor round-trips a season", () => {
  for (const season of Object.values(SEASONS)) {
    const months = seasonToMonths(season);
    assert.deepEqual(seasonToMonths(monthsToSeason(months)), months);
  }
});
