import type { Metadata } from "next";
import { getActiveBaby } from "@/lib/data/baby";
import { getAllergens } from "@/lib/data/allergens";
import {
  MethodCrossLink,
  MethodDisclaimer,
  MethodEvidence,
  MethodFigure,
  MethodHeader,
  MethodSection,
  MethodSources,
  type Source,
} from "@/components/method-page";

export const metadata: Metadata = {
  title: "Comment les allergènes sont introduits",
};

const SOURCES: Source[] = [
  {
    label: "Étude LEAP, 2015",
    detail:
      "l'essai qui a renversé la doctrine : donner de l'arachide tôt divise le risque d'allergie",
    href: "https://www.nejm.org/doi/full/10.1056/NEJMoa1508749",
  },
  {
    label: "Étude EAT, 2016",
    detail:
      "1 300 nourrissons, six allergènes introduits dès 3 mois — d'où vient la dose de 2 g par semaine",
    href: "https://www.nejm.org/doi/full/10.1056/NEJMoa1514210",
  },
  {
    label: "PNNS / Manger Bouger",
    detail:
      "la position française : introduire les allergènes dès 4 à 6 mois, à risque ou non",
    href: "https://www.mangerbouger.fr/ressources-pros/ressources-documents-mooc-liens-utiles/professionnels-de-sante/introduire-les-allergenes-alimentaires-des-4-6-mois",
  },
  {
    label: "La Revue du Praticien — arachide et fruits à coque",
    detail:
      "les modalités pratiques : une cuillère à café quatre fois par semaine",
    href: "https://www.larevuedupraticien.fr/exercice/quand-et-comment-introduire-larachide-et-les-fruits-coque-chez-le-nourrisson",
  },
  {
    label: "CICBAA — allergies alimentaires de l'enfant en France",
    detail:
      "quels allergènes touchent réellement les enfants ici : la moutarde y figure, pas dans les listes anglo-saxonnes",
    href: "https://www.afpral.fr/articles/84381-cicbaa",
  },
  {
    label: "Société canadienne de pédiatrie",
    detail: "la conduite à tenir chez un nourrisson à risque élevé",
    href: "https://cps.ca/fr/documents/position/allergenes-solides",
  },
];

