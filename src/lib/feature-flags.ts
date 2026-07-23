/**
 * Feature flags globaux, lus une fois au build (voir `env` dans next.config.ts
 * pour leur exposition côté client).
 */

/**
 * Gère la prématurité : demande du terme théorique à l'onboarding, réglages
 * liés dans le profil, et prise en compte de l'âge corrigé / projeté partout
 * dans l'app. Désactivé → seul l'âge réel (depuis la naissance) est utilisé.
 */
export const FEATURE_PREMATURE_BABY_ENABLED =
  process.env.FEATURE_PREMATURE_BABY_ENABLED === "true";
