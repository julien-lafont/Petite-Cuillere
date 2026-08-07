import type { Metadata } from "next";
import { getActiveBaby } from "@/lib/data/baby";
import { subjectPronoun } from "@/lib/sexe";
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
  title: "Comment le programme est construit",
};

const SOURCES: Source[] = [
  {
    label: "Cabinet de pédiatrie de l'Aiguelongue",
    detail:
      "le calendrier suivi à la lettre : ordre des légumes, arrivée des fruits, quantités",
    href: "https://sites.google.com/site/cabinetpediatrieaiguelongue/alimentation",
  },
  {
    label: "PNNS 4 — recommandations 2022",
    detail:
      "le cadre français officiel : quand commencer, dans quel ordre, sans sel ni sucre",
    href: "https://www.mangerbouger.fr/ressources-pros/ressources-documents-mooc-liens-utiles/professionnels-de-sante/introduire-les-allergenes-alimentaires-des-4-6-mois",
  },
  {
    label: "ESPGHAN — position officielle sur la diversification (2017)",
    detail:
      "la société européenne de gastro-entérologie pédiatrique : textures, fer, âges limites",
    href: "https://www.espghan.org/dam/jcr:3d960daa-e2f3-499f-9df9-2da682976cec/2017%20Complementary_Feeding__A_Position_Paper_by_the.21.pdf",
  },
  {
    label: "Coulthard & coll., 2009 — cohorte britannique ALSPAC",
    detail:
      "l'étude qui a suivi les enfants jusqu'à 7 ans et a fixé la limite des morceaux",
    href: "https://pubmed.ncbi.nlm.nih.gov/19161546/",
  },
  {
    label: "Cohorte française ELFE, 2024",
    detail:
      "18 000 enfants suivis : l'âge des premiers morceaux et le développement à 3 ans",
    href: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11481772/",
  },
  {
    label: "Organisation mondiale de la santé",
    detail: "le nombre de repas par jour selon l'âge",
    href: "https://www.who.int/fr/news-room/fact-sheets/detail/infant-and-young-child-feeding",
  },
];