export default async function Page() {
  const baby = await getActiveBaby();
  const name = baby?.prenom ?? "votre enfant";

  // Le compte affiché est celui du catalogue réel, pas un chiffre écrit en dur :
  // ajouter un allergène doit se voir ici sans qu'on y touche.
  const allergens = await getAllergens();
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
    <div className="max-w-2xl space-y-8 pb-4">
      <MethodHeader
        eyebrow="La méthode"
        title="Comment les allergènes sont introduits"
        intro={`C'est la question qui revient le plus souvent, et celle sur laquelle les conseils ont le plus changé en dix ans. La bonne nouvelle : ce qu'on recommande aujourd'hui est plus simple qu'avant. Voici ce que nous faisons, et sur quoi nous nous appuyons.`}
        backHref="/allergenes"
        backLabel="Retour aux allergènes"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MethodFigure value={String(total)} label="allergènes déjà planifiés" />
        <MethodFigure value="4 à 12 mois" label="la bonne période" />
        <MethodFigure value="2 fois" label="par semaine, pour entretenir" />
      </div>

      <div className="space-y-7">
        <MethodSection step={1} title="Plus tôt on commence, mieux c'est">
          <p>
            Pendant longtemps, on conseillait de retarder les aliments
            allergisants pour protéger l'enfant. On sait aujourd'hui que c'est
            l'inverse : les proposer tôt protège, et attendre ne protège de
            rien. C'est l'un des rares sujets d'alimentation infantile où la
            réponse est aussi nette.
          </p>
          <MethodEvidence>
            Dans l'étude EAT, 2,4 % des enfants ayant mangé tôt et régulièrement
            les six aliments allergisants étaient allergiques à un an, contre
            7,3 % de ceux qui les avaient évités. L'essai LEAP avait montré le
            même effet pour l'arachide.
          </MethodEvidence>
          <p>
            La bonne période va de 4 à 12 mois, ce qui laisse largement le
            temps. Le programme place {earlyList} au plus tôt, une petite
            semaine après les premières cuillères de légume.
          </p>
        </MethodSection>

        <MethodSection
          step={2}
          title={`Les ${total}, avant le premier anniversaire`}
        >
          <p>
            Pas seulement les plus connus. Chaque allergène a sa période
            conseillée, et le calendrier est construit à rebours de ces dates.
            C'est ce qui garantit qu'aucun n'est oublié en chemin — vous n'avez
            aucune liste à cocher de votre côté.
          </p>
          <p>
            Les fruits à coque comptent séparément — noisette, amande, noix,
            noix de cajou, pistache — parce que bien tolérer l'un ne dit rien
            des autres. Et la liste inclut la moutarde, le kiwi et le sarrasin :
            ce sont des allergies fréquentes chez l'enfant en France, souvent
            absentes des listes venues de l'étranger.
          </p>
        </MethodSection>

        <MethodSection
          step={3}
          title="Une pointe le premier jour, la dose le lendemain, puis on continue"
        >
          <p>
            Le premier jour, une pointe de cuillère suffit. Le lendemain, la
            dose complète. Et ensuite — c'est le point que presque tout le monde
            oublie — il faut en redonner régulièrement.
          </p>
          <MethodEvidence>
            Environ <strong>2 g de protéine par semaine</strong> suffisent à
            entretenir la tolérance : deux cuillères à café de beurre de
            cacahuète, un tiers d'œuf dur, ou 10 g de poisson. En France, on le
            formule ainsi : une petite cuillère à café quatre fois par semaine.
            C'est la régularité qui protège, pas la première cuillère.
          </MethodEvidence>
          <p>
            Le programme replace donc chaque allergène deux fois par semaine,
            sans que vous ayez à y penser. Beaucoup s'entretiennent d'ailleurs
            tout seuls une fois devenus des aliments du quotidien — le lait, le
            blé, l'œuf, le poisson. Les autres reviennent en rotation, sous
            forme d'une cuillère d'oléagineux au goûter.
          </p>
        </MethodSection>

        <MethodSection step={4} title="Un seul à la fois, et plutôt le matin">
          <p>
            Deux nouveaux allergènes ne sont jamais proposés le même jour, et
            trois jours séparent chaque introduction : si une réaction survient,
            vous savez tout de suite à quel aliment la rattacher. Et les doses
            sont placées le matin ou le midi, pour que les heures qui suivent se
            passent en pleine journée, quand vous êtes là.
          </p>
          <p>
            Un dernier point, qui ne dépend pas du programme : faites en sorte
            que la <strong>bouche découvre l'aliment avant la peau</strong>. Un
            contact cutané qui précède la première dégustation favorise
            l'allergie plutôt qu'il ne l'évite — c'est d'ailleurs une des
            raisons pour lesquelles on introduit tôt.
          </p>
        </MethodSection>

        <MethodSection
          step={5}
          title="Les trois cas où le programme passe la main"
        >
          <p>
            Sur trois points, il ne décide pas seul — et il vous le dit
            clairement plutôt que de choisir à votre place.
          </p>
          <ul className="ml-4 list-disc space-y-1.5 marker:text-primary">
            <li>
              Si vous nous avez signalé une réaction à un aliment, il est retiré
              du programme, ainsi que tout ce qui en contient. Il n'est plus
              proposé.
            </li>
            <li>
              Si {name} a un eczéma sévère ou une allergie à l'œuf déjà connue,
              l'arachide n'est pas planifiée : elle s'introduit après un avis
              médical.
            </li>
            <li>
              Si la diversification commence très tard, il ne reste pas la place
              pour espacer toutes les introductions comme il faudrait. Le
              programme place alors les plus importantes et vous invite à voir
              le reste avec votre médecin.
            </li>
          </ul>
        </MethodSection>
      </div>

      <MethodCrossLink
        href="/methode"
        label="Et le reste du programme ?"
        description="L'ordre des aliments, l'ouverture des repas, les textures"
      />

      <MethodDisclaimer>
        Ces repères sont ceux des recommandations publiées, appliqués à ce que
        vous nous avez indiqué. Ils ne remplacent pas un avis médical.
        Antécédent familial marqué, eczéma, ou doute sur une réaction déjà
        observée : parlez-en à votre médecin ou à un allergologue avant de
        suivre ce calendrier. Et un aliment qui a déjà provoqué une réaction ne
        se réintroduit jamais sans accompagnement médical.
      </MethodDisclaimer>

      <MethodSources sources={SOURCES} />
    </div>
  );
}
