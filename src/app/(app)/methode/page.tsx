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
        intro={`Rien n'est improvisé et rien n'est aléatoire. Chaque repas proposé découle de six règles, toutes tirées de recommandations publiées. Les voici, en entier.`}
        backHref="/aliments"
        backLabel="Retour aux aliments"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MethodFigure value="1 sur 2 jours" label="nouvel aliment" />
        <MethodFigure value="2 fois" label="chaque nouveauté est proposée" />
        <MethodFigure value="10 mois" label="la limite des morceaux" />
      </div>

      <div className="space-y-7">
        <MethodSection step={1} title="Deux repères, pas un seul">
          <p>
            L'âge de {name} ne suffit pas à décider de ce qu'{il} peut manger.
            Un enfant de sept mois qui a commencé la semaine dernière n'en est
            pas au même point qu'un enfant du même âge qui mange solide depuis
            trois mois. Le programme tient donc compte des deux : son âge, et
            depuis quand {il} mange.
          </p>
          <p>
            Concrètement, un démarrage tardif avance plus doucement les
            premières semaines — un seul repas, un légume à la fois — puis
            rattrape son âge en cinq à six semaines. Ce qui ne se décale{" "}
            <strong>jamais</strong>, c'est ce qui dépend de l'âge : les
            textures, les allergènes, le besoin en fer. Ces étapes-là ne se
            rattrapent pas plus tard.
          </p>
        </MethodSection>

        <MethodSection step={2} title="Un aliment nouveau tous les deux jours">
          <p>
            Chaque nouveauté est proposée le jour même, puis à nouveau le
            lendemain. C'est ce qui permet de repérer une réaction et
            d'attribuer un refus au bon aliment — un enfant qui refuse
            aujourd'hui accepte souvent le lendemain.
          </p>
          <MethodEvidence>
            Un aliment demande parfois une dizaine de propositions avant d'être
            accepté. Le représenter à quelques jours d'écart, sans insister le
            jour même, fonctionne mieux que d'abandonner.
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
            aussi le délai au bout duquel il ouvre les fruits.
          </p>
          <p>
            Les fruits viennent après, jamais avant. Proposés en premier, ils
            rendent les légumes nettement plus difficiles à faire accepter. Puis
            viennent les légumes plus rares — brocoli, panais, petits pois — et
            les goûts plus marqués comme le chou ou le navet arrivent en
            dernier, une fois le répertoire installé.
          </p>
        </MethodSection>

        <MethodSection step={4} title="Les repas s'ouvrent un par un">
          <p>
            Le midi d'abord, avec un légume seul. Une protéine vers cinq mois et
            demi — dix grammes suffisent, soit deux cuillères à café. Un
            féculent et une cuillère d'huile à six mois. Le goûter s'ouvre aux
            fruits une quinzaine de jours après le premier légume, et le dîner
            vers huit ou neuf mois seulement.
          </p>
          <MethodEvidence>
            L'OMS compte deux à trois repas par jour entre 6 et 8 mois, puis
            trois à quatre au-delà. Le lait, lui, reste la base : 500 à 750 mL
            par jour, repas solides compris.
          </MethodEvidence>
        </MethodSection>

        <MethodSection
          step={5}
          title="Les textures suivent l'âge, jamais le retard"
        >
          <p>
            Lisse jusqu'à huit mois, écrasé à la fourchette entre huit et dix,
            puis petits morceaux fondants. C'est le seul point du programme qui
            ne s'adapte pas au rythme de démarrage, et c'est volontaire.
          </p>
          <MethodEvidence>
            Une cohorte britannique a suivi des enfants jusqu'à sept ans : ceux
            qui ont découvert les morceaux après neuf mois mangeaient moins de
            fruits et de légumes — sur les dix catégories étudiées — et
            présentaient significativement plus de difficultés alimentaires. Une
            cohorte française de 18 000 enfants retrouve le même effet sur le
            développement à trois ans.
          </MethodEvidence>
          <p>
            Un enfant qui démarre tard reçoit donc quelques jours de purée
            lisse, pas davantage : il rejoint ensuite la texture de son âge.
          </p>
        </MethodSection>

        <MethodSection step={6} title="Ce que le programme ne fait pas">
          <p>
            Il ne remplace pas votre médecin, et il ne connaît de {name} que ce
            que vous lui avez dit. Les quantités affichées servent à préparer la
            bonne dose, jamais à être finies : c'est l'appétit de {name} qui
            décide de la fin du repas. Le programme s'arrête au premier
            anniversaire, quand les repas de la famille prennent le relais.
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
        ni ce que votre médecin vous a dit. En cas de doute, de reflux,
        d'allergie connue ou de courbe de croissance qui inquiète, c'est l'avis
        d'un professionnel de santé qui prime, toujours.
      </MethodDisclaimer>

      <MethodSources sources={SOURCES} />
    </div>
  );
}
