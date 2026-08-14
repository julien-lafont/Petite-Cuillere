import {
  METHOD_COLUMN,
  MethodBigLink,
  MethodChips,
  MethodFacts,
  MethodFinalCta,
  MethodHeader,
  MethodMedical,
  MethodRule,
  MethodSources,
  MethodSwitch,
  MethodTakeaway,
  MethodToc,
  type Source,
} from "@/components/method-page";

/**
 * Corps de la page « Comment le programme est construit ».
 *
 * Comme son pendant allergènes, il est partagé par deux routes, parce qu'elles
 * ne se lisent pas dans les mêmes conditions (cf. `src/lib/routes.ts`) :
 *
 *   /decouvrir/methode-diversification-alimentaire
 *                           visiteur sans compte — prérendue, donc préchargée
 *                           en entier et ouverte sans aucun aller-retour ;
 *   /methode                lecteur connecté — rendue à la demande, dans la
 *                           coquille de l'app, avec le prénom de l'enfant.
 *
 * Tout ce qui varie entre les deux passe par les props : le reste du texte est
 * identique, et doit le rester — c'est la même page aux yeux du lecteur.
 */

/** Titre et description, partagés par les deux routes pour ne pas diverger. */
export const DIVERSIFICATION_SEO = {
  title: "Comment le programme est construit",
  ogTitle: "Comment le programme de diversification est construit",
  description:
    "L'ordre des aliments, l'ouverture des repas, l'âge des morceaux : les six règles qui construisent le programme de diversification, et les recommandations publiées sur lesquelles elles reposent.",
};

const SOURCES: Source[] = [
  {
    label: "Cabinet de pédiatrie de l'Aiguelongue",
    detail:
      "Le calendrier suivi à la lettre : ordre des légumes, arrivée des fruits, quantités.",
    href: "https://sites.google.com/site/cabinetpediatrieaiguelongue/alimentation",
  },
  {
    label: "PNNS 4 — recommandations 2022",
    detail:
      "Le cadre français officiel : quand commencer, dans quel ordre, sans sel ni sucre.",
    href: "https://www.mangerbouger.fr/ressources-pros/ressources-documents-mooc-liens-utiles/professionnels-de-sante/introduire-les-allergenes-alimentaires-des-4-6-mois",
  },
  {
    label: "ESPGHAN — position officielle (2017)",
    detail:
      "La société européenne de gastro-entérologie pédiatrique : textures, fer, âges limites.",
    href: "https://www.espghan.org/dam/jcr:3d960daa-e2f3-499f-9df9-2da682976cec/2017%20Complementary_Feeding__A_Position_Paper_by_the.21.pdf",
  },
  {
    label: "Coulthard & coll., 2009 — cohorte ALSPAC",
    detail:
      "L'étude britannique qui a suivi les enfants jusqu'à 7 ans et fixé la fenêtre des morceaux.",
    href: "https://pubmed.ncbi.nlm.nih.gov/19161546/",
  },
  {
    label: "Cohorte française ELFE, 2024",
    detail:
      "18 000 enfants suivis : l'âge des premiers morceaux et le développement à 3 ans.",
    href: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11481772/",
  },
  {
    label: "Organisation mondiale de la santé",
    detail: "Le nombre de repas par jour selon l'âge.",
    href: "https://www.who.int/fr/news-room/fact-sheets/detail/infant-and-young-child-feeding",
  },
];

/** Les sept premiers légumes, dans l'ordre exact du guide pédiatrique suivi. */
const FIRST_VEGETABLES = [
  { text: "🥕 Carotte" },
  { text: "🌿 Épinard" },
  { text: "🫛 Haricot vert" },
  { text: "🥒 Courgette" },
  { text: "🎃 Courge" },
  { text: "🟠 Potiron" },
  { text: "🥬 Blanc de poireau" },
];

const MEAL_ORDER = [
  { text: "☀️ Midi", detail: "en premier" },
  { text: "🍎 Goûter", detail: "quinze jours après" },
  { text: "🌙 Dîner", detail: "vers 8 ou 9 mois" },
];

/**
 * Les six règles en version courte. Chaque entrée est la troncature de son
 * titre complet, jamais une reformulation : le parent doit reconnaître la règle
 * en arrivant dessus, sans se demander s'il a atterri au bon endroit.
 */
