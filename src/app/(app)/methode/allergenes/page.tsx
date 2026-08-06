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
        intro={`C'est la partie du programme qui inquiète le plus, et celle où les conseils ont le plus changé ces dix dernières années. Voici exactement ce que nous faisons, et sur quoi nous nous appuyons.`}
        backHref="/allergenes"
        backLabel="Retour aux allergènes"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MethodFigure
          value={String(total)}
          label="allergènes, tous programmés"
        />
        <MethodFigure value="12 mois" label="la date limite, sans exception" />
        <MethodFigure value="2 fois" label="par semaine, ensuite, à vie" />
      </div>

      <div className="space-y-7">
        <MethodSection step={1} title="Tôt, et non plus tard">
          <p>
            Pendant longtemps on conseillait de retarder les aliments
            allergisants pour protéger l'enfant. C'est l'inverse qui est vrai,
            et c'est démontré : retarder n'a aucun effet protecteur, et pour
            l'arachide et l'œuf, cela augmente le risque.
          </p>
          <MethodEvidence>
            Dans l'étude EAT, 7,3 % des enfants ayant évité les six aliments
            allergisants ont développé une allergie à un an, contre 2,4 % de
            ceux qui les ont consommés tôt et régulièrement. L'essai LEAP avait
            montré le même effet pour l'arachide seule.
          </MethodEvidence>
          <p>
            La fenêtre utile va de 4 à 12 mois. Le programme place donc{" "}
            {earlyList} le plus tôt possible, dès que {name} a une petite
            semaine d'alimentation solide derrière soi.
          </p>
        </MethodSection>

        <MethodSection
          step={2}
          title={`Les ${total}, tous, avant le premier anniversaire`}
        >
          <p>
            Pas seulement les plus connus. Chaque allergène a une période
            conseillée, et le programme construit son calendrier{" "}
            <strong>à rebours</strong> de la date limite de chacun, pour
            qu'aucun ne se retrouve laissé de côté.
          </p>
          <p>
            Les fruits à coque sont comptés séparément — noisette, amande, noix,
            noix de cajou, pistache — parce que bien tolérer l'un ne dit rien de
            l'autre. Et la liste comprend la moutarde, le kiwi et le sarrasin,
            qui figurent parmi les allergies les plus fréquentes chez l'enfant
            en France et manquent à la plupart des listes venues de l'étranger.
          </p>
        </MethodSection>

        <MethodSection
          step={3}
          title="Une pointe, puis la dose, puis l'entretien"
        >
          <p>
            Le premier jour, une pointe de cuillère seulement. Le lendemain, la
            dose complète. Ensuite, et c'est le point que presque tout le monde
            oublie : il faut continuer.
          </p>
          <MethodEvidence>
            Environ <strong>2 g de protéine par semaine</strong> suffisent à
            entretenir la tolérance — soit deux cuillères à café de beurre de
            cacahuète, un tiers d'œuf dur, ou 10 g de poisson. En France, la
            formulation retenue est « une petite cuillère à café quatre fois par
            semaine ». Un allergène introduit une fois puis abandonné ne protège
            pas.
          </MethodEvidence>
          <p>
            Le programme reprogramme donc chaque allergène deux fois par
            semaine, indéfiniment. Beaucoup s'entretiennent tout seuls une fois
            devenus des aliments du quotidien — le lait, le blé, l'œuf, le
            poisson. Les autres reviennent sous forme d'une cuillère
            d'oléagineux au goûter, en rotation.
          </p>
        </MethodSection>

        <MethodSection step={4} title="Un seul à la fois, jamais le soir">
          <p>
            Deux nouveaux allergènes ne sont jamais proposés le même jour, et
            trois jours séparent chaque introduction : sans cela, une réaction
            ne pourrait pas être rattachée au bon aliment. Les doses sont
            placées le matin ou le midi, pour que les heures qui suivent soient
            des heures de veille.
          </p>
          <p>
            Un conseil qui ne relève pas du programme mais qui compte : évitez
            le contact avec la peau avant le premier essai par la bouche. Un
            contact cutané précoce, avant l'introduction orale, favorise
            l'allergie plutôt qu'il ne l'évite.
          </p>
        </MethodSection>

        <MethodSection
          step={5}
          title="Quand le programme s'arrête et vous renvoie au médecin"
        >
          <p>
            Il y a trois cas où il ne décide pas seul, et vous le dit clairement
            sur cette page.
          </p>
          <ul className="ml-4 list-disc space-y-1.5 marker:text-primary">
            <li>
              Si vous nous avez signalé une réaction à un aliment, il est retiré
              du programme, lui et tout ce qui en contient. Il n'est pas
              reproposé.
            </li>
            <li>
              Si {name} a un eczéma sévère ou une allergie à l'œuf déjà connue,
              l'arachide n'est pas planifiée : dans ce cas elle s'introduit
              après un avis médical.
            </li>
            <li>
              Si la diversification commence très tard, il n'y a plus assez de
              temps pour tout espacer en sécurité. Le programme place alors les
              plus importants et vous invite à parler du reste à votre médecin —
              plutôt que d'entasser les introductions.
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
        vous nous avez indiqué. Ils ne remplacent pas un avis médical. En cas
        d'antécédent familial marqué, d'eczéma, ou de doute sur une réaction
        déjà observée, parlez-en à votre médecin ou à un allergologue avant de
        suivre ce calendrier — et n'introduisez jamais seul un aliment qui a
        déjà provoqué une réaction.
      </MethodDisclaimer>

      <MethodSources sources={SOURCES} />
    </div>
  );
}
