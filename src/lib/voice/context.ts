import type { VoiceContext } from "@/lib/voice/types";

/**
 * Ce que le modèle lit, et dans quel ordre.
 *
 * L'ordre de rendu d'une requête est `outils → système → messages`. On coupe le
 * cache sur le dernier bloc système : les outils et le catalogue — stables pour
 * un foyer — sont mis en cache ensemble, et tout ce qui change (la date, les
 * repas du jour, la phrase du parent) part dans le message utilisateur, en
 * dessous de la coupure. Une variable volatile placée au-dessus invaliderait
 * l'ensemble à chaque dictée (§4.3).
 */

/**
 * Les consignes. Elles ne bougent jamais : ni date, ni prénom, ni catalogue.
 *
 * Elles disent trois choses, dans cet ordre d'importance : le périmètre (les
 * repas de l'enfant, rien d'autre), la façon de nommer (des noms, jamais des
 * identifiants ni des dates calculées), et le refus du sur-découpage.
 */
export const INSTRUCTIONS = `Tu es le module de compréhension de Petite Cuillère, une application de suivi de la diversification alimentaire d'un bébé.

Un parent te parle en français ordinaire, souvent d'une main, souvent en cuisinant. Ton travail est de traduire sa phrase en intentions que l'application sait exécuter — et rien de plus. Tu n'écris jamais en base : tu décris une action, l'application la valide, le parent la confirme d'un tap.

## Ce que tu fais

Tu appelles un ou plusieurs outils. Une phrase porte souvent plusieurs intentions à la fois : « Poireaux ce midi, il a adoré, et je n'ai plus de riz pour ce soir » en contient deux. C'est le cas courant, pas l'exception — émets autant d'appels que nécessaire, en parallèle.

Le piège symétrique est le sur-découpage. « Il a mangé des carottes à midi et il a adoré » est **une** intention, pas deux : noter_repas porte déjà le paramètre appreciation, et tu dois le remplir dans le même appel. Deux écritures successives sur le même créneau déclencheraient deux replanifications pour rien.

**N'émets jamais deux fois le même appel.** Chaque intention se dit une fois. Si tu hésites entre deux formulations de la même action, choisis-en une.

## Trois règles absolues

1. **Tu ne calcules jamais une date.** On te donne le jour d'aujourd'hui. Emploie « hier », « demain », « avant_hier »… Pour un jour nommé (« samedi », « jeudi »), et seulement là, emploie « date_iso ». Un jour nommé désigne **sa prochaine occurrence**, demain compris : dit un vendredi, « samedi » est le lendemain, pas le samedi de la semaine suivante.
2. **Tu ne manipules jamais un identifiant d'aliment.** Tu renvoies des **noms**. Le serveur les retrouve au catalogue, et propose de créer ceux qu'il ne connaît pas. Le seul identifiant que tu emploies est celui d'un moment de repas, choisi dans la liste du foyer.
3. **Tu ne conclus jamais sur la santé.** Tu enregistres ce que le parent raconte, tu n'en tires aucun diagnostic.

## Quand tu n'appelles aucun outil

Si le parent pose une question sur les repas de son enfant, réponds en une ou deux phrases, à partir du contexte fourni — le menu du jour, ce qu'il a déjà découvert, ce que dit le catalogue. N'invente rien : si le contexte ne contient pas la réponse, dis-le.

Trois cas ont une réponse fixe :

- **Santé.** Fièvre, vomissements, plaques, inquiétude : « Je ne sais parler que de son alimentation. Pour ce qui touche à sa santé, appelez votre médecin ou le 15. »
- **Hors sujet.** Météo, histoires, tout ce qui n'est pas les repas de l'enfant : « Je ne sais parler que des repas de {prénom}. »
- **Conseil médical.** Aucun, jamais, même demandé gentiment.

## Ton

Court. Une ou deux phrases. Le parent lit d'un œil, l'autre main sur la casserole. Inutile de récapituler ce que tu viens d'enregistrer : la carte de confirmation le montre déjà. Tu peux dire une phrase avant d'appeler un outil si ça t'aide, mais l'appel d'outil reste indispensable — décrire une action en toutes lettres ne l'exécute pas.`;

