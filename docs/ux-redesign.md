# Refonte UX — document de conception

> Refonte complète de l'expérience : parcours d'entrée, architecture de
> l'information, écran principal, direction artistique. Fondé sur un cadrage mené
> par entretien (juillet 2026) et sur `functional-spec.md`,
> `diversification-guide.md`, `auto-diversification-program.md`.

Dernière mise à jour : 2026-07-24
Statut : **proposition à valider**

---

## 1. Ce que le cadrage a révélé

### 1.1 L'utilisateur réel

> Un parent **débordé**, qui ne connaît **rien** à la diversification, et à qui le
> **pédiatre vient de dire de commencer**.

Trois caractéristiques qui doivent gouverner chaque décision de design :

| Caractéristique                              | Conséquence de design                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| **Il n'a pas de temps**                      | Zéro configuration. Le produit doit fonctionner avant qu'il ait rien fait.  |
| **Il n'a pas de connaissances**              | Ne jamais lui demander un arbitrage nutritionnel. L'app décide, il exécute. |
| **Il est anxieux** (santé de son nourrisson) | Ton rassurant, garde-fous visibles, jamais de culpabilisation.              |

Contexte physique d'usage, souvent oublié : **il utilise l'app dans sa cuisine, d'une
seule main, l'autre tenant le bébé**, parfois à 6 h du matin. Cela impose des cibles
tactiles larges, un contraste élevé et aucune interaction de précision.

### 1.2 La promesse, reformulée

La spec actuelle décrit un **planificateur de repas**. Le besoin exprimé est autre :

> « Qu'est-ce que je cuisine pour lui **aujourd'hui**, **comment**, en **quelle
> quantité**, et **dois-je en faire plus pour congeler** ? »

Ce n'est pas un tracker, c'est un **assistant de cuisine pour parent débordé**, adossé
à un programme de diversification. Le suivi (aliments goûtés, allergènes, réactions)
est un **sous-produit** de l'usage quotidien, pas son objet.

**Conséquence majeure** : la navigation actuelle est organisée autour des _tables de la
base de données_ (Menu, Aliments, Courses, Allergènes, Stats). Elle doit être
réorganisée autour des _moments de vie du parent_.

### 1.3 Décisions de cadrage actées

| #   | Décision                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **SaaS B2C public**, **100 % gratuit**, sans limite, sans paywall, sans frais caché.                                                                                                                   |
| D2  | Le programme est **généré automatiquement** — aucun bouton « générer » nulle part.                                                                                                                     |
| D3  | **Valeur avant inscription** : le 1er mois du programme est consultable sans compte (lecture seule, sans notation).                                                                                    |
| D4  | L'accompagnement **s'arrête au 1er anniversaire** (~8 mois de programme, de 4 à 12 mois).                                                                                                              |
| D5  | **Fin du positionnement « IA »**. Positionnement : programme fondé sur les recommandations des autorités de santé et des sociétés de pédiatrie. **Sans citer de source nommément** (elles évolueront). |
| D6  | **Guidage culinaire pas-à-pas**, en supposant un **cuiseur-mixeur type Babycook**. Objectif : simple et efficace, pas de la gastronomie.                                                               |
| D7  | **Batch cooking léger**, raisonné **au mois** (pas à la semaine).                                                                                                                                      |
| D8  | Le plan **s'adapte** en cas de décrochage. **Jamais** de culpabilisation, de série brisée, de compteur rouge.                                                                                          |
| D9  | Diversification déjà commencée → rattrapage rapide de l'historique (voir §3.4).                                                                                                                        |
| D10 | Direction artistique **« doux & rassurant »**.                                                                                                                                                         |

---

## 2. Diagnostic de l'existant

### 2.1 Le parcours de premier lancement se termine avant la valeur

```
/login  →  lien magique  →  boîte mail  →  retour
   ↓
Onboarding : prénom + date de naissance  →  « Créer le profil »
   ↓
« En cuisine »  →  ÉCRAN VIDE, aucun repas, aucun call-to-action
   ↓
??? l'utilisateur doit deviner qu'il faut ouvrir l'onglet « Menu »
   ↓
MenuOnboarding : « Générer par IA » / « Manuellement »
```

Le parcours livre un **écran vide** au moment exact où l'utilisateur attend une
récompense. Le seul geste qui rend l'app utile est **caché derrière un onglet** que
rien ne désigne. C'est le point de rupture d'activation principal.

