import {
  METHOD_COLUMN,
  MethodBigLink,
  MethodFacts,
  MethodFinalCta,
  MethodHandoff,
  MethodHeader,
  MethodMedical,
  MethodProof,
  MethodProtocol,
  MethodRule,
  MethodSources,
  MethodTakeaway,
  type Crumb,
  type Source,
} from "@/components/method-page";
import type { AllergenRow } from "@/lib/data/allergens";
import { cn } from "@/lib/utils";

/**
 * Corps de la page « Comment les allergènes sont introduits ».
 *
 * Il est partagé par deux routes, parce qu'elles ne se lisent pas dans les
 * mêmes conditions (cf. `src/lib/routes.ts`) :
 *
 *   /decouvrir/introduction-allergenes
 *                           visiteur sans compte — prérendue, donc préchargée
 *                           en entier et ouverte sans aucun aller-retour ;
 *   /methode/allergenes     lecteur connecté — rendue à la demande, dans la
 *                           coquille de l'app, avec le prénom de l'enfant.
 *
 * Tout ce qui varie entre les deux passe par les props : le reste du texte est
 * identique, et doit le rester — c'est la même page aux yeux du lecteur.
 */

/** Titre et description, partagés par les deux routes pour ne pas diverger. */
export const ALLERGENES_SEO = {
  title: "Comment les allergènes sont introduits",
  ogTitle: "Comment les allergènes sont introduits chez le nourrisson",
  description:
    "Pourquoi introduire les allergènes tôt, à quelle dose, et pourquoi il faut continuer après la première cuillère. Le protocole suivi par Petite Cuillère et les études qui le fondent.",
};

const SOURCES: Source[] = [
  {
    label: "Étude LEAP, 2015",
    detail:
      "L'essai qui a renversé la doctrine : donner de l'arachide tôt divise le risque d'allergie.",
    href: "https://www.nejm.org/doi/full/10.1056/NEJMoa1508749",
  },
  {
    label: "Étude EAT, 2016",
    detail:
      "1 300 nourrissons, six allergènes introduits dès 3 mois — d'où vient la dose de 2 g par semaine.",
    href: "https://www.nejm.org/doi/full/10.1056/NEJMoa1514210",
  },
  {
    label: "PNNS / Manger Bouger",
    detail:
      "La position française : introduire les allergènes dès 4 à 6 mois, à risque ou non.",
    href: "https://www.mangerbouger.fr/ressources-pros/ressources-documents-mooc-liens-utiles/professionnels-de-sante/introduire-les-allergenes-alimentaires-des-4-6-mois",
  },
  {
    label: "La Revue du Praticien — arachide et fruits à coque",
    detail:
      "Les modalités pratiques : une cuillère à café, quatre fois par semaine.",
    href: "https://www.larevuedupraticien.fr/exercice/quand-et-comment-introduire-larachide-et-les-fruits-coque-chez-le-nourrisson",
  },
  {
    label: "CICBAA — allergies alimentaires de l'enfant en France",
    detail:
      "Quels allergènes touchent réellement les enfants, et à quelle fréquence.",
    href: "https://www.afpral.fr/articles/84381-cicbaa",
  },
  {
    label: "Société canadienne de pédiatrie",
    detail: "La conduite à tenir chez un nourrisson à risque élevé.",
    href: "https://cps.ca/fr/documents/position/allergenes-solides",
  },
];

/**
 * Émoji d'illustration par allergène du catalogue commun. Il ne porte aucune
 * information — le nom est écrit à côté — d'où l'absence de repli : un
 * allergène ajouté par un foyer s'affiche simplement sans vignette.
 */
const ALLERGEN_EMOJI: Record<string, string> = {
  Arachide: "🥜",
  Œuf: "🥚",
  "Lait de vache": "🥛",
  Gluten: "🌾",
  Poisson: "🐟",
  Sésame: "🌱",
  Noisette: "🌰",
  Amande: "🌰",
  Noix: "🌰",
  "Noix de cajou": "🌰",
  Pistache: "🌰",
  Moutarde: "🟡",
  Soja: "🫘",
  "Fruits de mer": "🦐",
  Sarrasin: "🌾",
  Kiwi: "🥝",
};

