/**
 * Le vocabulaire de la commande vocale — côté serveur comme côté client.
 *
 * Deux familles de types se répondent :
 *
 *   **raw**       ce que le modèle a le droit de dire. Des noms, des mots-clés,
 *                 jamais un identifiant ni une date calculée.
 *   **resolved**  ce que l'application en a fait : des uuid vérifiés, des dates
 *                 que le serveur a comptées lui-même.
 *
 * La frontière entre les deux est la garantie de la fonctionnalité : une
 * transcription fantaisiste ne peut pas inventer une exposition à l'arachide,
 * parce qu'elle ne manipule jamais l'identifiant d'un aliment.
 * Cf. docs/feats/commande-vocale.md §4.4.
 */

import type { MealResult, MealStatus } from "@/lib/data/meals.types";

// ────────────────────────────────────────────────────────────────────────────
// Le contexte transmis au modèle (§4.6)
// ────────────────────────────────────────────────────────────────────────────

export type MomentContext = {
  id: string;
  label: string;
  position: number;
  /** Début du créneau, en minutes depuis minuit local (6 h → 360). */
  startMinute: number;
  /** Fin du créneau, borne exclue (10 h → 600). */
  endMinute: number;
};

export type FoodContext = {
  id: string;
  name: string;
  category: string | null;
  /** Âge d'introduction habituel, en mois. */
  minAgeMonths: number | null;
  /** Phrase de restriction du catalogue — la source des réponses « puis-je… ». */
  restrictions: string | null;
  /** Libellé de l'allergène porté, s'il y en a un. */
  allergen: string | null;
};

export type BabyContext = {
  id: string;
  firstName: string;
  sexe: string | null;
  /** Âge effectif en toutes lettres (« 8 mois »). */
  ageLabel: string;
  ageMonths: number;
  /** L'enfant affiché à l'écran : celui dont on parle par défaut. */
  active: boolean;
};

export type MealContext = {
  date: string;
  momentId: string;
  /** Noms des aliments, dans l'ordre du repas. */
  foods: string[];
  status: MealStatus;
  result: MealResult;
};

export type AllergenContext = {
  name: string;
  state: "confirmed" | "ongoing" | "planned";
  /** Date de la prochaine exposition prévue, s'il y en a une. */
  date: string | null;
};

/**
 * Tout ce que le modèle voit. Volontairement petit — c'est ce qui tient le coût
 * et la latence (§4.6). L'historique complet, les statistiques et le programme
 * au long cours restent dehors.
 */
export type VoiceContext = {
  /** Horodatage local de la dictée, « YYYY-MM-DDTHH:mm ». */
  now: string;
  /** La même heure, en minutes depuis minuit — la forme que les règles lisent. */
  nowMinutes: number;
  /** Jour de la dictée, « YYYY-MM-DD ». Le modèle ne le calcule jamais. */
  today: string;
  /** « vendredi » — pour comprendre « samedi », « jeudi prochain ». */
  weekday: string;
  babies: BabyContext[];
  moments: MomentContext[];
  foods: FoodContext[];
  /** Repas de J-2 à J+7. */
  meals: MealContext[];
  /** Aliments déjà découverts et leur nombre d'expositions. */
  discovered: { name: string; exposures: number }[];
  allergens: AllergenContext[];
  shopping: { name: string; checked: boolean }[];
};

// ────────────────────────────────────────────────────────────────────────────
// Les intentions brutes — ce que le modèle a le droit de dire
// ────────────────────────────────────────────────────────────────────────────

/**
 * Le vocabulaire de dates du modèle : une énumération, jamais une soustraction.
 *
 * Un modèle qui compte les jours se trompe un jour sur dix ; un modèle qui dit
 * « hier » ne se trompe jamais. Le serveur résout.
 *
 * Les valeurs sont en français : ce sont des littéraux du prompt, pas des
 * identifiants — le modèle raisonne dans la langue de l'énoncé (§4.4).
 */
export type DayKeyword =
  | "aujourd_hui"
  | "hier"
  | "avant_hier"
  | "demain"
  | "apres_demain"
  | "date_iso";

export type Appreciation = "bien" | "moyen" | "refuse";

/**
 * Ce que le modèle peut répondre sur un repas qu'il compose : une appréciation,
 * ou l'aveu que le parent n'en a rien dit. Le second n'existe que dans l'échange
 * avec le modèle — la résolution le ramène à `null`.
 */
export type SpokenAppreciation = Appreciation | "non_dit";

/** Constat (« il a mangé ») ou prévision (« il mangera ») : deux écritures différentes. */
export type Nature = "constat" | "prevision";

/**
 * Le temps du verbe — ce qui désigne le créneau quand le parent ne le nomme pas.
 *
 * À ne pas confondre avec `Nature`, qui décide entre journaliser le passé et
 * verrouiller un créneau à venir. Les deux ne se recouvrent pas : « il mange des
 * carottes ce soir » est un présent qui vise l'avenir. Surtout, `Nature` ne
 * distingue pas « il mange » de « il mangera », et c'est exactement là que se
 * joue l'ambiguïté à 10 h 30 (docs/feats/creneaux-horaires.md §7.2).
 */
export type Tense = "passe" | "present" | "futur";

/** Ce qui situe une intention dans le temps, avant résolution. */
type RawSlot = {
  jour?: DayKeyword;
  /** Le temps du verbe employé par le parent. */
  temps?: Tense;
  /** Date absolue, quand `jour` vaut `date_iso`. */
  date_iso?: string;
  /** Identifiant d'un moment du foyer, choisi dans la liste transmise. */
  moment_id?: string;
};