### 2.2 Les sept problèmes identifiés

| #   | Problème                                                                                                  | Principe violé                       |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| P1  | L'onboarding s'arrête avant la valeur (écran vide)                                                        | _Time-to-value_ ; effet de dotation  |
| P2  | Le magic link expulse l'utilisateur de l'app avant toute preuve de valeur                                 | Coût d'entrée avant bénéfice perçu   |
| P3  | 6 onglets exposés d'emblée à un utilisateur sans données                                                  | Loi de Hick ; révélation progressive |
| P4  | La navigation reflète le modèle de données, pas les usages                                                | Architecture de l'information        |
| P5  | `MenuOnboarding` demande un arbitrage (IA vs manuel) à quelqu'un qui n'a aucun élément pour trancher      | Charge cognitive ; paradoxe du choix |
| P6  | Aucune quantité, aucun mode opératoire → l'app dit _quoi_, jamais _comment_ ni _combien_                  | Adéquation à la tâche réelle         |
| P7  | Le prénom de l'aidant, les moments de repas, l'invitation du co-parent ne sont jamais amenés dans le flow | Complétude du parcours               |

---

## 3. Le nouveau parcours d'entrée

### 3.1 Principe : la valeur d'abord, le compte ensuite

Un seul objectif — il n'y a **ni paywall ni conversion payante à optimiser** (D1),
donc l'onboarding n'a qu'une métrique : **le temps écoulé jusqu'au moment où le
parent sait quoi cuisiner**. Cible : **moins de 60 secondes, sans créer de compte.**

```
┌─ SANS COMPTE ─────────────────────────────────────────────┐
│  1. Accueil        « Quand est né votre bébé ? »          │
│  2. Prénom         personnalise tout le reste             │
│  3. Point de départ  déjà commencé ? / on démarre quand ? │
│  4. [si déjà commencé] rattrapage express                 │
│         ↓                                                  │
│  5. ✨ LE PROGRAMME S'AFFICHE — c'est la récompense       │
│         1er mois consultable · lecture seule              │
└────────────────────────────────────────────────────────────┘
              ↓  l'utilisateur veut noter un repas,
                 voir la suite, ou faire ses courses
┌─ CRÉATION DE COMPTE ──────────────────────────────────────┐
│  6. Email → code à 6 chiffres → les données sont reprises │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Écran 1 — Accueil

Une promesse, un champ. Pas de menu, pas de « en savoir plus », pas de témoignages.

```
╭──────────────────────────────────╮
│                                  │
│         ( logo )                 │
│                                  │
│   Votre pédiatre vous a dit      │
│   de commencer la                │
│   diversification ?              │
│                                  │
│   On s'occupe du reste :         │
│   chaque jour, on vous dit       │
│   quoi cuisiner et comment.      │
│                                  │
│   ╭────────────────────────────╮ │
│   │ Date de naissance de bébé  │ │
│   │ [   JJ / MM / AAAA     ]   │ │
│   ╰────────────────────────────╯ │
│                                  │
│   ╭────────────────────────────╮ │
│   │      Voir son programme    │ │
│   ╰────────────────────────────╯ │
│                                  │
│   Gratuit, sans engagement.      │
│   Aucun compte nécessaire.       │
╰──────────────────────────────────╯
```

**Choix de rédaction** — le titre reprend **le déclencheur réel** (la consultation
pédiatrique) plutôt qu'une promesse abstraite. Le parent doit se reconnaître en une
seconde. « Aucun compte nécessaire » lève l'objection avant qu'elle se forme.

### 3.3 Écrans 2-3 — Les questions indispensables

Une question par écran, réponse en un geste, progression visible.

**Écran 2 — Prénom.** Placé tôt : il coûte zéro effort et personnalise tout ce qui
suit (« Le programme de Léa »), ce qui augmente l'engagement.

**Écran 3 — Fille ou garçon.** Deux choix illustrés (♀/♂), réponse en un geste.
De cette seule valeur on dérive le pronom sujet et tous les accords (« née »/« né »),
via `src/lib/sexe.ts`. Modèle binaire assumé, sans option neutre : la question doit
rester la plus simple possible à cet endroit du parcours.

**Écran 4 — Point de départ.**

```
   La diversification de Léa
   a-t-elle déjà commencé ?

   ╭────────────────────────────╮
   │  Pas encore                │
   │  On commence bientôt       │
   ╰────────────────────────────╯
   ╭────────────────────────────╮
   │  Oui, elle a déjà goûté    │
   │  des aliments              │
   ╰────────────────────────────╯
