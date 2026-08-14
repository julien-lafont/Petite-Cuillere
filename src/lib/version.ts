/**
 * Production version number, shown in the footer.
 *
 * It comes from the CHANGELOG, read at build time and inlined here as a literal
 * (see `next.config.ts`): `process.env.APP_VERSION` does not exist at runtime,
 * the compiler writes the string in its place. Hence the direct member access,
 * with no destructuring — that would not be substituted.
 *
 * Why it earns its place: when a parent reports something, the only question we
 * ask is "what do you see at the bottom of the page?". The site ships several
 * times a day, and knowing which version they are on saves us chasing a bug that
 * is already fixed.
 */
export const APP_VERSION = process.env.APP_VERSION ?? "";
