/**
 * URL des deux pages éditoriales, centralisées ici parce qu'elles existent
 * **chacune en double** et qu'un lien vers la mauvaise passe inaperçu.
 *
 * Chaque page a en effet deux adresses, pour deux publics :
 *
 *   `/decouvrir/…`  la version publique, prérendue au build. C'est la seule
 *                   indexée, et celle que doit viser tout lien lu par un
 *                   visiteur sans compte : préchargée en entier, elle s'ouvre
 *                   sans le moindre aller-retour serveur.
 *   `/methode/…`    la même page dans la coquille de l'app, avec le prénom de
 *                   l'enfant et le catalogue du foyer. Rendue à la demande,
 *                   `noindex`, et canonique vers son pendant public.
 *
 * Les segments publics sont écrits pour la recherche : ce sont les mots qu'un
 * parent tape (« méthode de diversification alimentaire », « introduction des
 * allergènes »), pas notre vocabulaire interne. Ils font partie du contrat
 * public du site — les changer casse des liens entrants et demande une
 * redirection permanente dans `next.config.ts`.
 */

/** Page « comment le programme est construit », version publique indexée. */
export const METHODE_URL = "/decouvrir/methode-diversification-alimentaire";

/** Page « comment les allergènes sont introduits », version publique indexée. */
export const ALLERGENES_URL = "/decouvrir/introduction-allergenes";

/** La même méthode, dans l'app : prénom de l'enfant, navigation de l'app. */
export const APP_METHODE_URL = "/methode";

/** Les mêmes allergènes, dans l'app : catalogue du foyer compris. */
export const APP_ALLERGENES_URL = "/methode/allergenes";
