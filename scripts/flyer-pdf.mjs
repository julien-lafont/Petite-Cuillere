/**
 * Renders docs/flyer/flyer.html to the two PDFs a flyer actually needs:
 *
 *   flyer-a5.pdf            trimmed A5, for a home or office printer;
 *   flyer-a5-impression.pdf 3 mm bleed and crop marks, the file a professional
 *                           printer asks for — the pine band and the pastel
 *                           grounds run to the edge, so they must spill past
 *                           the trim or a millimetre of drift shows white paper.
 *
 * Driven through headless Chromium directly rather than Playwright: the browser
 * is already on the box, and a print asset is not worth a dependency in
 * package.json. Run with `node scripts/flyer-pdf.mjs`.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm, access, glob } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const SOURCE = resolve(import.meta.dirname, "../docs/flyer/flyer.html");
const OUT_DIR = resolve(import.meta.dirname, "../docs/flyer");

/**
 * Chromium ships under a couple of names depending on the machine. The
 * Playwright directory is version-stamped (chromium-1194/…), hence the glob
 * rather than a pinned path that a browser update would silently break.
 */
const CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
].filter(Boolean);

const GLOBS = [
  "/opt/pw-browsers/chromium-*/chrome-linux/chrome",
  "/opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell",
];

async function findChromium() {
  for (const path of CANDIDATES) {
    try {
      await access(path);
      return path;
    } catch {
      /* try the next one */
    }
  }
  for (const pattern of GLOBS) {
    for await (const path of glob(pattern)) return path;
  }
  throw new Error(
    `No Chromium found. Set CHROME_PATH, or install one of:\n  ${[...CANDIDATES, ...GLOBS].join("\n  ")}`,
  );
}

const TARGETS = [
  { out: "flyer-a5.pdf", query: "", label: "A5 trimmed" },
  { out: "flyer-a5-impression.pdf", query: "?bleed", label: "A5 + 3 mm bleed" },
];

const chromium = await findChromium();

for (const target of TARGETS) {
  // A throwaway profile per run: Chromium refuses to start twice on one.
  const profile = await mkdtemp(join(tmpdir(), "flyer-"));
  const out = join(OUT_DIR, target.out);
  try {
    await run(chromium, [
      "--headless",
      "--disable-gpu",
      "--no-sandbox",
      `--user-data-dir=${profile}`,
      // Fonts and the QR are local files; the budget just lets them settle
      // before the snapshot, otherwise the PDF can come out in a fallback face.
      "--virtual-time-budget=8000",
      "--run-all-compositor-stages-before-draw",
      "--no-pdf-header-footer",
      `--print-to-pdf=${out}`,
      `file://${SOURCE}${target.query}`,
    ]);
    console.log(`  ${target.out}  (${target.label})`);
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}

console.log("\nDone. Both files live in docs/flyer/.");
