/**
 * Numéro de la version en production, affiché en pied de page.
 *
 * Il vient du CHANGELOG, lu au build et remplacé ici par sa valeur littérale
 * (cf. `next.config.ts`) : `process.env.APP_VERSION` n'existe pas à l'exécution,
 * c'est le compilateur qui écrit la chaîne à sa place. D'où l'accès direct au
 * membre, sans déstructuration — celle-ci ne serait pas substituée.
 *
 * À quoi ça sert : quand un parent nous signale quelque chose, la seule question
 * qu'on lui pose est « que voyez-vous en bas de page ? ». Le site se déploie
 * plusieurs fois par jour, et savoir sur quelle version il est évite de chercher
 * un bug déjà corrigé.
 */
export const APP_VERSION = process.env.APP_VERSION ?? "";