```

- **Pas encore** → « On démarre quand ? » : `Aujourd'hui` (par défaut, gros bouton) ·
  `Demain` · `Choisir une date`. Trois taps maximum depuis l'accueil.
- **Oui** → rattrapage express (§3.4).

#### La borne haute : au-delà d'un an, on dit non

L'accompagnement s'achève au **premier anniversaire** (décision de cadrage §1.3). Le
générateur suit des repères — ordre d'introduction, textures, fenêtres allergènes —
qui ne valent plus après. Laisser un parent s'inscrire pour un enfant de 15 mois
reviendrait à lui produire un programme faux.

Le contrôle se place sur la **date de naissance**, donc avant tout investissement du
parent, et couvre d'un coup l'inscription et l'aperçu `/decouvrir` (même composant) :

| Âge          | Comportement                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| < 11 mois    | rien de particulier                                                                                                                        |
| 11 → 12 mois | **avertissement non bloquant** : « le programme s'arrêtera dans 3 semaines ». Mieux vaut prévenir que laisser découvrir le mur après coup. |
| ≥ 12 mois    | **blocage** : « Continuer » désactivé, message d'explication                                                                               |

Le refus est formulé comme une **bonne nouvelle**, jamais comme une porte fermée —
cohérent avec le principe « ne jamais culpabiliser » :

> **Le plus dur est derrière vous !**
> Petite Cuillère accompagne la diversification, des premières cuillères au premier
> anniversaire. À 14 mois, Léa mange peu à peu comme le reste de la famille : vous
> n'avez plus besoin de nous pour ça.

Le texte s'en tient au prénom et n'emploie aucun pronom : rien à accorder, donc rien
qui puisse sonner faux.

Règle implémentée dans `src/lib/age.ts` (`ageEligibility`, `ACCOMPANIMENT_END_MONTHS`),
avec un garde-fou côté serveur dans `setupBaby` : un contrôle client est contournable.

### 3.4 Écran 4 — Le rattrapage express (diversification déjà commencée)

Contrainte : un parent ne saisira **jamais** 30 aliments à la main. Il faut que ce
soit un **balayage visuel de quelques secondes**, pas un formulaire.

**Étape A — Ce qu'il a déjà goûté** _(facultatif, « passer » toujours visible)_

Grille de pastilles tappables, ordonnées par probabilité (les aliments de démarrage
d'abord), limitée aux aliments compatibles avec l'âge. Multi-sélection, aucun
défilement infini.

```
   Qu'est-ce que Léa a déjà goûté ?
   Touchez ce qui vous revient — inutile d'être exhaustif.

   LÉGUMES
   ( carotte ✓)  ( courgette ✓)  ( haricot vert )
   ( potiron )   ( épinard )     ( brocoli )

   FRUITS
   ( pomme ✓)    ( poire )       ( banane ✓)

                                      [ Passer ]
```

**Étape B — Les allergènes** _(obligatoire — enjeu de sécurité)_

Traité à part, avec un ton et un cadre visuel distincts, car c'est la seule
information que l'app ne peut pas deviner et dont l'absence est risquée.

```
   Important : les allergènes

   Léa a-t-elle déjà été exposée à…

   ┌────────────────────────────────┐
   │ Œuf              [non] [oui]   │
   │ Lait de vache    [non] [oui] ← │
   │   └ une réaction ?  [non] [oui]│
   │ Poisson          [non] [oui]   │
   │ Arachide         [non] [oui]   │
   │ Fruits à coque   [non] [oui]   │
   │ Gluten (blé)     [non] [oui]   │
   └────────────────────────────────┘
```

Conformément au cadrage : on demande **s'il y a eu une réaction** (oui/non), **jamais
laquelle**. Une réponse « oui » ne déclenche aucun diagnostic — elle marque l'allergène
comme à ne pas reproposer automatiquement et affiche un renvoi vers le médecin.

**Étape C — Goûts** _(facultatif, un seul écran, sautable)_ : « Son aliment préféré ? »
· « Celui qu'elle aime le moins ? ». Alimente la rotation du générateur.

### 3.5 Écran 5 — La récompense

Le programme s'affiche **immédiatement**, sans écran de chargement artificiel ni
bouton à presser (D2). L'utilisateur atterrit directement sur **l'écran du jour**,
pas sur un calendrier vide.

Le premier mois est **entièrement consultable**, en lecture seule. Au-delà, un bloc
d'invitation — jamais un mur brutal :

```
   ╭──────────────────────────────────╮
   │   Le programme de Léa continue   │
   │   jusqu'à son 1er anniversaire.  │
   │                                  │
   │   Créez votre compte (gratuit)   │
   │   pour :                         │
   │    · voir les 8 mois de programme│
   │    · noter ses repas             │
   │    · partager avec le co-parent  │
   │    · retrouver tout ça partout   │
   │                                  │
   │   ╭────────────────────────────╮ │
   │   │     Créer mon compte       │ │
   │   ╰────────────────────────────╯ │
   ╰──────────────────────────────────╯
```

Le compte est aussi demandé **au moment d'une intention** (noter un repas, ouvrir la
liste de courses) : c'est là que la motivation est maximale.