/** Une ligne par aliment : nom, catégorie, âge, allergène, restriction. */
function foodLine(food: VoiceContext["foods"][number]): string {
  const parts = [food.name];
  if (food.category) parts.push(food.category);
  if (food.minAgeMonths) parts.push(`dès ${food.minAgeMonths} mois`);
  if (food.allergen) parts.push(`allergène : ${food.allergen}`);
  if (food.restrictions) parts.push(food.restrictions);
  return `- ${parts.join(" · ")}`;
}

/**
 * Le bloc mis en cache : le catalogue du foyer et ses moments de repas.
 *
 * Une soixantaine d'aliments, une dizaine de moments : moins de 1 500 tokens.
 * C'est ce qui permet d'envoyer le catalogue entier à chaque appel plutôt que
 * de monter une recherche vectorielle pour rien (§3.2, décision E).
 */
export function catalogBlock(ctx: VoiceContext): string {
  const moments = ctx.moments
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((m) => `- ${m.label} → moment_id : ${m.id}`)
    .join("\n");

  return `# Les moments de repas de ce foyer

${moments}

# Le catalogue d'aliments

${ctx.foods.map(foodLine).join("\n")}`;
}

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Le bloc volatile : la date, les enfants, et l'état réel de la semaine.
 *
 * Environ 800 tokens. Tout le reste — l'historique complet, les statistiques,
 * le programme jusqu'au premier anniversaire — reste dehors : une question qui
 * l'exige sera servie par un outil de lecture au lot 6, pas par un contexte
 * gonflé (§4.6).
 */
export function todayBlock(ctx: VoiceContext): string {
  const babies = ctx.babies
    .map(
      (b) =>
        `- ${b.firstName}, ${b.ageLabel}${b.sexe === "fille" ? " (fille)" : ""}` +
        (b.active
          ? " — c'est l'enfant affiché à l'écran, celui dont on parle par défaut"
          : ""),
    )
    .join("\n");

  const momentLabel = new Map(ctx.moments.map((m) => [m.id, m.label]));
  const meals = ctx.meals
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.momentId.localeCompare(b.momentId),
    )
    .map((meal) => {
      const what = meal.foods.length > 0 ? meal.foods.join(", ") : "rien";
      const state =
        meal.status === "saute"
          ? " — non donné"
          : meal.status === "prevu"
            ? ""
            : ` — ${meal.status === "servi" ? "servi" : "remplacé"}${meal.result ? `, ${meal.result}` : ""}`;
      return `- ${meal.date} · ${momentLabel.get(meal.momentId) ?? "?"} : ${what}${state}`;
    })
    .join("\n");

  const discovered =
    ctx.discovered.length > 0
      ? ctx.discovered.map((d) => `${d.name} (${d.exposures}×)`).join(", ")
      : "aucune pour l'instant";

  const allergens =
    ctx.allergens.length > 0
      ? ctx.allergens
          .map(
            (a) =>
              `- ${a.name} : ${a.state === "confirmed" ? "confirmé" : a.state === "ongoing" ? "protocole en cours" : "prévu"}${a.date ? ` (${a.date})` : ""}`,
          )
          .join("\n")
      : "- rien d'engagé";

  const shopping =
    ctx.shopping.length > 0
      ? ctx.shopping
          .map((s) => `${s.name}${s.checked ? " (acheté)" : ""}`)
          .join(", ")
      : "liste vide";

  // Le calendrier est donné tout fait : « Tu ne calcules jamais une date » ne
  // tient que si « samedi » se lit dans une table au lieu de se compter.
  const calendar = Array.from({ length: 10 }, (_, index) => {
    const day = new Date(`${ctx.today}T12:00:00`);
    day.setDate(day.getDate() + index - 2);
    const iso = day.toISOString().slice(0, 10);
    return `- ${DAY_FORMAT.format(day)} → ${iso}${iso === ctx.today ? "  ← aujourd'hui" : ""}`;
  }).join("\n");

  return `# Maintenant

Nous sommes le ${DAY_FORMAT.format(new Date(`${ctx.today}T12:00:00`))} (${ctx.today}), il est ${ctx.now.slice(11, 16)}.

# Le calendrier, tout fait

Quand le parent nomme un jour, prends sa date **dans cette table** — ne la calcule pas. Un jour nommé désigne sa prochaine occurrence.

${calendar}

# Les enfants du foyer

${babies}

# Les repas de la semaine (J-2 à J+7)

${meals || "- aucun repas au programme"}

# Ce qu'il a déjà découvert

${discovered}

# Allergènes

${allergens}

# Liste de courses de la semaine

${shopping}`;
}
