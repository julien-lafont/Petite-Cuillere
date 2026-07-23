/**
 * Flags de configuration de l'application.
 *
 * Basculer une valeur ici suffit : le code s'adapte partout (côté serveur comme
 * client). Les données déjà en base ne sont jamais effacées par une bascule,
 * elles sont simplement ignorées tant que le flag est désactivé.
 */

/**
 * Prise en charge des bébés prématurés : saisie de la date de terme théorique,
 * âge corrigé, et curseur d'âge projeté (entre âge réel et âge corrigé).
 *
 * Désactivé → l'app ne demande plus la date de terme et se base uniquement sur
 * l'âge réel, compté depuis la date de naissance.
 *
 * Le type est explicitement `boolean` (et non le littéral) pour que les deux
 * branches restent typées quelle que soit la valeur configurée.
 */
export const FEATURE_PREMATURE_BABY_ENABLED: boolean = false;