export function MethodAllergenesContent({
  name,
  trail,
  allergens,
  methodeHref,
}: {
  /** Prénom de l'enfant, ou « votre enfant » pour un lecteur sans compte. */
  name: string;
  trail: Crumb[];
  allergens: AllergenRow[];
  /** Vers la page méthode : la publique ou celle de l'app, selon le lecteur. */
  methodeHref: string;
}) {
  // Le compte affiché est celui du catalogue réel, pas un chiffre écrit en dur :
  // ajouter un allergène doit se voir ici sans qu'on y touche.
  const planned = allergens.filter(
    (a) => a.window_start_months !== null && a.intro_order !== null,
  );
  const total = planned.length;
  const earlyOnes = planned
    .filter((a) => a.evidence_level === "rct")
    .map((a) => a.name.toLowerCase());
  const earlyList =
    earlyOnes.length > 1
      ? `${earlyOnes.slice(0, -1).join(", ")} et ${earlyOnes[earlyOnes.length - 1]}`
      : (earlyOnes[0] ?? "l'arachide, l'œuf et le lait de vache");

  return (
    <div className={`${METHOD_COLUMN} space-y-10 pb-4`}>
      <MethodHeader
        trail={trail}
        eyebrow="La méthode, seconde partie"
        title="Comment les allergènes sont introduits"
      >
        C'est la question qui revient le plus souvent, et celle sur laquelle les
        conseils ont le plus changé en dix ans. La bonne nouvelle :{" "}
        <strong>
          ce qu'on recommande aujourd'hui est plus simple qu'avant
        </strong>
        . Voici ce que nous faisons, et sur quoi nous nous appuyons.
      </MethodHeader>

      <MethodFacts
        facts={[
          { value: String(total), label: "allergènes déjà planifiés" },
          { value: "4 à 12 mois", label: "la bonne période" },
          {
            value: "2 fois par semaine",
            label: "pour entretenir la tolérance",
          },
        ]}
      />

      <div>
        <MethodRule id="tot" step={1} title="Plus tôt on commence, mieux c'est">
          <p>
            Pendant longtemps, on conseillait de retarder les aliments
            allergisants pour protéger l'enfant. On sait aujourd'hui que c'est
            l'inverse :{" "}
            <strong>
              les proposer tôt protège, et attendre ne protège de rien
            </strong>
            . C'est l'un des rares sujets d'alimentation infantile où la réponse
            est aussi nette.
          </p>
          <MethodProof
            value="2,4 %"
            source="Étude EAT, 1 300 nourrissons suivis. L'essai LEAP avait montré le même effet pour l'arachide."
          >
            d'enfants allergiques à un an quand les six aliments allergisants
            sont mangés tôt et régulièrement, contre <strong>7,3 %</strong> chez
            ceux qui les avaient évités.
          </MethodProof>
          <MethodTakeaway>
            La bonne période va de 4 à 12 mois, ce qui laisse largement le
            temps. Le programme place {earlyList} au plus tôt, une petite
            semaine après les premières cuillères de légume.
          </MethodTakeaway>
        </MethodRule>

        <MethodRule
          id="seize"
          step={2}
          title={`${total} allergènes, tous introduits avant un an`}
        >
          <p>
            Pas seulement les plus connus. Chaque allergène a sa période
            conseillée, et le calendrier est construit à rebours de ces dates :
            c'est ce qui garantit qu'aucun n'est oublié en chemin. Vous n'avez
            aucune liste à cocher de votre côté.
          </p>

          <ul
            aria-label="Les allergènes planifiés par le programme"
            className="flex flex-wrap gap-2.5"
          >
            {planned.map((a) => {
              const early = a.evidence_level === "rct";
              return (
                <li
                  key={a.id}
                  className={cn(
                    "rounded-full border bg-card px-4 py-2 text-sm font-semibold",
                    early && "border-apricot bg-novelty-soft",
                  )}
                >
                  {ALLERGEN_EMOJI[a.name] && (
                    <span aria-hidden>{ALLERGEN_EMOJI[a.name]} </span>
                  )}
                  {a.name}
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-2.5 text-sm">
            <span
              aria-hidden
              className="mt-1.5 size-3 shrink-0 rounded-full border border-apricot bg-novelty-soft"
            />
            <span>
              Ceux dont le bénéfice d'une introduction précoce est démontré par
              essai clinique. Ce sont eux qui ouvrent le calendrier.
            </span>
          </p>

          <MethodTakeaway>
            Les fruits à coque comptent séparément, noisette, amande, noix, noix
            de cajou et pistache, parce que bien tolérer l'un ne dit rien des
            autres. Et la liste inclut la moutarde, le kiwi et le sarrasin : des
            allergies fréquentes chez l'enfant en France, souvent absentes des
            listes venues de l'étranger.
          </MethodTakeaway>
        </MethodRule>

        <MethodRule
          id="dose"
          step={3}
          title="Une pointe, puis la dose, puis la régularité"
        >
          <MethodProtocol
            steps={[
              { icon: "🤏", title: "Jour 1", detail: "une pointe de cuillère" },
              { icon: "🥄", title: "Jour 2", detail: "la dose complète" },
              {
                icon: "🔁",
                title: "Ensuite",
                detail: "2 fois par semaine, en continu",
              },
            ]}
          />
          <p>
            Et ensuite, c'est le point que presque tout le monde oublie,{" "}
            <strong>il faut en redonner régulièrement</strong>. Environ 2 g de
            protéine par semaine suffisent à entretenir la tolérance : deux
            cuillères à café de beurre de cacahuète, un tiers d'œuf dur, ou 10 g
            de poisson. En France, on le formule ainsi : une petite cuillère à
            café, quatre fois par semaine.
          </p>
          <MethodTakeaway>
            C'est la régularité qui protège, pas la première cuillère. Le
            programme replace chaque allergène deux fois par semaine sans que
            vous ayez à y penser. Beaucoup s'entretiennent d'ailleurs tout seuls
            une fois devenus des aliments du quotidien, le lait, le blé, l'œuf,
            le poisson ; les autres reviennent en rotation, sous forme d'une
            cuillère d'oléagineux au goûter.
          </MethodTakeaway>
        </MethodRule>

        <MethodRule
          id="unseul"
          step={4}
          title="Un seul à la fois, et plutôt le matin"
        >
          <p>
            Deux nouveaux allergènes ne sont jamais proposés le même jour, et
            trois jours séparent chaque introduction : si une réaction survient,
            vous savez tout de suite à quel aliment la rattacher. Les doses sont
            placées le matin ou le midi, pour que les heures qui suivent se
            passent en pleine journée, quand vous êtes là.
          </p>
          <MethodTakeaway>
            Faites en sorte que la bouche découvre l'aliment avant la peau : un
            contact cutané qui précède la première dégustation favorise
            l'allergie plutôt qu'il ne l'évite. C'est d'ailleurs une des raisons
            pour lesquelles on introduit tôt.
          </MethodTakeaway>
        </MethodRule>

        <MethodRule
          id="passe-la-main"
          step={5}
          title="Trois situations où votre médecin décide, pas nous"
        >
          <p>
            Sur ces trois points, le programme ne choisit pas à votre place. Il
            vous le dit clairement, et passe la main.
          </p>
          <MethodHandoff
            cases={[
              {
                title: "Une réaction déjà signalée",
                body: "L'aliment est retiré du programme, ainsi que tout ce qui en contient. Il n'est plus proposé.",
              },
              {
                title: "Eczéma sévère ou allergie à l'œuf connue",
                body: `L'arachide n'est pas planifiée pour ${name} : elle s'introduit après un avis médical.`,
              },
              {
                title: "Diversification très tardive",
                body: "Il ne reste pas la place pour espacer toutes les introductions comme il faudrait. Le programme place les plus importantes et vous invite à voir le reste avec votre médecin.",
              },
            ]}
          />
        </MethodRule>
      </div>

      <MethodMedical title="Ces repères ne remplacent pas un avis médical">
        Ils sont ceux des recommandations publiées, appliqués à ce que vous nous
        avez indiqué. Antécédent familial marqué, eczéma, ou doute sur une
        réaction déjà observée : parlez-en à votre médecin ou à un allergologue
        avant de suivre ce calendrier. Et un aliment qui a déjà provoqué une
        réaction ne se réintroduit <strong>jamais</strong> sans accompagnement
        médical.
      </MethodMedical>

      <MethodBigLink
        href={methodeHref}
        title="Et le reste du programme ?"
        description="L'ordre des aliments, l'ouverture des repas, l'âge des premiers morceaux."
        cta="Lire la méthode complète"
      />

      <MethodSources
        sources={SOURCES}
        intro="Chaque règle ci-dessus renvoie à un texte publié. Les voici, avec ce qu'on en a tiré."
      />

      <MethodFinalCta
        title={`Les ${total} allergènes, placés au bon moment dans son calendrier`}
        description="Sa date de naissance, où il en est, et le protocole s'applique tout seul, repas après repas. Gratuit, sans compte."
      />
    </div>
  );
}
