import {
  currentMoment,
  lastEndedSlot,
  nextSlot,
  sortMoments,
  windowLabel,
} from "@/lib/moments";
import type { VoiceContext } from "@/lib/voice/types";

/**
 * What the model reads, and in which order.
 *
 * A request renders as `tools → system → messages`. We break the cache on the
 * last system block: the tools and the catalogue — stable for a household — are
 * cached together, and everything that changes (the date, the day's meals, the
 * parent's sentence) goes into the user message, below the breakpoint. A
 * volatile variable placed above would invalidate the lot on every dictation
 * (§4.3).
 */

/**
 * The instructions. They never move: no date, no first name, no catalogue.
 *
 * They say three things, in this order of importance: the scope (the child's
 * meals, nothing else), how to name things (names, never ids nor computed
 * dates), and no over-splitting.
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
4. **Tu ne déduis jamais un repas de l'heure qu'il est.** Quand le parent ne nomme pas le repas, tu omets « moment_id » et tu renseignes « temps » — le temps de son verbe, rien de plus. C'est l'application qui croise les deux, et qui pose la question quand rien ne s'impose. Un modèle qui devine le créneau se trompe un jour sur trois ; un modèle qui rapporte « il a mangé » ne se trompe jamais.

## Quand tu n'appelles aucun outil

Si le parent pose une question sur les repas de son enfant, réponds en une ou deux phrases, à partir du contexte fourni — le menu du jour, ce qu'il a déjà découvert, ce que dit le catalogue. N'invente rien : si le contexte ne contient pas la réponse, dis-le.

Trois cas ont une réponse fixe :

- **Santé.** Fièvre, vomissements, plaques, inquiétude : « Je ne sais parler que de son alimentation. Pour ce qui touche à sa santé, appelez votre médecin ou le 15. »
- **Hors sujet.** Météo, histoires, tout ce qui n'est pas les repas de l'enfant : « Je ne sais parler que des repas de {prénom}. »
- **Conseil médical.** Aucun, jamais, même demandé gentiment.

## Ton

Court. Une ou deux phrases. Le parent lit d'un œil, l'autre main sur la casserole. Inutile de récapituler ce que tu viens d'enregistrer : la carte de confirmation le montre déjà. Tu peux dire une phrase avant d'appeler un outil si ça t'aide, mais l'appel d'outil reste indispensable — décrire une action en toutes lettres ne l'exécute pas.`;

/** One line per food: name, category, age, allergen, restriction. */
function foodLine(food: VoiceContext["foods"][number]): string {
  const parts = [food.name];
  if (food.category) parts.push(food.category);
  if (food.minAgeMonths) parts.push(`dès ${food.minAgeMonths} mois`);
  if (food.allergen) parts.push(`allergène : ${food.allergen}`);
  if (food.restrictions) parts.push(food.restrictions);
  return `- ${parts.join(" · ")}`;
}

/**
 * The cached block: the household catalogue and its meal moments.
 *
 * Sixty-odd foods, ten-odd moments: under 1,500 tokens. That is what lets us
 * send the whole catalogue on every call rather than standing up a vector search
 * for nothing (§3.2, decision E).
 */
export function catalogBlock(ctx: VoiceContext): string {
  // Times live here rather than in the volatile block: they are stable for a
  // household, so on the right side of the cache breakpoint. What moves — which
  // slot is current — goes into `todayBlock`.
  const moments = sortMoments(ctx.moments)
    .map((m) => `- ${m.label}, de ${windowLabel(m)} → moment_id : ${m.id}`)
    .join("\n");

  return `# Les moments de repas de ce foyer

${moments}

La journée n'est pas couverte de bout en bout : entre deux créneaux, il n'y a
aucun repas. C'est normal, et c'est ce qui rend certaines phrases ambiguës.

# Le catalogue d'aliments

${ctx.foods.map(foodLine).join("\n")}`;
}

const DAY_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * The volatile block: the date, the children, and the week's real state.
 *
 * About 800 tokens. Everything else — the full history, the statistics, the
 * programme up to the first birthday — stays out: a question that needs it will
 * be served by a read tool in batch 6, not by an inflated context (§4.6).
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

  // The calendar is given ready-made: "never compute a date" only holds if
  // "samedi" can be read from a table instead of counted.
  const calendar = Array.from({ length: 10 }, (_, index) => {
    const day = new Date(`${ctx.today}T12:00:00`);
    day.setDate(day.getDate() + index - 2);
    const iso = day.toISOString().slice(0, 10);
    return `- ${DAY_FORMAT.format(day)} → ${iso}${iso === ctx.today ? "  ← aujourd'hui" : ""}`;
  }).join("\n");

  // Where we are in the day, spelled out rather than left to be worked out.
  // Same principle as the ready-made calendar below: what can be read from a
  // table is not counted, and a model that does not compare two clock times does
  // not get the time wrong (§7.1).
  const current = currentMoment(ctx.moments, ctx.nowMinutes);
  const previous = lastEndedSlot(ctx.moments, {
    todayISO: ctx.today,
    minutes: ctx.nowMinutes,
  });
  const upcoming = nextSlot(ctx.moments, {
    todayISO: ctx.today,
    minutes: ctx.nowMinutes,
  });
  const dayOf = (dateISO: string) =>
    dateISO === ctx.today ? "" : dateISO < ctx.today ? " (hier)" : " (demain)";

  const situation = [
    current
      ? `Nous sommes dans le créneau du ${current.label}.`
      : "Nous sommes entre deux repas : aucun créneau n'est en cours.",
    previous
      ? `Le dernier repas terminé est le ${previous.moment.label}${dayOf(previous.dateISO)}.`
      : "Aucun repas n'est encore terminé.",
    upcoming
      ? `Le prochain est le ${upcoming.moment.label}${dayOf(upcoming.dateISO)}.`
      : "Il ne reste aucun repas devant nous.",
  ].join("\n");

  return `# Maintenant

Nous sommes le ${DAY_FORMAT.format(new Date(`${ctx.today}T12:00:00`))} (${ctx.today}), il est ${ctx.now.slice(11, 16)}.

${situation}

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
