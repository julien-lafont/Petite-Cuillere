/**
 * URLs of the two editorial pages, centralised here because each one exists
 * **twice** and a link to the wrong twin goes unnoticed.
 *
 * The two addresses serve two audiences:
 *
 *   `/decouvrir/…`  the public version, prerendered at build. It is the only one
 *                   indexed, and the one every link read by a signed-out visitor
 *                   must point at: prefetched whole, it opens with no server
 *                   round-trip.
 *   `/methode/…`    the same page inside the app shell, with the child's name and
 *                   the household catalogue. Rendered on demand, `noindex`, and
 *                   canonical to its public twin.
 *
 * The public segments are written for search: they are the words a parent types
 * ("méthode de diversification alimentaire", "introduction des allergènes"), not
 * our internal vocabulary. They are part of the site's public contract —
 * changing one breaks inbound links and needs a permanent redirect in
 * `next.config.ts`.
 */

/** "How the programme is built" page, public indexed version. */
export const METHODE_URL = "/decouvrir/methode-diversification-alimentaire";

/** "How allergens are introduced" page, public indexed version. */
export const ALLERGENES_URL = "/decouvrir/introduction-allergenes";

/** The same method, inside the app: child's name, app navigation. */
export const APP_METHODE_URL = "/methode";

/** The same allergens, inside the app: household catalogue included. */
export const APP_ALLERGENES_URL = "/methode/allergenes";
