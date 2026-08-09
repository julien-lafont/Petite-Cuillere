import type Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { VoiceTool } from "@/lib/voice/tools";
import type {
  ProviderResult,
  VoiceProvider,
} from "@/lib/voice/providers/types";

/**
 * Anthropic — le fournisseur de référence, celui sur lequel le jeu d'évaluation
 * de §11 a été étalonné.
 *
 * Deux réglages lui sont propres et n'ont pas d'équivalent ailleurs : la marque
 * de cache posée à la main sur le dernier bloc système, et le mode rapide.
 */

const MAX_TOKENS = 16000;

/**
 * Le SDK n'est chargé qu'à l'usage : le modèle configuré n'en emploie qu'un des
 * deux, et l'autre n'a rien à faire en mémoire dans une fonction serveur.
 */
let client: Anthropic | null = null;

async function anthropic(): Promise<Anthropic> {
  if (!client) {
    const sdk = await import("@anthropic-ai/sdk");
    client = new sdk.default();
  }
  return client;
}

/**
 * Chaque outil est déclaré `strict` : ses paramètres sont alors garantis
 * conformes au schéma, et `moment_id` — dont l'énumération est celle du foyer —
 * ne peut pas contenir l'identifiant d'un autre foyer, ni un identifiant
 * inventé.
 */
function toTool(tool: VoiceTool): Tool {
  return {
    name: tool.name,
    description: tool.description,
    strict: true,
    input_schema: tool.parameters,
  };
}

export const anthropicProvider: VoiceProvider = {
  name: "anthropic",
  prefixes: ["claude-"],
  credentials: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
  // `low` est écarté ici et nulle part ailleurs : c'est le seul palier sur
  // lequel Opus 5 énumère les `moment_id` après les avoir refusés (cas J3).
  defaultEffort: "medium",

  async run({ model, instructions, catalog, message, tools }) {
    const request = {
      model: model.id,
      max_tokens: MAX_TOKENS,
      // Jamais désactivée : sur Opus 5, la pensée coupée fait parfois écrire
      // l'appel d'outil en texte visible — l'outil n'est alors jamais exécuté,
      // et rien ne le signale.
      thinking: { type: "adaptive" as const },
      output_config: { effort: model.effort },
      system: [
        { type: "text" as const, text: instructions },
        // La coupure de cache est ici, sur le dernier bloc système : l'ordre de
        // rendu étant `outils → système → messages`, elle met en cache les
        // outils ET le catalogue. Tout ce qui change — date, prénom, repas du
        // jour — part dans le message, en dessous.
        {
          type: "text" as const,
          text: catalog,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      tools: tools.map(toTool),
      messages: [{ role: "user" as const, content: message }],
    };

    // Le mode rapide — jusqu'à 2,5× de tokens de sortie par seconde, au double
    // du prix d'entrée. C'est le seul levier qui s'attaque au vrai problème de
    // cette fonctionnalité : la latence est au double du budget de §3.4, et ce
    // n'est pas le raisonnement qu'on peut raboter sans perdre la justesse. Il
    // vit sur l'endpoint bêta, en aperçu de recherche, sur l'API Claude
    // uniquement — le corps est le même des deux côtés, seule la route change.
    const reply = model.fast
      ? await (
          await anthropic()
        ).beta.messages.create({
          ...request,
          speed: "fast",
          betas: ["fast-mode-2026-02-01"],
        })
      : await (await anthropic()).messages.create(request);

    const result: ProviderResult = {
      calls: [],
      texts: [],
      refused: reply.stop_reason === "refusal",
      cacheRead: reply.usage.cache_read_input_tokens ?? 0,
    };

    for (const block of reply.content) {
      if (block.type === "text") {
        result.texts.push(block.text);
      } else if (block.type === "tool_use") {
        result.calls.push({ name: block.name, params: block.input });
      }
    }
    return result;
  },
};
