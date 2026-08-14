/**
 * Application feature flags.
 *
 * Flipping a value here is enough: the code adapts everywhere, server and
 * client. Rows already in the database survive a flip, they are just ignored
 * while the flag is off.
 */

/**
 * Premature baby support: due-date entry, corrected age, and the projected-age
 * slider between real and corrected age.
 *
 * Off → the app stops asking for the due date and works from the real age only,
 * counted from the birth date.
 *
 * Typed as `boolean` rather than the literal so both branches stay typed
 * whatever the configured value.
 */
export const FEATURE_PREMATURE_BABY_ENABLED: boolean = false;

/**
 * Custom meal moments: rename, reorder, add or remove the moments of the day
 * from the household page.
 *
 * Off → the settings block disappears from the page; moments already saved stay
 * in the database and keep feeding the calendar and the journal, they just
 * cannot be edited.
 *
 * Typed as `boolean` rather than the literal so both branches stay typed
 * whatever the configured value.
 */
export const FEATURE_CUSTOM_MEALS: boolean = false;