const TOC = [
  { href: "#regle-1", label: "La diversification adaptée à son âge" },
  { href: "#regle-2", label: "Une nouveauté tous les deux jours" },
  { href: "#regle-3", label: "Les légumes d'abord, dans un ordre précis" },
  { href: "#regle-4", label: "Les temps de repas évoluent" },
  { href: "#regle-5", label: "Les textures suivent son âge" },
  { href: "#regle-6", label: "Les allergènes introduits tôt" },
];

export function MethodDiversificationContent({
  name,
  il,
  allergenesHref,
}: {
  /** Prénom de l'enfant, ou « votre enfant » pour un lecteur sans compte. */
  name: string;
  /** Pronom sujet accordé au sexe de l'enfant, « il » par défaut. */
  il: string;
  /** Vers la page allergènes : la publique ou celle de l'app, selon le lecteur. */
  allergenesHref: string;
}) {
  return (
    <div className={`${METHOD_COLUMN} space-y-10 pb-4`}>
      <MethodSwitch current="methode" otherHref={allergenesHref} />

      <MethodHeader
        eyebrow="La méthode, première partie"
        title={`Comment le programme de ${name} est construit`}
      >
        Vous n'avez rien à calculer : chaque repas proposé découle de{" "}
        <strong>six règles simples</strong>, toutes tirées de recommandations
        publiées. Les voici, en entier, avec leurs sources.
      </MethodHeader>

      {/*
       * Trois repères, trois questions différentes : dans quel ordre, quand la
       * texture change, et est-ce que je le nourris assez. Les deux premiers
       * repères disaient auparavant la même chose deux fois (« 1 nouveauté tous
       * les deux jours » et « 2 jours pour adopter un aliment ») — un chiffre
       * qui répète le précédent n'est plus un repère.
       *
       * Chacun est repris tel quel plus bas : règle 3 pour les quatorze jours,
       * règle 5 pour la fenêtre des morceaux, règle 4 pour le lait. Un chiffre
       * mis en avant ici sans être expliqué dans le corps de la page serait
       * exactement le genre d'affirmation que ces pages sont censées éviter.
       */}
      <MethodFacts
        facts={[
          { value: "14 jours", label: "de légumes avant le premier fruit" },
          { value: "8 à 10 mois", label: "la fenêtre des morceaux" },
          { value: "500 à 750 mL", label: "de lait par jour, en plus" },
        ]}
      />

      <MethodToc title="Les six règles" items={TOC} />

      <div>
        <MethodRule
          id="regle-1"
          step={1}
          title="La diversification s'adapte à son âge et à son avancement"
        >
          <p>
            Un bébé de sept mois qui a goûté sa première carotte la semaine
            dernière n'en est pas au même point qu'un bébé du même âge qui mange
            à la cuillère depuis trois mois. Le programme regarde donc les deux.
          </p>
          <p>
            Si {name} a commencé tard, ses premières semaines avancent
            tranquillement, un seul repas par jour et un légume à la fois, puis
            tout rejoint le rythme de son âge en un mois et demi environ.
          </p>
          <MethodTakeaway>
            Trois choses restent calées sur son âge réel, car elles ont un vrai
            rendez-vous : les textures, les allergènes, et l'arrivée de la
            viande ou du poisson (le fer, vers 6 mois).
          </MethodTakeaway>
        </MethodRule>

        <MethodRule
          id="regle-2"
          step={2}
          title="Une nouveauté tous les deux jours"
        >
          <p>
            Chaque nouvel aliment est proposé deux jours de suite : le temps de
            voir comment {name} le tolère, et de savoir à quel aliment attribuer
            un refus. C'est aussi une deuxième chance, car ce qui est boudé un
            jour passe très bien le lendemain.
          </p>
          <MethodTakeaway>
            Il faut parfois une dizaine de rencontres avant qu'un aliment soit
            adopté. Le reproposer quelques jours plus tard, sans insister sur le
            moment, marche bien mieux que d'y renoncer.
          </MethodTakeaway>
        </MethodRule>

        <MethodRule
          id="regle-3"
          step={3}
          title="Les légumes d'abord, dans un ordre précis"
        >
          <p>
            Sept légumes, deux jours chacun : quatorze jours. C'est l'ordre
            exact du guide pédiatrique que nous suivons.
          </p>
          <MethodChips
            label="Ordre des sept premiers légumes"
            items={FIRST_VEGETABLES}
          />
          <p>
            Les fruits arrivent <strong>ensuite, jamais avant</strong> : goûtés
            en premier, leur douceur rend les légumes bien plus difficiles à
            faire aimer. Viennent après les légumes moins courants, brocoli,
            panais, petits pois, puis les goûts plus affirmés, chou ou navet,
            quand {il} a déjà de quoi comparer.
          </p>
        </MethodRule>

        <MethodRule
          id="regle-4"
          step={4}
          title="De plus en plus de repas solides chaque semaine"
        >
          <p>
            Le midi en premier, avec un légume seul. Vers cinq mois et demi, une
            petite protéine : 10 g, soit deux cuillères à café. À six mois, un
            féculent et une cuillère d'huile. Le goûter accueille les fruits une
            quinzaine de jours après le premier légume, et le dîner attend huit
            ou neuf mois.
          </p>
          <MethodChips label="Ordre d'arrivée des repas" items={MEAL_ORDER} />
          <MethodTakeaway>
            Rien ne presse : pendant toute cette période, le lait reste le vrai
            repas, 500 à 750 mL par jour, repas solides compris. L'OMS compte 2
            à 3 repas solides par jour entre 6 et 8 mois, puis 3 à 4 ensuite.
          </MethodTakeaway>
        </MethodRule>

        <MethodRule
          id="regle-5"
          step={5}
          title="Les textures suivent son âge, pas sa date de démarrage"
        >
          <p>
            Trois étapes, et rien d'autre : <strong>lisse</strong> jusqu'à huit
            mois, <strong>écrasé à la fourchette</strong> entre huit et dix
            mois, puis <strong>de petits morceaux fondants</strong>.
          </p>
          <p>
            C'est le seul point du programme qui ne s'adapte pas à la date de
            démarrage, et c'est volontaire :{" "}
            <strong>
              entre huit et dix mois, {il} apprend à mâcher plus facilement qu'à
              n'importe quel autre moment
            </strong>
            . Deux grandes études le confirment, une cohorte britannique suivie
            jusqu'à sept ans et une cohorte française de 18 000 enfants : les
            enfants qui découvrent les morceaux dans cette fenêtre mangent
            ensuite plus varié, fruits et légumes compris.
          </p>
          {/*
           * Tournure sans sujet en tête de phrase : `name` vaut « votre enfant »
           * pour un visiteur, et une minuscule après un point d'interrogation
           * passerait pour une faute.
           */}
          <MethodTakeaway>
            Après un démarrage tardif, quelques jours en purée lisse suffisent à
            prendre ses marques, avant de retrouver la texture de son âge. C'est
            prévu, et vous n'avez rien à surveiller.
          </MethodTakeaway>
        </MethodRule>

        <MethodRule
          id="regle-6"
          step={6}
          title="Les allergènes arrivent tôt et reviennent chaque semaine"
        >
          <p>
            C'est la question qui revient le plus, et elle mérite sa propre page
            : les 16 allergènes, chacun à sa période idéale, un seul à la fois,
            puis entretenus semaine après semaine.
          </p>
          <MethodBigLink
            href={allergenesHref}
            title="Comment les allergènes sont introduits"
            description="Pourquoi tôt, à quelle dose, et pourquoi il faut continuer après la première cuillère."
            cta="Lire le protocole"
          />
        </MethodRule>
      </div>

      <MethodMedical title="Votre médecin a toujours le dernier mot">
        Ce programme applique des recommandations générales à ce que vous nous
        avez indiqué. Il ne connaît ni le poids de {name}, ni ses antécédents,
        ni ce que votre médecin vous a dit. Reflux, allergie connue, croissance
        qui vous interroge, ou simplement une question qui revient : c'est
        toujours l'avis d'un professionnel de santé qui prime sur le nôtre.
      </MethodMedical>

      <MethodSources
        sources={SOURCES}
        intro="Chaque règle ci-dessus renvoie à un texte publié. Les voici, avec ce qu'on en a tiré."
      />

      <MethodFinalCta
        title="La méthode vous parle ? Voyez-la appliquée à votre bébé."
        description="Sa date de naissance, où il en est, et son calendrier complet s'affiche. Gratuit, sans compte."
      />
    </div>
  );
}
