import type { VoiceContext } from "@/lib/voice/types";

/**
 * Le lexique du foyer, poussé au moteur de transcription (§4.2.2).
 *
 * Le foyer nous donne gratuitement un vocabulaire fermé — un prénom, soixante
 * aliments — et l'appariement est **phonétique**, pas textuel : on décrit ce
 * qu'on risque d'entendre, pas ce qu'on veut lire.
 *
 * **Ce fichier est plus petit que ce que §4.2.2 prévoyait, et c'est le résultat
 * d'une mesure, pas d'un oubli.** Sur des dictées réelles, chaque terme ajouté
 * corrige moins qu'il n'abîme dès qu'il ressemble à un mot courant :
 *
 *   · « Léa » dans le lexique a transformé « **il a** mangé des poireaux » en
 *     « **Léa** mangé des poireaux ». D'où `MIN_LENGTH` ;
 *   · les libellés de moments — « Goûter », « Dîner » — ont transformé « il a
 *     **goûté** » en « il a **Goûter** ». Ce sont des noms qui s'écrivent comme
 *     des verbes : le lexique écrase la conjugaison. Ils sont sortis ;
 *   · les verbes de commande, sortis pour la même raison, sans rien rattraper
 *     en échange.
 *
 * Restent le prénom, les allergènes et le catalogue : les mots que le moteur ne
 * peut pas deviner. Un lexique est un lexique, pas un dictionnaire — et le
 * moteur écrit très bien tout seul les mots que tout le monde connaît.
 */

export type Term = {
  value: string;
  /** Graphies telles qu'on risque de les entendre — l'appariement est phonétique. */
  variants?: string[];
  /** 0,4 à 0,6. Au-delà, le moteur voit du « panais » partout. */
  intensity?: number;
};

/**
 * Le plafond du lexique. La documentation de Gladia n'en fixe pas, mais la
 * qualité de l'appariement, elle, en fixe un : plus la liste est longue, plus le
 * moteur rapproche des mots qui n'ont rien à voir. ~80 entrées couvrent un foyer
 * complet, catalogue compris — c'est le réglage à surveiller (§4.2.2).
 */
const MAX_TERMS = 80;

/**
 * Un prénom est le mot le plus souvent estropié, et celui qui décide de quel
 * enfant on parle : il mérite qu'on force l'appariement plus que le reste.
 *
 * Sans illusion, cela dit : « Mathis » revient encore en « Maty », et monter à
 * 0,75 n'y change rien — seules les `variants`, qu'on ne sait pas inventer pour
 * un prénom quelconque, le rattraperaient. On reste donc au plafond recommandé,
 * et on s'appuie sur le fait qu'un prénom méconnu retombe sur l'enfant actif
 * (`resolveBaby`) au lieu de désigner le mauvais.
 */
const NAME_INTENSITY = 0.6;

/**
 * Sous quatre lettres, un terme phonétique attire tout ce qui passe. Ce n'est
 * pas une précaution théorique : avec « Léa » dans le lexique, « **il a** mangé
 * des poireaux » est revenu en « **Léa** mangé des poireaux ». La règle vaut
 * pour les prénoms comme pour le reste — un prénom court est justement celui
 * qui ressemble le plus à une syllabe ordinaire, donc le plus dangereux.
 *
 * Ce que ces mots-là perdent en correction, ils le regagnent en tranquillité :
 * un moteur les écrit bien tout seul, ce n'est pas eux qu'on vient corriger.
 */
const MIN_LENGTH = 4;

/**
 * Construit le lexique d'un foyer, du plus décisif au plus accessoire.
 *
 * L'ordre est l'arbitrage : si le plafond tombe, ce sont les aliments jamais
 * servis qui partent en premier, jamais le prénom de l'enfant ni un allergène.
 */
export function buildLexicon(ctx: VoiceContext): Term[] {
  const terms: Term[] = [];
  const seen = new Set<string>();

  const add = (value: string, term?: Omit<Term, "value">) => {
    const clean = value.trim();
    const key = clean.toLocaleLowerCase("fr-FR");
    if (clean.length < MIN_LENGTH || seen.has(key)) return;
    seen.add(key);
    terms.push({ value: clean, ...term });
  };

  // 1. Les prénoms du foyer. Hors-distribution par nature.
  for (const baby of ctx.babies) {
    add(baby.firstName, { intensity: NAME_INTENSITY });
  }

  // 2. Les allergènes. Vocabulaire de sécurité : une confusion coûte cher.
  for (const food of ctx.foods) if (food.allergen) add(food.allergen);

  // 3. Les aliments déjà servis. Ce sont ceux dont on reparle : le programme
  //    tourne autour d'eux, et le parent les nomme plusieurs fois par semaine.
  for (const { name } of ctx.discovered) add(name);

  // 4. Le reste du catalogue, tant qu'il reste de la place.
  for (const food of ctx.foods) add(food.name);

  return terms.slice(0, MAX_TERMS);
}
