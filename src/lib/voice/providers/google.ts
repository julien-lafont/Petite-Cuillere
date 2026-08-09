import type {
  FunctionDeclaration,
  GenerateContentResponse,
  GoogleGenAI,
} from "@google/genai";
import type { VoiceTool } from "@/lib/voice/tools";
import type { Effort, VoiceProvider } from "@/lib/voice/providers/types";

/**
 * Google — la seconde implémentation, et la preuve que la couche fournisseur
 * n'est pas de la plomberie décorative.
 *
 * Trois différences de fond avec Anthropic, toutes absorbées ici :
 *
 * 1. **Le cache n'a pas de marque.** Gemini met en cache implicitement le
 *    préfixe commun de deux requêtes successives, sans qu'on le lui demande.
 *    D'où la concaténation des deux blocs stables dans `systemInstruction` :
 *    c'est leur position en tête de requête, et rien d'autre, qui fait le
 *    cache. Le compteur reste lisible (`cachedContentTokenCount`).
 * 2. **Le raisonnement se règle en paliers**, pas en effort continu.
 * 3. **Le refus est un `finishReason`**, pas un `stop_reason`.
 *
 * `VOICE_MODEL` attend ici un modèle Gemini 3 ou plus récent : `thinkingLevel`
 * n'existe pas avant (les 2.5 se règlent en `thinkingBudget`, une autre unité).
 */

const MAX_TOKENS = 16000;

/**
 * L'effort, traduit en paliers. Gemini n'en compte que quatre : `xhigh` et
 * `max` retombent sur `HIGH`, le plus haut qu'il sache faire.
 */
const THINKING_LEVEL: Record<Effort, "MINIMAL" | "LOW" | "MEDIUM" | "HIGH"> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  xhigh: "HIGH",
  max: "HIGH",
};

/**
 * Tout ce qui n'est pas une fin normale. `MALFORMED_FUNCTION_CALL` est rangé
 * ici volontairement : le modèle n'a rien produit d'exploitable, et le dire au
 * parent vaut mieux que de lui montrer une carte vide.
 */
const NORMAL_FINISH = new Set([
  "STOP",
  "MAX_TOKENS",
  "FINISH_REASON_UNSPECIFIED",
]);

/**
 * Le SDK n'est chargé qu'à l'usage — cf. la note de l'adaptateur Anthropic. On
 * garde le module lui-même et pas seulement le client : `ThinkingLevel` est une
 * énumération TypeScript, donc une valeur, qu'un `import type` n'apporte pas.
 */
type Sdk = typeof import("@google/genai");

let sdk: Sdk | null = null;
let client: GoogleGenAI | null = null;

async function google(): Promise<{ sdk: Sdk; client: GoogleGenAI }> {
  sdk ??= await import("@google/genai");
  // La clé est lue dans l'environnement (`GEMINI_API_KEY`), comme chez
  // Anthropic : aucun secret ne transite par le code.
  client ??= new sdk.GoogleGenAI({});
  return { sdk, client };
}

/**
 * `parametersJsonSchema` plutôt que `parameters` : il prend le JSON Schema tel
 * quel, énumérations et `additionalProperties: false` compris, là où
 * `parameters` imposerait de réécrire chaque champ dans le dialecte OpenAPI du
 * SDK. C'est ce qui permet à `tools.ts` de rester le seul endroit où les
 * intentions sont décrites.
 */
function toFunctionDeclaration(tool: VoiceTool): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.parameters,
  };
}

/**
 * Le texte visible, raisonnement exclu : les parts de pensée portent
 * `thought: true` et n'ont rien à faire dans la réponse au parent.
 */
function visibleTexts(reply: GenerateContentResponse): string[] {
  const parts = reply.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text as string);
}

export const googleProvider: VoiceProvider = {
  name: "google",
  prefixes: ["gemini-"],
  credentials: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  // `LOW` : le raisonnement supplémentaire n'achète rien ici, et coûte le
  // budget de §3.4. Les chiffres sont dans `providers/index.ts`.
  defaultEffort: "low",

  async run({ model, instructions, catalog, message, tools }) {
    const { sdk, client } = await google();

    const reply = await client.models.generateContent({
      model: model.id,
      contents: message,
      config: {
        // Les deux blocs stables, dans l'ordre, en tête de requête : c'est ce
        // préfixe-là que le cache implicite reconnaîtra d'une dictée à l'autre.
        systemInstruction: `${instructions}\n\n${catalog}`,
        maxOutputTokens: MAX_TOKENS,
        thinkingConfig: {
          thinkingLevel: sdk.ThinkingLevel[THINKING_LEVEL[model.effort]],
        },
        tools: [{ functionDeclarations: tools.map(toFunctionDeclaration) }],
      },
    });

    const finish = reply.candidates?.[0]?.finishReason;

    return {
      calls: (reply.functionCalls ?? []).map((call) => ({
        name: call.name ?? "",
        params: call.args,
      })),
      texts: visibleTexts(reply),
      refused:
        // Un prompt bloqué en amont ne produit même pas de candidat.
        reply.promptFeedback?.blockReason !== undefined ||
        (finish !== undefined && !NORMAL_FINISH.has(finish)),
      cacheRead: reply.usageMetadata?.cachedContentTokenCount ?? 0,
    };
  },
};