export type RawLogMeal = RawSlot & {
  enfant?: string;
  aliments: string[];
  appreciation: SpokenAppreciation;
  nature: Nature;
};

export type RawSkipMeal = RawSlot & {
  enfant?: string;
  /** Marche arrière : « finalement il a mangé ». */
  annuler?: boolean;
};

export type RawRateMeal = RawSlot & {
  enfant?: string;
  appreciation: Appreciation;
};

export type RawSubstituteFood = RawSlot & {
  enfant?: string;
  aliment_absent: string;
  /** « non_dit » quand le parent n'a proposé personne. */
  remplacant: string;
};

export type RawAskClarification = {
  question: string;
  options: string[];
};

export type RawIntent =
  | { tool: "noter_repas"; params: RawLogMeal }
  | { tool: "repas_non_donne"; params: RawSkipMeal }
  | { tool: "noter_appreciation"; params: RawRateMeal }
  | { tool: "remplacer_aliment"; params: RawSubstituteFood }
  | { tool: "demander_precision"; params: RawAskClarification };

export type ToolName = RawIntent["tool"];

// ────────────────────────────────────────────────────────────────────────────
// Les intentions résolues — ce que l'application accepte d'exécuter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Un aliment nommé par le modèle, une fois confronté au catalogue.
 *
 * `unknown` n'est pas un échec : c'est une proposition de création, que le
 * parent valide ou non. Une écriture silencieuse serait le vrai échec (§9.2).
 */
export type ResolvedFood =
  | {
      state: "resolved";
      id: string;
      name: string;
      /** Ce que le modèle avait écrit — affiché quand la résolution a été approchée. */
      spoken: string;
      /** La correspondance n'était pas exacte (« blanc de poirot » → « Blanc de poireau »). */
      approximate: boolean;
    }
  | { state: "unknown"; spoken: string };

/** Le créneau, une fois les dates comptées et le moment vérifié. */
export type ResolvedSlot = {
  date: string;
  /** « aujourd'hui », « hier », « samedi 9 août » — pour l'affichage. */
  dateLabel: string;
  momentId: string;
  momentLabel: string;
  /** Le moment n'était pas nommé : l'application l'a déduit, il reste modifiable. */
  momentInferred: boolean;
  /**
   * Aucun créneau ne s'impose et le parent doit trancher.
   *
   * Le cas type : à 10 h 30, « il mange de la pomme ». On est entre le
   * petit-déjeuner et le déjeuner, et le présent ne dit pas lequel des deux.
   * L'intention part quand même — avec ses aliments compris — mais `ready` vaut
   * faux et le sélecteur de moment s'ouvre de lui-même. Un tap, contre une
   * phrase entière à redire (§7.4).
   */
  momentAmbiguous: boolean;
};

export type IntentDetail =
  | {
      type: "logMeal";
      slot: ResolvedSlot;
      foods: ResolvedFood[];
      appreciation: Appreciation | null;
      nature: Nature;
    }
  | { type: "skipMeal"; slot: ResolvedSlot; cancel: boolean }
  | { type: "rateMeal"; slot: ResolvedSlot; appreciation: Appreciation }
  | {
      type: "substituteFood";
      slot: ResolvedSlot;
      missing: ResolvedFood;
      replacement: ResolvedFood | null;
      /** Trois substituts proposés quand le parent n'en a pas nommé (§4.2 du suivi réel). */
      substitutes: { id: string; name: string }[];
    }
  | { type: "askClarification"; question: string; options: string[] };

/**
 * Une intention prête à être affichée dans la carte de confirmation.
 *
 * `ready` distingue ce qui part en base d'un tap de ce qui attend encore une
 * décision. Les valides survivent aux invalides : rejeter toute une dictée
 * parce qu'un mot manque, c'est perdre le parent (§4.5).
 */
export type ResolvedIntent = {
  /** Clé locale, stable le temps d'une carte. */
  key: string;
  /** L'enfant visé — l'actif par défaut. */
  babyId: string;
  babyName: string;
  ready: boolean;
  /** Ce qui manque, dit au parent. `null` quand tout va bien. */
  issue: string | null;
  detail: IntentDetail;
};

// ────────────────────────────────────────────────────────────────────────────
// Le contrat de la route
// ────────────────────────────────────────────────────────────────────────────

export type VoiceReply = {
  /** Le texte compris. Au lot 1, c'est celui que le parent a tapé. */
  transcript: string;
  /** Texte libre du modèle : la réponse à une question, ou un refus poli. */
  answer: string | null;
  intents: ResolvedIntent[];
  /**
   * Au-delà de six intentions, on n'exécute pas en aveugle : la carte demande
   * une validation bloc par bloc (§4.5).
   */
  perBlockValidation: boolean;
  /** Millisecondes. La latence est l'indicateur n° 1 à instrumenter (§3.4). */
  latency: { understanding: number; total: number };
};

export type VoiceError = { error: string };

/**
 * Ce que `POST /api/voix/ecoute` répond : **le régime de transcription, décidé
 * par le serveur**.
 *
 * C'est lui qui lit `VOICE_TRANSCRIPTION`, pas le navigateur — une variable
 * publique se figerait à la construction, là où celle-ci se change sans
 * redéployer. Le navigateur demande donc « comment j'écoute ? » avant de le
 * faire, et adapte son trajet : flux vers la session ouverte, ou enregistrement
 * puis envoi à `POST /api/voix/transcrire`.
 */
export type VoiceListenReply =
  { mode: "live"; url: string } | { mode: "pre-recorded" };

export type VoiceTranscriptReply = { transcript: string };
