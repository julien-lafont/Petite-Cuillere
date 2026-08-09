import type OpenAI from "openai";
import type {
  FunctionTool,
  Response,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
import type { VoiceTool } from "@/lib/voice/tools";
import type { ToolCall, VoiceProvider } from "@/lib/voice/providers/types";

/**
 * OpenAI — le troisième fournisseur, et celui que `DEFAULT_MODEL` désigne depuis
 * que le jeu de §11 a tranché : `gpt-5.6-terra` en `low` est la seule
 * configuration mesurée qui gagne à la fois sur la justesse et sur la latence.
 *
 * Quatre différences de fond avec les deux autres, toutes absorbées ici :
 *
 * 1. **L'API est la Responses API**, pas un `messages.create`. Les consignes ont
 *    leur propre champ (`instructions`) et le message du parent va dans `input`.
 * 2. **Le cache n'a pas de marque**, comme chez Google : il porte
 *    automatiquement sur le préfixe commun, à partir de 1 024 tokens. D'où la
 *    même concaténation des deux blocs stables en tête — c'est leur position, et
 *    rien d'autre, qui fait le cache.
 * 3. **Les paramètres d'outil arrivent en chaîne JSON**, pas en objet. C'est le
 *    seul fournisseur où l'adaptateur doit parser, donc le seul où un modèle
 *    peut produire du JSON invalide.
 * 4. **La sortie est une liste d'items hétérogènes** (`output`), pas un contenu
 *    à deux formes. Le raisonnement y est un item comme un autre, qu'on laisse
 *    de côté.
 *
 * L'effort se transmet tel quel : `low` … `max` sont exactement les paliers
 * d'OpenAI. Tous les modèles n'acceptent pas les cinq — `xhigh` et `max` sont
 * réservés aux plus gros — et un palier refusé est une erreur au premier appel,
 * pas une dégradation silencieuse.
 */

const MAX_TOKENS = 16000;

type JsonSchema = Record<string, unknown>;

/**
 * Le mode strict d'OpenAI exige que **toute** clé de `properties` figure dans
 * `required` — un champ simplement omis fait échouer la requête au démarrage
 * (« 'required' is required to be supplied and to be an array including every
 * key in properties »). Les nôtres ne le sont pas : `enfant`, `date_iso`,
 * `moment_id` et `annuler` sont facultatifs par construction.
 *
 * La sortie de secours documentée est l'union avec `null` : le champ devient
 * obligatoire, et le modèle écrit `null` quand il n'a rien à y mettre. Pour un
 * champ à énumération, `null` doit entrer **dans l'énumération elle-même**, pas
 * seulement dans le type — sans quoi la valeur autorisée par `type` reste
 * interdite par `enum`. C'est le cas de `moment_id`.
 *
 * La conversion vit ici et pas dans `tools.ts` : c'est une contrainte d'un
 * fournisseur, et `tools.ts` doit rester le seul endroit où les intentions sont
 * décrites, sans rien qui appartienne à l'un d'eux. La résolution encaisse ces
 * `null` sans rien changer — elle traite déjà l'absence partout où ces champs
 * sont lus, parce qu'un modèle qui remplit mal un champ facultatif est un cas
 * qu'elle devait couvrir de toute façon.
 */
function withNullableOptionals(schema: JsonSchema): JsonSchema {
  const properties = schema.properties as
    Record<string, JsonSchema> | undefined;
  if (!properties) return schema;

  const required = new Set((schema.required as string[] | undefined) ?? []);
  const rewritten: Record<string, JsonSchema> = {};

  for (const [name, property] of Object.entries(properties)) {
    const nested =
      property.type === "object" ? withNullableOptionals(property) : property;
    if (required.has(name)) {
      rewritten[name] = nested;
      continue;
    }
    rewritten[name] = {
      ...nested,
      type: [nested.type as string, "null"],
      ...(Array.isArray(nested.enum)
        ? { enum: [...nested.enum, null] }
        : undefined),
    };
  }

  return {
    ...schema,
    properties: rewritten,
    required: Object.keys(rewritten),
  };
}

/**
 * `strict: true` — même raison que chez Anthropic : les paramètres sont alors
 * garantis conformes au schéma, et `moment_id`, dont l'énumération est celle du
 * foyer, ne peut contenir ni l'identifiant d'un autre foyer ni un inventé. C'est
 * ce qui justifie de convertir le schéma plutôt que de renoncer au mode strict.
 */
function toFunctionTool(tool: VoiceTool): FunctionTool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: withNullableOptionals(
      tool.parameters as JsonSchema,
    ) as FunctionTool["parameters"],
    strict: true,
  };
}

/**
 * Le SDK n'est chargé qu'à l'usage — cf. la note de l'adaptateur Anthropic. La
 * clé est lue dans l'environnement (`OPENAI_API_KEY`) : aucun secret ne transite
 * par le code.
 */
let client: OpenAI | null = null;

async function openai(): Promise<OpenAI> {
  if (!client) {
    const sdk = await import("openai");
    client = new sdk.default();
  }
  return client;
}

/**
 * Les arguments arrivent en chaîne. Un JSON invalide devient `null` plutôt
 * qu'une exception : la résolution rejette un paramètre qu'elle ne reconnaît
 * pas, et un cas d'évaluation doit se solder par un échec lisible, pas par une
 * passe entière qui tombe.
 */
function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Un refus poli est un `refusal` dans le contenu ; une coupure est un statut.
 * `max_output_tokens` est volontairement exclu du lot : comme chez Google, une
 * réponse tronquée n'est pas un refus, et ce qu'elle contient reste exploitable.
 */
function isRefusal(reply: Response, items: ResponseOutputItem[]): boolean {
  if (reply.status === "failed" || reply.status === "cancelled") return true;
  if (
    reply.incomplete_details?.reason !== undefined &&
    reply.incomplete_details.reason !== "max_output_tokens"
  ) {
    return true;
  }
  return items.some(
    (item) =>
      item.type === "message" &&
      item.content.some((part) => part.type === "refusal"),
  );
}

export const openaiProvider: VoiceProvider = {
  name: "openai",
  prefixes: ["gpt-", "o3", "o4"],
  credentials: ["OPENAI_API_KEY"],
  // `low` : chez Terra, `medium` coûte deux cas et ne rend rien. Les chiffres
  // sont dans `providers/index.ts`.
  defaultEffort: "low",

  async run({ model, instructions, catalog, message, tools }) {
    const reply = await (
      await openai()
    ).responses.create({
      model: model.id,
      // Les deux blocs stables, dans l'ordre, en tête de requête : le cache
      // automatique ne reconnaît que le préfixe commun d'une dictée à l'autre.
      instructions: `${instructions}\n\n${catalog}`,
      input: message,
      max_output_tokens: MAX_TOKENS,
      reasoning: { effort: model.effort },
      tools: tools.map(toFunctionTool),
      store: false,
    });

    const items = reply.output ?? [];
    const calls: ToolCall[] = [];
    const texts: string[] = [];

    for (const item of items) {
      if (item.type === "function_call") {
        calls.push({ name: item.name, params: parseArguments(item.arguments) });
      } else if (item.type === "message") {
        for (const part of item.content) {
          // Le raisonnement est un item à part, jamais un `output_text` : rien à
          // filtrer ici, contrairement aux parts `thought` de Gemini.
          if (part.type === "output_text") texts.push(part.text);
        }
      }
    }

    return {
      calls,
      texts,
      refused: isRefusal(reply, items),
      cacheRead: reply.usage?.input_tokens_details?.cached_tokens ?? 0,
    };
  },
};
