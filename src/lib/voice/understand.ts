import { INSTRUCTIONS, catalogBlock, todayBlock } from "@/lib/voice/context";
import { toolsFor } from "@/lib/voice/tools";
import { providerFor, resolveModel } from "@/lib/voice/providers";
import type { VoiceModel } from "@/lib/voice/providers/types";
import type { RawIntent, ToolName, VoiceContext } from "@/lib/voice/types";

/**
 * La compréhension — la seule dépendance externe de ce lot, isolée derrière une
 * fonction.
 *
 * Un aller-retour, une réponse, fin. Ni agent, ni boucle d'outils : la boucle
 * agentique coûterait cinq secondes de plus pour un pouvoir dont on ne veut pas
 * — le modèle ne doit avoir aucun accès à la base (§4.1, décision F).
 *
 * Ce fichier ne connaît aucun fournisseur. Il compose les trois blocs de
 * contexte, appelle l'adaptateur du modèle configuré (`src/lib/voice/providers`)
 * et trie ce qui en revient. Changer de modèle est une variable
 * d'environnement, pas une modification de code.
 */

export type Understanding = {
  intents: RawIntent[];
  /** Texte libre : la réponse à une question, ou un refus poli. */
  answer: string | null;
  /** Millisecondes passées dans l'appel — l'indicateur à surveiller (§3.4). */
  latency: number;
  /** Tokens lus depuis le cache de prompt : zéro répété = coupure de cache cassée. */
  cacheRead: number;
  /** Le modèle qui a répondu — à journaliser, sans quoi une mesure ne veut rien dire. */
  model: VoiceModel;
};

const KNOWN_TOOLS = new Set<ToolName>([
  "noter_repas",
  "repas_non_donne",
  "noter_appreciation",
  "remplacer_aliment",
  "demander_precision",
]);

/**
 * Le repli quand le modèle décline. Il ne devrait jamais arriver sur ce domaine,
 * mais un accès direct au premier bloc de contenu planterait le jour où il
 * arrive.
 */
const REFUSAL_ANSWER =
  "Je n'ai pas pu traiter cette phrase. Reformulez-la, ou notez le repas depuis l'écran du jour.";

export async function understand(
  sentence: string,
  ctx: VoiceContext,
  model: VoiceModel = resolveModel(),
): Promise<Understanding> {
  const start = Date.now();

  const result = await providerFor(model.id).run({
    model,
    instructions: INSTRUCTIONS,
    catalog: catalogBlock(ctx),
    message: `${todayBlock(ctx)}\n\n# Ce que le parent vient de dire\n\n${sentence}`,
    tools: toolsFor(ctx.moments),
  });

  const latency = Date.now() - start;

  if (result.refused) {
    return {
      intents: [],
      answer: REFUSAL_ANSWER,
      latency,
      cacheRead: result.cacheRead,
      model,
    };
  }

  const intents: RawIntent[] = [];
  for (const call of result.calls) {
    // Un outil qu'on ne connaît pas est un outil qu'on n'exécutera pas : les
    // paramètres n'ont alors aucun schéma de référence, donc aucune garantie.
    if (!KNOWN_TOOLS.has(call.name as ToolName)) continue;
    intents.push({
      tool: call.name as ToolName,
      // Le schéma est garanti conforme côté modèle ; la résolution vérifie tout
      // le reste.
      params: call.params as never,
    });
  }

  return {
    intents,
    // Aucun outil appelé = c'était une question, et le texte libre EST la
    // réponse. Pas de branche « type: question » à inventer (§4.3).
    answer: result.texts.join("\n").trim() || null,
    latency,
    cacheRead: result.cacheRead,
    model,
  };
}