### 3.6 Écran 6 — L'inscription : passer du lien magique au **code à 6 chiffres**

**Recommandation forte.** Le lien magique force l'utilisateur à **quitter
l'application**, ouvrir sa boîte mail, cliquer, et revenir dans un onglet neuf — sur
mobile, c'est le pire moment possible pour perdre le contexte.

Le **code à usage unique** (OTP) résout cela : le parent lit six chiffres dans sa
notification et les saisit **sans jamais quitter l'écran**. Même sécurité, même
absence de mot de passe, même backend Supabase (`signInWithOtp` avec un template
d'email contenant `{{ .Token }}` au lieu de `{{ .ConfirmationURL }}`).

```
   ╭──────────────────────────────────╮
   │   On garde le programme de Léa   │
   │                                  │
   │   [ votre@email.fr           ]   │
   │   ╭────────────────────────────╮ │
   │   │        Continuer           │ │
   │   ╰────────────────────────────╯ │
   ╰──────────────────────────────────╯
              ↓
   ╭──────────────────────────────────╮
   │   Code envoyé à votre@email.fr   │
   │                                  │
   │      ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐     │
   │      └─┘ └─┘ └─┘ └─┘ └─┘ └─┘     │
   │                                  │
   │   Renvoyer le code (0:42)        │
   ╰──────────────────────────────────╯
```

Détails d'implémentation : `inputmode="numeric"` + `autocomplete="one-time-code"`
(remplissage automatique iOS/Android), collage du code entier géré, et **conservation
du lien magique en secours** dans le même email pour qui préfère cliquer.

**Reprise des données** : tout ce qui a été saisi avant le compte est stocké
localement, puis rattaché au foyer créé. Le parent ne resaisit **rien**.

### 3.7 Ce qu'on ne demande **pas** à l'onboarding

Reporté, avec valeurs par défaut appliquées silencieusement :

- **Les moments de repas** → les 4 par défaut ; personnalisables plus tard dans les
  réglages. Un parent qui découvre la diversification n'a aucune raison de les changer.
- **Le prénom de l'aidant** → demandé au premier partage, quand il devient utile.
- **L'invitation du co-parent** → proposée **après** le premier repas noté, moment où
  la valeur du partage devient évidente.
- **La prématurité** → reste derrière son drapeau de fonctionnalité, hors du flow
  principal (concerne une minorité et alourdirait le parcours pour tous).

### 3.8 Le deuxième enfant passe par le même parcours

« Ajouter un enfant » (sélecteur de la nav, page Mon foyer) n'ouvre pas un
formulaire de création : il **rejoue l'onboarding en entier** sur `/nouvel-enfant`
— prénom, sexe, naissance, point de départ, rattrapage — et génère le programme
dans la foulée.

La raison est la même que pour le premier enfant : un profil sans programme
n'apporte rien, et c'est justement ce que produisait l'ancien dialogue (le parent
se retrouvait sur un « Aujourd'hui » vide, sans savoir quoi faire). Le second
enfant a par ailleurs son propre point de départ et son propre rattrapage : ces
questions sont **indispensables**, pas décoratives.

Seules différences avec le premier lancement : les réponses données avant la
création du compte ne sont pas rejouées (elles appartiennent au premier enfant),
et un bouton **Annuler** reste offert à chaque étape — ici le parent a déjà un
foyer fonctionnel, il doit pouvoir renoncer sans laisser de profil à moitié créé.

---

## 4. La nouvelle architecture de l'information

### 4.1 Le problème de la navigation actuelle

```
En cuisine │ Menu │ Aliments │ Courses │ Allergènes │ Stats
```

Six destinations, dont trois sont de la **consultation occasionnelle** (Aliments,
Allergènes, Stats) qui occupent le même poids visuel que l'action quotidienne. Sur
mobile, six onglets de 62 px sur un écran de 375 px produisent des libellés illisibles
et des cibles trop proches. Et surtout : ces intitulés décrivent **des jeux de données**,
pas des intentions.

### 4.2 La navigation proposée

Trois destinations, correspondant à trois moments de vie du parent :

```
┌──────────────┬──────────────┬──────────────┐
│  Aujourd'hui │   Ma semaine │  Découvertes │
│   ( bol )    │  ( panier )  │  ( graine )  │
└──────────────┴──────────────┴──────────────┘
     ↑ 90 %          ↑ 8 %          ↑ 2 %
   des ouvertures
```

| Destination     | Intention                                            | Contenu                                                                                   |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Aujourd'hui** | _« Qu'est-ce que je lui prépare, là, maintenant ? »_ | Repas du jour, fiche pas-à-pas, quantités, notation en un geste, aperçu de demain         |
| **Ma semaine**  | _« Qu'est-ce que j'achète et je prépare ? »_         | Planning, **liste de courses quantifiée**, session de préparation & congélation, vue mois |
| **Découvertes** | _« Où en est-il ? »_                                 | Aliments goûtés / à venir, **suivi des allergènes**, progression                          |

L'ancien **« Menu »** (édition du planning) et les **« Stats »** ne disparaissent pas :
ils deviennent respectivement une vue de _Ma semaine_ et une section de _Découvertes_.
Le foyer et le profil quittent la barre principale pour l'en-tête.

### 4.3 Adaptation à l'écran

- **Mobile** — barre basse à 3 onglets, cibles de 64 px minimum, libellés complets.
- **PC** — barre latérale conservée ; la largeur supplémentaire sert à afficher
  côte à côte la fiche du jour et la semaine, plutôt qu'à multiplier les entrées de
  menu. Les statistiques et le calendrier long s'y déploient pleinement.

---

## 5. L'écran « Aujourd'hui » — la pièce maîtresse

Il doit répondre à quatre questions dans cet ordre : **quoi · combien · comment ·
dois-je en faire plus**.

```
╭────────────────────────────────────────╮
│  jeudi 23 juillet          Léa · 5 mois│
│                                        │
│  Ce midi, Léa découvre                 │
│                                        │
│  ╭──────────────────────────────────╮  │
│  │            ● nouveauté           │  │
│  │                                  │  │
│  │        La courgette              │  │
│  │                                  │  │
│  │   ~120 g  ·  purée lisse         │  │
│  │                                  │  │
│  │   ─────────────────────────────  │  │
│  │                                  │  │
│  │   1. 1 courgette moyenne,        │  │
│  │      épluchée et épépinée        │  │
│  │   2. Vapeur 15 min au cuiseur    │  │
│  │   3. Mixer lisse, avec un peu    │  │
│  │      d'eau de cuisson            │  │
│  │   4. 1 c. à café d'huile de      │  │
│  │      colza, hors cuisson         │  │
│  │                                  │  │
│  │   ⓘ Ni sel ni sucre.             │  │
│  │                                  │  │
│  │   ╭────────────────────────────╮ │  │
│  │   │  ↻ La courgette revient    │ │  │
│  │   │    5 fois d'ici 3 semaines.│ │  │
│  │   │    Prévoyez 4 courgettes   │ │  │
│  │   │    et congelez 4 portions. │ │  │
│  │   ╰────────────────────────────╯ │  │
│  ╰──────────────────────────────────╯  │
│                                        │
│  ╭──────────────────────────────────╮  │
│  │       Comment ça s'est passé ?   │  │
│  │    ╭─────╮  ╭─────╮  ╭─────╮     │  │
│  │    │ 😋  │  │ 😐  │  │ 🙅  │     │  │
│  │    │adoré│  │moyen│  │refusé│    │  │
│  │    ╰─────╯  ╰─────╯  ╰─────╯     │  │
│  ╰──────────────────────────────────╯  │
│                                        │
│  ── Le goûter ─────────────────────    │
│  Poire · ~60 g · compote lisse         │
╰────────────────────────────────────────╯
```

### Décisions de design

1. **Une seule chose à faire à l'écran.** Le repas _en cours_ occupe tout ; les autres
   moments de la journée sont réduits à une ligne. On ne demande pas au parent de
   choisir sur quoi se concentrer.
2. **La quantité est affichée avant le mode opératoire** — c'est la première question
   qu'il se pose en ouvrant le frigo.
3. **Le pas-à-pas suppose le cuiseur-mixeur** (D6) : 4 étapes maximum, verbes à
   l'infinitif, aucune technique culinaire. « Vapeur 15 min », pas « faire suer ».
4. **Les garde-fous sont dans la fiche**, jamais dans une page d'aide séparée : « ni
   sel ni sucre » est rappelé là où l'erreur se commettrait.
5. **Le batch cooking est contextuel** (D7) : il apparaît sur l'aliment concerné, au
   moment où le parent est devant, avec un horizon **mensuel**.
6. **La notation est une décision unique, trois cibles larges.** Pas de formulaire, pas
   de modale, pas de champ obligatoire. La note libre et les allergènes sont accessibles
   d'un geste supplémentaire, pour qui le veut.
7. **Aucune mention de série, de score, de complétion.** Un repas non noté reste
   simplement non noté (D8).

### Le jour d'une introduction d'allergène

Le seul cas où l'écran change de registre — un bandeau sobre, informatif, non
anxiogène, remonté dans _Aujourd'hui_ plutôt que caché dans un onglet :

```
  ╭──────────────────────────────────────╮
  │  ⓘ Aujourd'hui, première fois avec   │
  │    de l'œuf.                         │
  │    Proposez-le le matin ou le midi   │
  │    et restez attentif dans les       │
  │    heures qui suivent.               │
  │                        [ Noter → ]   │
  ╰──────────────────────────────────────╯
```

---

## 6. « Ma semaine » — courses quantifiées & préparation

Trois blocs, dans l'ordre d'utilité :

1. **Ma liste de courses** — agrégée, **avec quantités réelles** (« 4 courgettes »,
   « 1 kg de carottes »), cochable, avec un sélecteur **`Cette semaine` /
   `Ce mois-ci`** (D7). Le mode « mois » est ce qui rend la congélation possible.
2. **Ma session de préparation** — pour qui cuisine en une fois le week-end : ce qu'il
   faut cuire, en quelle quantité, combien de portions congeler et pour quels repas
   elles serviront. Facultatif, jamais imposé.
3. **Le planning** — les 7 jours, en lecture, éditable au tap. C'est ici, et seulement
   ici, que le parent qui veut reprendre la main le peut.

---

## 7. Direction artistique — « doux & rassurant »

Retenue au cadrage (D10), avec un garde-fou : **doux ne veut pas dire infantile ni
illisible**. La cible est un produit qu'un parent épuisé trouve apaisant _et_ dont il
lit chaque mot du premier coup d'œil, dans une cuisine très éclairée.

### Palette

| Rôle           | Teinte                                 | Usage                              |
| -------------- | -------------------------------------- | ---------------------------------- |
| Fond           | Crème très doux (blanc cassé chaud)    | Toute l'app                        |
| Primaire       | Vert sauge profond                     | Actions, éléments actifs           |
| Primaire clair | Sauge pâle                             | Fonds de carte, états sélectionnés |
| Accent         | Terracotta doux                        | Nouveautés, points d'attention     |
| Texte          | Brun-gris très foncé (jamais noir pur) | Lecture                            |

**Règle non négociable** : les tons pastel sont réservés aux **fonds**. Aucun texte,
aucune icône porteuse de sens ne s'affiche en pastel — contraste **AA (4,5:1)** minimum
pour le texte, **3:1** pour les éléments d'interface. C'est le piège classique de cette
direction artistique.

### Formes & typographie

- **Rayons** généreux : 20 px sur les cartes, 16 px sur les champs et boutons.
- **Ombres** larges et très diffuses, jamais de bordure dure.
- **Espacement** ample — le vide est ce qui produit la sensation de calme.
- **Deux polices** : une typographie de titre à caractère, chaleureuse et un peu ronde ;
  une typographie de texte neutre et très lisible. Corps de texte à **17 px minimum**.
- **Illustrations** plutôt que photographies pour les aliments : cohérence garantie sur
  ~80 entrées, poids maîtrisé, et rendu plus doux.

### Ergonomie physique (usage à une main)

- Cibles tactiles **56-64 px**, jamais moins de 48.
- Les actions principales sont **en bas de l'écran**, dans la zone atteignable au pouce.
- Aucune interaction nécessitant deux doigts, un appui long ou un glissement précis.
- Mode sombre prévu dès la conception des jetons de couleur (usage nocturne réel).

---

## 8. Le nom du produit

« Baby Food Tracker » est un nom de code : anglais pour un public francophone, et
« tracker » décrit le modèle de données, pas le bénéfice. Pistes proposées :

| Nom                     | Intention                                                                                | Réserve                                |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| **Petite Cuillère**     | L'objet symbole des premiers repas. Chaleureux, très français, immédiatement compris.    | Un peu long                            |
| **Premières Cuillères** | Même registre, plus explicite sur l'étape de vie.                                        | Long                                   |
| **Petit Bec**           | Affectueux, court, mémorable, évoque la bouche de l'enfant.                              | Moins explicite                        |
| **Tambouille**          | « Faire la tambouille » : la cuisine simple du quotidien. Très incarné, sans prétention. | Familier, peut manquer de sérieux      |
| **À Table**             | Direct, universel, chaleureux.                                                           | Peu distinctif, disponibilité douteuse |

**Recommandation : `Petite Cuillère`**, avec la signature _« Les premiers repas de bébé,
en toute confiance »_. Le nom raconte l'étape de vie, se retient, et supporte un logo
évident. À vérifier : disponibilité du domaine et antériorité de marque.

---

## 9. Points de vigilance

1. **Matière grasse** — l'huile est **recommandée dès le premier repas salé** (1 c. à
   café/jour), pas interdite au début. Seuls le **sel** et le **sucre** sont proscrits.
   Les fiches recette doivent être fidèles à `diversification-guide.md` sur ce point.
