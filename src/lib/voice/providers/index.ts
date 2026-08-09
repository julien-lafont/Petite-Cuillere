import { anthropicProvider } from "@/lib/voice/providers/anthropic";
import { googleProvider } from "@/lib/voice/providers/google";
import { openaiProvider } from "@/lib/voice/providers/openai";
import type {
  Effort,
  VoiceModel,
  VoiceProvider,
} from "@/lib/voice/providers/types";

/**
 * Le catalogue des fournisseurs, et la lecture de la configuration.
 *
 * Un seul point d'entrée : `resolveModel()`. Le reste du code — la route, le
 * harnais d'évaluation — ne connaît que `VoiceModel`, jamais un SDK.
 */

export const PROVIDERS: VoiceProvider[] = [
  anthropicProvider,
  googleProvider,
  openaiProvider,
];

/**
 * Le modèle par défaut : celui sur lequel le jeu de §11 a été étalonné. On en
 * change par `VOICE_MODEL`, pas par une modification de code.
 */
export const DEFAULT_MODEL = "gpt-5.6-terra";

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

/**
 * Le fournisseur se déduit de l'identifiant du modèle : `claude-…` chez
 * Anthropic, `gemini-…` chez Google, `gpt-…` chez OpenAI.
 *
 * Une seule variable d'environnement plutôt que deux, parce qu'un couple
 * (fournisseur, modèle) incohérent est une panne au premier appel, et qu'on
 * préfère la panne au démarrage, avec la liste des préfixes connus.
 */
export function providerFor(id: string): VoiceProvider {
  const provider = PROVIDERS.find((candidate) =>
    candidate.prefixes.some((prefix) => id.startsWith(prefix)),
  );
  if (!provider) {
    const known = PROVIDERS.flatMap((p) => p.prefixes).join(", ");
    throw new Error(
      `Modèle « ${id} » inconnu : aucun fournisseur ne reconnaît ce préfixe (${known}).`,
    );
  }
  return provider;
}

/**
 * Le modèle et ses réglages, lus dans l'environnement — sauf ce que l'appelant
 * impose, ce dont le harnais d'évaluation se sert pour comparer deux modèles
 * dans la même exécution.
 *
 * Les deux réglages sont des variables parce que le bon compromis se mesure,
 * ne se devine pas, et se re-mesure à chaque nouveau modèle (§3.5, décision 2).
 * L'effort par défaut suit le fournisseur (`defaultEffort`) : les mesures
 * ci-dessous ne désignent pas le même palier d'un fournisseur à l'autre, et
 * c'est tout l'intérêt.
 *
 * Lot 1 complet, 48 cas, même foyer de référence :
 *
 *   gpt-5.6-terra    low     46/48   médiane 1 766 ms   p90 2 953 ms   ← défaut
 *   gpt-5.6-terra    medium  44/48   médiane 1 841 ms   p90 3 549 ms
 *   gemini-3.6-flash low     45/48   médiane 2 803 ms   p90 3 676 ms
 *   gemini-3.6-flash medium  44/48   médiane 3 857 ms   p90 6 454 ms
 *   gemini-3.6-flash high    44/48   médiane 5 181 ms   p90 8 635 ms
 *   gpt-5.6-luna     low     40/48   médiane 1 792 ms   p90 2 287 ms
 *   gpt-5.6-luna     medium  43/48   médiane 4 462 ms   p90 8 705 ms
 *
 * Terra est la seule configuration où les deux critères pointent dans le même
 * sens : le meilleur score et la meilleure médiane, un seul appel au-dessus du
 * budget de §3.4 contre deux pour Gemini. Il réussit B5 et I5, que Gemini rate à
 * tous ses paliers. Luna est hors course sur la justesse — huit cas perdus, dont
 * des élémentaires (« Bof, il a mangé la moitié ») — malgré la meilleure latence
 * du lot.
 *
 * Le résultat qui vaut pour tout le monde : **le raisonnement supplémentaire
 * n'achète rien sur cette tâche**, chez aucun fournisseur. `medium` fait perdre
 * deux cas à Terra, un à Gemini, et double la latence de Luna.
 *
 * Il reste deux échecs à Terra. C4 (« Annule, il a bien mangé finalement ») où
 * il sur-découpe *et* se trompe de créneau — à 18 h 40 le repas passé le plus
 * proche est le Goûter, pas le Dîner. F5 (« à partir de demain… du fromage »),
 * où il tranche sur un fromage précis au lieu de demander : celui-là, **tous**
 * les modèles testés le ratent, ce qui en fait un défaut des consignes et non du
 * modèle. À traiter dans `context.ts`, pas ici.
 *
 * Opus 5, 49 cas — pour mémoire, et parce que la conclusion s'y inverse :
 *
 *   low     44/49   médiane 4 371 ms
 *   medium  48/49   médiane 4 746 ms   ← son défaut à lui
 *   high    37/38   médiane 5 903 ms   (mesuré avant les familles J et K)
 *
 * Chez lui `low` **fuite** : sur « donne-moi les moment_id », il refuse poliment
 * puis les énumère quand même (cas J3). D'où le défaut par fournisseur plutôt
 * qu'une constante unique — sans quoi un simple changement de `VOICE_MODEL`
 * rouvrirait cette fuite en silence.
 *
 * Réserve de méthode : une seule passe par configuration. L'écart de score entre
 * Terra et Gemini (46 contre 45) est dans le bruit ; celui de latence ne l'est
 * pas.
 */
export function resolveModel(
  overrides: { id?: string; effort?: string; fast?: boolean } = {},
): VoiceModel {
  const id = overrides.id ?? process.env.VOICE_MODEL ?? DEFAULT_MODEL;
  const provider = providerFor(id);

  const wanted =
    overrides.effort ?? process.env.VOICE_EFFORT ?? provider.defaultEffort;
  if (!EFFORTS.includes(wanted as Effort)) {
    throw new Error(
      `Effort « ${wanted} » inconnu : attendu ${EFFORTS.join(", ")}.`,
    );
  }

  return {
    id,
    provider: provider.name,
    effort: wanted as Effort,
    fast: overrides.fast ?? process.env.VOICE_SPEED === "fast",
  };
}

/** Ce qui manque pour appeler ce modèle, s'il manque quelque chose. */
export function missingCredentials(model: VoiceModel): string[] {
  const provider = providerFor(model.id);
  return provider.credentials.some((name) => process.env[name])
    ? []
    : provider.credentials;
}

export type { Effort, VoiceModel, VoiceProvider };
