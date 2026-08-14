/**
 * Migration file names — the prefix is a key, not decoration.
 *
 * Supabase records what it has applied in `supabase_migrations.schema_migrations`,
 * keyed by the numeric prefix alone. Two files sharing one prefix therefore look
 * like one version to the CLI and to the GitHub integration: whichever lands
 * second is taken for already-applied and skipped — no error, no output, and a
 * table the deployed code expects that simply is not there.
 *
 * That is how `voice_traces` shipped without its table. This test is the cheapest
 * place to catch the next one: the file names are the whole input.
 *
 *   npm test
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const DIRECTORY = join(import.meta.dirname, "..", "supabase", "migrations");

/** `0031_voice_traces.sql` and `20260811083232_meal_photo.sql` both qualify. */
const NAME = /^(\d+)_[a-z0-9_]+\.sql$/;

const files = readdirSync(DIRECTORY).filter((name) => name.endsWith(".sql"));

test("every migration is named <version>_<snake_case>.sql", () => {
  assert.ok(files.length > 0, "aucune migration trouvée");
  for (const file of files) {
    assert.match(file, NAME);
  }
});

test("no two migrations share a version prefix", () => {
  const seen = new Map<string, string>();
  for (const file of files) {
    const version = NAME.exec(file)?.[1];
    if (!version) continue;
    const previous = seen.get(version);
    assert.equal(
      previous,
      undefined,
      `${file} et ${previous} partagent la version ${version} : ` +
        "la seconde appliquée serait ignorée en silence.",
    );
    seen.set(version, file);
  }
});
