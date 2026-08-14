import type { MomentContext, ToolName } from "@/lib/voice/types";

/**
 * The intents, declared as tools.
 *
 * Tools rather than structured output, for a simple reason: one sentence often
 * carries several intents ("il a mangé des poireaux et il a adoré, et demain on
 * n'est pas là"). Parallel calls express that naturally, where a single JSON
 * schema would force us to model a heterogeneous list by hand (§4.3).
 *
 * Tool and parameter names are **in French**: they are prompt literals, read by
 * a model reasoning in the language of the utterance, not code identifiers (§4.4
 * and AGENTS.md).
 *
 * The declaration is bare JSON Schema, with nothing provider-specific: the
 * adapter dresses it — `input_schema` and `strict` at Anthropic,
 * `parametersJsonSchema` at Google. This file stays the only place intents are
 * described, whichever model reads them.
 *
 * `additionalProperties: false` is not decorative: together with strict mode it
 * is what guarantees `moment_id` — whose enumeration is the household's — cannot
 * hold another household's id, nor an invented one.
 *
 * Batch 1: the four reality intents, plus the follow-up. The others (absence,
 * shopping, adverse effect, period confirmation) arrive in batches 4 and 5 — the
 * rule being that an intent only exists once a server action exists to run it
 * (§9.5).
 */

/** A tool described once, readable by any provider. */
export type VoiceTool = {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    additionalProperties: false;
  };
};

const DAY_KEYWORDS = [
  "aujourd_hui",
  "hier",
  "avant_hier",
  "demain",
  "apres_demain",
  "date_iso",
] as const;

const APPRECIATIONS = ["bien", "moyen", "refuse"] as const;

/**
 * The rating in `noter_repas`, with a value for "the parent said nothing".
 *
 * The parameter is **required**, unlike every other optional one in this file.
 * Left optional, it was simply omitted on "il a mangé des carottes à midi et il
 * a adoré" — the case §11 names as the over-splitting trap. A required field
 * forces a decision: the model can no longer slide past the question, it has to
 * answer "non_dit".
 */
const MEAL_APPRECIATIONS = [...APPRECIATIONS, "non_dit"] as const;

/**
 * The verb tense, described to the model.
 *
 * This is **the** piece of information the parent gives naturally and the old
 * schema threw away: "il a mangé", "il mange", "il mangera" point at three
 * different slots at the same time of day. The model does not need to know which
 * — it reports the grammar, the app infers the slot (§7.2).
 */
const TENSE_PARAM = {
  type: "string" as const,
  enum: ["passe", "present", "futur"],
  description:
    "Le temps du verbe employé par le parent, tel qu'il l'a dit. " +
    "« passe » = passé composé, imparfait, participe (« il a mangé », « c'était », « il a adoré ») ; " +
    "« present » = présent d'action en cours (« il mange », « il est en train de manger ») ; " +
    "« futur » = futur simple ou proche (« il mangera », « il va manger », « ce soir ce sera »). " +
    "Rapporte la grammaire, ne devine pas le repas : c'est l'application qui en " +
    "déduit le créneau à partir de l'heure qu'il est.",
};

/** Shared schema fragment: when, and on which slot. */
function slotSchema(moments: MomentContext[]) {
  return {
    temps: TENSE_PARAM,
    jour: {
      type: "string" as const,
      enum: [...DAY_KEYWORDS],
      description:
        "Le jour visé, relatif à aujourd'hui. Ne calcule jamais de date toi-même : " +
        "choisis « hier », « demain »… et laisse l'application compter. " +
        "N'emploie « date_iso » que pour un jour nommé (« samedi », « le 12 ») ou lointain.",
    },
    date_iso: {
      type: "string" as const,
      description:
        "Date absolue au format AAAA-MM-JJ. Uniquement quand jour vaut « date_iso ».",
    },
    moment_id: {
      type: "string" as const,
      enum: moments.map((m) => m.id),
      description:
        "Identifiant du moment de repas, à choisir dans la liste du foyer. " +
        "Omets-le si le parent n'a pas dit quel repas — c'est le cas ordinaire : " +
        "l'application croisera « temps » avec l'heure qu'il est, montrera le " +
        "créneau retenu, et demandera au parent quand rien ne s'impose.",
    },
  };
}

const BABY_PARAM = {
  type: "string" as const,
  description:
    "Prénom de l'enfant concerné. À omettre si le foyer n'a qu'un enfant, " +
    "ou si le parent n'a nommé personne.",
};

/**
 * Builds the tool set for a given household.
 *
 * Moment ids vary from one household to the next, so the tools are rebuilt on
 * every call. They stay stable for a given household, which makes them cacheable
 * alongside the catalogue (§4.3).
 */