export default async function Page() {
  const baby = await getActiveBaby();
  const name = baby?.prenom ?? "votre enfant";
  const il = subjectPronoun(baby?.sexe);

  return (
    <div className="max-w-2xl space-y-8 pb-4">
      <MethodHeader
        eyebrow="La méthode"
        title={`Comment le programme de ${name} est construit`}
        intro={`Vous n'avez rien à calculer : chaque repas proposé découle de six règles simples, toutes tirées de recommandations publiées. Les voici, en entier.`}
        backHref="/aliments"
        backLabel="Retour aux aliments"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MethodFigure value="1 nouveauté" label="tous les deux jours" />
        <MethodFigure value="2 jours" label="pour adopter un aliment" />
        <MethodFigure value="avant 10 mois" label="les premiers morceaux" />
      </div>

      <div className="space-y-7">
        <MethodSection
          step={1}
          title={`Deux choses comptent : son âge, et depuis quand ${il} mange`}
        >
          <p>
            L'âge de {name} ne dit pas tout. Un bébé de sept mois qui a goûté sa
            première carotte la semaine dernière n'en est pas au même point
            qu'un bébé du même âge qui mange à la cuillère depuis trois mois. Le
            programme regarde donc les deux.
          </p>
          <p>
            Si {name} a commencé tard, les premières semaines avancent
            tranquillement — un seul repas par jour, un légume à la fois — puis
            tout se remet au rythme de son âge en un mois et demi environ. Trois
            choses restent en revanche calées sur son âge, parce qu'elles ont un
            vrai rendez-vous : les textures, les allergènes, et l'arrivée de la
            viande ou du poisson, dont {name} a besoin pour le fer vers six
            mois. Le programme s'en charge sans que vous ayez à y penser.
          </p>
        </MethodSection>

        <MethodSection step={2} title="Une nouveauté tous les deux jours">
          <p>
            Chaque nouvel aliment est proposé deux jours de suite. Deux jours,
            c'est ce qu'il faut pour voir comment {name} le tolère et pour
            savoir à quel aliment attribuer un refus. C'est aussi une deuxième
            chance : ce qui est boudé un jour passe très bien le lendemain.
          </p>
          <MethodEvidence>
            Il faut parfois une dizaine de rencontres avec un aliment avant
            qu'il soit adopté. Le reproposer quelques jours plus tard, sans
            insister sur le moment, marche bien mieux que d'y renoncer.
          </MethodEvidence>
        </MethodSection>

        <MethodSection
          step={3}
          title="Les légumes d'abord, dans un ordre précis"
        >
          <p>
            Carotte, épinard, haricot vert, courgette, courge, potiron, blanc de
            poireau. Sept légumes, deux jours chacun : quatorze jours. C'est
            exactement l'ordre du guide pédiatrique que nous suivons, et c'est
            au bout de ces deux semaines qu'il ouvre les fruits.
          </p>
          <p>
            Les fruits arrivent donc ensuite, jamais avant : goûtés en premier,
            leur douceur rend les légumes bien plus difficiles à faire aimer.
            Viennent après les légumes moins courants — brocoli, panais, petits
            pois — puis les goûts plus affirmés, chou ou navet, quand {name} a
            déjà de quoi comparer.
          </p>
        </MethodSection>

        <MethodSection step={4} title="Les repas s'ouvrent un par un">
          <p>
            Le midi en premier, avec un légume seul. Vers cinq mois et demi, une
            petite protéine : dix grammes, soit deux cuillères à café. À six
            mois, un féculent et une cuillère d'huile. Le goûter accueille les
            fruits une quinzaine de jours après le premier légume, et le dîner
            attend huit ou neuf mois. Rien ne presse : pendant toute cette
            période, le lait reste le vrai repas.
          </p>
          <MethodEvidence>
            L'OMS compte deux à trois repas solides par jour entre 6 et 8 mois,
            puis trois à quatre ensuite. Le lait, lui, reste la base : 500 à
            750 mL par jour, repas solides compris.
          </MethodEvidence>
        </MethodSection>

        <MethodSection
          step={5}
          title={`Les textures avancent avec l'âge de ${name}`}
        >
          <p>
            Lisse jusqu'à huit mois, écrasé à la fourchette entre huit et dix
            mois, puis de petits morceaux fondants. C'est le seul point du
            programme qui ne s'adapte pas à la date de démarrage, et c'est
            volontaire : entre huit et dix mois, {il} apprend à mâcher plus
            facilement qu'à n'importe quel autre moment.
          </p>
          <MethodEvidence>
            Deux grandes études le confirment : une cohorte britannique suivie
            jusqu'à sept ans, et une cohorte française de 18 000 enfants. Les
            enfants qui découvrent les morceaux dans cette période mangent
            ensuite plus varié, fruits et légumes compris.
          </MethodEvidence>
          <p>
            Si {name} a commencé tard, {il} passera donc quelques jours en purée
            lisse, le temps de prendre ses marques, avant de retrouver la
            texture de son âge. C'est prévu, et vous n'avez rien à surveiller.
          </p>
        </MethodSection>
      </div>

      <MethodCrossLink
        href="/methode/allergenes"
        label="Et les allergènes ?"
        description="Pourquoi tôt, à quelle dose, et pourquoi il faut continuer après"
      />

      <MethodDisclaimer>
        Ce programme applique des recommandations générales à ce que vous nous
        avez indiqué. Il ne connaît ni le poids de {name}, ni ses antécédents,
        ni ce que votre médecin vous a dit. Reflux, allergie connue, croissance
        qui vous interroge, ou simplement une question qui revient : c'est
        toujours l'avis d'un professionnel de santé qui prime sur le nôtre.
      </MethodDisclaimer>

      <MethodSources sources={SOURCES} />
    </div>
  );
}
