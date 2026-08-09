import type { VoiceTool } from "@/lib/voice/tools";

/**
 * Le contrat d'un fournisseur de compréhension.
 *
 * La compréhension est la seule dépendance externe du lot, et celle qui change
 * le plus vite : un modèle sort tous les trois mois, et le bon réglage se
 * mesure au lieu de se deviner (§3.5, décision 2). Le reste du code ne doit
 * donc jamais apprendre le nom du fournisseur — il demande « comprends cette
 * phrase », il reçoit des intentions brutes.
 *
 * Ce qu'un fournisseur reçoit est volontairement pauvre : deux blocs stables,
 * un bloc volatile, une liste d'outils décrite en JSON Schema. Toute la
 * spécificité — la marque de cache d'Anthropic, le `thinkingLevel` de Google —
 * vit dans l'adaptateur, pas ici.
 */

/**
 * La profondeur de raisonnement, dans le vocabulaire d'Anthropic parce qu'il
 * est le plus fin des deux. Chaque adaptateur la traduit dans le sien.
 */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type ProviderName = "anthropic" | "google" | "openai";

/** Un modèle configuré : qui l'héberge, et avec quels réglages on l'appelle. */
export type VoiceModel = {
  /** L'identifiant tel qu'il s'écrit dans `VOICE_MODEL`. */
  id: string;
  provider: ProviderName;
  effort: Effort;
  /** Mode rapide — n'existe que chez Anthropic, ignoré ailleurs. */
  fast: boolean;
};

/** Une requête de compréhension, dite une seule fois pour tous les modèles. */
export type UnderstandRequest = {
  model: VoiceModel;
  /** Bloc stable n° 1 : les consignes. */
  instructions: string;
  /** Bloc stable n° 2 : le catalogue du foyer. La coupure de cache est après lui. */
  catalog: string;
  /** Le bloc volatile : la date, les repas du jour, la phrase du parent. */
  message: string;
  tools: VoiceTool[];
};

export type ToolCall = {
  name: string;
  /** Les paramètres tels que le modèle les a écrits. La résolution vérifie. */
  params: unknown;
};

export type ProviderResult = {
  calls: ToolCall[];
  /** Les blocs de texte libre, raisonnement exclu. */
  texts: string[];
  /**
   * Le modèle a décliné. À traiter avant de lire le contenu : un refus renvoie
   * un 200 dont le contenu peut être vide.
   */
  refused: boolean;
  /** Tokens lus depuis le cache de prompt : zéro répété = coupure de cache cassée. */
  cacheRead: number;
};

export type VoiceProvider = {
  name: ProviderName;
  /** Les préfixes d'identifiants qui désignent ce fournisseur (« claude- »). */
  prefixes: string[];
  /** Les variables d'environnement dont l'une au moins doit porter une clé. */
  credentials: string[];
  /**
   * L'effort retenu quand `VOICE_EFFORT` ne dit rien — celui qu'a désigné le jeu
   * de §11 sur ce fournisseur-là.
   *
   * Il est porté ici, et pas en constante unique, parce que le bon palier ne se
   * transporte pas d'un modèle à l'autre : `low` est le meilleur réglage chez
   * Google et le seul dangereux chez Anthropic (cas J3). Un défaut global
   * rouvrirait cette fuite au premier changement de `VOICE_MODEL`.
   */
  defaultEffort: Effort;
  run(request: UnderstandRequest): Promise<ProviderResult>;
};