export function toolsFor(moments: MomentContext[]): VoiceTool[] {
  const slot = slotSchema(moments);

  return [
    {
      name: "noter_repas",
      description:
        "Enregistre ce qu'un enfant a mangé (constat) ou ce qu'il mangera (prévision) " +
        "à un repas donné. C'est l'intention la plus fréquente. " +
        "Si le parent dit aussi comment ça s'est passé (« il a adoré », « il a tout recraché »), " +
        "porte-le dans « appreciation » ICI MÊME : n'émets pas un second appel à noter_appreciation " +
        "pour le même repas, cela déclencherait deux replanifications pour rien. " +
        "Exemple : « il a mangé des carottes à midi et il a adoré » → un seul appel, " +
        "aliments = [Carotte] ET appreciation = bien.",
      parameters: {
        type: "object",
        properties: {
          enfant: BABY_PARAM,
          ...slot,
          aliments: {
            type: "array",
            items: { type: "string" },
            description:
              "Noms des aliments, tels qu'ils figurent au catalogue quand tu les y reconnais. " +
              "Écris le nom, jamais un identifiant. Un aliment absent du catalogue se " +
              "donne quand même, sous son nom courant : l'application proposera de le créer. " +
              "Le lait — tétée, sein, biberon, lait infantile — n'en fait jamais partie : " +
              "il ne se note pas, on le passe sous silence quand un solide l'accompagne, " +
              "et quand il est tout ce que le parent rapporte, c'est repas_non_donne.",
          },
          appreciation: {
            type: "string",
            enum: [...MEAL_APPRECIATIONS],
            description:
              "Comment le repas s'est passé, d'après ce que le parent en dit. " +
              "« bien » = il a aimé (« il a adoré », « il a tout mangé »), " +
              "« moyen » = à moitié, « refuse » = il n'en a pas voulu, " +
              "« non_dit » = le parent n'en a rien dit. " +
              "Toujours à renseigner : choisis « non_dit » plutôt que d'omettre le champ.",
          },
          nature: {
            type: "string",
            enum: ["constat", "prevision"],
            description:
              "« constat » quand le repas a eu lieu, « prevision » quand le parent " +
              "annonce ce qui sera servi. C'est ce qui décide entre journaliser le " +
              "passé et verrouiller un créneau à venir.",
          },
        },
        required: ["jour", "temps", "aliments", "nature", "appreciation"],
        additionalProperties: false,
      },
    },
    {
      name: "repas_non_donne",
      description:
        "Le repas n'a pas eu lieu, ou n'aura pas lieu : sauté, oublié, l'enfant " +
        "était ailleurs, il n'a RIEN mangé du tout, ou il n'a eu QUE du lait. " +
        "Sert aussi à annuler ce geste (« finalement il a mangé ») avec annuler = true. " +
        "Le lait seul vaut repas non donné : le lait — tétée, sein, biberon, " +
        "lait infantile — n'est pas un aliment de la diversification, c'est la " +
        "base à laquelle les repas solides s'ajoutent. Un créneau où il n'y a eu " +
        "que du lait est un créneau où rien n'a été diversifié. " +
        "Exemples qui appellent tous repas_non_donne : « il n'a bu que du lait à " +
        "midi », « uniquement du lait à ce repas », « il a juste tété », « rien " +
        "que le sein », « il n'a pris que son biberon », « pas de solide ce soir, " +
        "juste un biberon », « on est resté au lait », « il n'a eu que son lait " +
        "au goûter », « il s'est endormi, il a juste eu sa tétée ». " +
        "Deux garde-fous. D'abord, un laitage du catalogue — yaourt, fromage " +
        "blanc, fromage — est un aliment comme un autre : « il n'a eu qu'un " +
        "yaourt » est un repas, donc noter_repas. Ensuite, dès qu'un solide est " +
        "nommé à côté du lait (« il a mangé sa purée et bu son biberon »), le " +
        "repas a bien eu lieu : noter_repas avec le seul solide. Le lait ne " +
        "figure jamais dans « aliments », quelle que soit l'intention. " +
        "À distinguer du refus : « il n'a rien mangé », « on a sauté le dîner » = " +
        "le repas n'a pas eu lieu, donc repas_non_donne ; « il a tout recraché », " +
        "« il n'en a pas voulu » = le repas a eu lieu et s'est mal passé, donc " +
        "noter_appreciation avec refuse.",
      parameters: {
        type: "object",
        properties: {
          enfant: BABY_PARAM,
          ...slot,
          annuler: {
            type: "boolean",
            description:
              "true pour revenir en arrière : le repas est finalement remis à « prévu ».",
          },
        },
        required: ["jour", "temps"],
        additionalProperties: false,
      },
    },
    {
      name: "noter_appreciation",
      description:
        "Note comment un repas s'est passé, sans toucher à sa composition. " +
        "À n'employer que si le parent ne dit PAS ce qui a été mangé — sinon " +
        "c'est noter_repas, avec son paramètre « appreciation ».",
      parameters: {
        type: "object",
        properties: {
          enfant: BABY_PARAM,
          ...slot,
          appreciation: {
            type: "string",
            enum: [...APPRECIATIONS],
            description:
              "« bien » = il a aimé, « moyen » = à moitié, « refuse » = il n'en a pas voulu.",
          },
        },
        required: ["jour", "temps", "appreciation"],
        additionalProperties: false,
      },
    },
    {
      name: "remplacer_aliment",
      description:
        "Le parent n'a pas un aliment prévu au menu et veut l'échanger. " +
        "Si aucun remplaçant n'est nommé, l'application en proposera trois.",
      parameters: {
        type: "object",
        properties: {
          enfant: BABY_PARAM,
          ...slot,
          aliment_absent: {
            type: "string",
            description: "Nom de l'aliment manquant, tel qu'il est au menu.",
          },
          remplacant: {
            type: "string",
            description:
              "Nom de l'aliment de remplacement, tel que le parent l'a nommé. " +
              "Écris « non_dit » s'il n'en a proposé aucun — ne choisis jamais " +
              "à sa place : l'application lui proposera trois aliments adaptés.",
          },
        },
        required: ["aliment_absent", "remplacant"],
        additionalProperties: false,
      },
    },
    {
      name: "demander_precision",
      description:
        "À employer quand la phrase désigne bien une action sur les repas mais " +
        "qu'il y manque une information sans laquelle rien ne peut être écrit : " +
        "aucun aliment nommé, ou un enfant ambigu dans un foyer qui en compte " +
        "plusieurs. N'écrit rien : pose la question au parent.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "La question, courte, telle qu'elle sera affichée.",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description:
              "Les réponses possibles, quand elles sont énumérables (prénoms, aliments du menu).",
          },
        },
        required: ["question", "options"],
        additionalProperties: false,
      },
    },
  ];
}