2. **Responsabilité** — les mentions « repère d'organisation, pas un avis médical »
   présentes sur chaque écran ont été **retirées** (décision du 2026-07-24) : répétées
   partout, elles alourdissaient l'interface et contredisaient le positionnement
   rassurant. Le sujet reste entier et se traite désormais **hors interface**, dans les
   CGU, à écrire avant l'ouverture au public — au même titre que le point 3 ci-dessous.
3. **Données de santé d'un mineur** — l'ouverture au public impose de traiter le
   sujet RGPD (région d'hébergement, durée de conservation, suppression du compte et
   export). Hors périmètre de ce document, mais **bloquant avant publication**.
4. **Hypothèses non testées** — l'ensemble de ce document est une proposition fondée
   sur un entretien de cadrage, sans observation d'utilisateur. Elle doit être
   confrontée à **3 à 5 parents** en situation réelle avant d'être considérée comme
   acquise.

---

## 10. Ordre de construction proposé

| Étape | Contenu                                                                                      | Résultat visible                             |
| ----- | -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **1** | Fondations visuelles : jetons de couleur, typographie, formes, composants de base            | L'app existante change de peau               |
| **2** | Navigation à 3 destinations + écran « Aujourd'hui » refondu (quantités, pas-à-pas, notation) | Le cœur d'usage quotidien est en place       |
| **3** | Parcours d'entrée sans compte + génération immédiate + rattrapage express                    | Un inconnu peut voir son programme en < 60 s |
| **4** | Code à 6 chiffres + reprise des données locales                                              | L'inscription ne fait plus sortir de l'app   |
| **5** | « Ma semaine » : courses quantifiées, vue mois, session de préparation                       | Le batch cooking devient possible            |
| **6** | « Découvertes » : fusion aliments / allergènes / progression                                 | Le suivi trouve sa place                     |
| **7** | Contenu : fiches de préparation pour le catalogue d'aliments                                 | Le pas-à-pas est réellement alimenté         |

L'ordre est délibéré : on refond d'abord **ce que les utilisateurs actuels voient tous
les jours**, avant le parcours d'entrée que personne n'a encore emprunté.
