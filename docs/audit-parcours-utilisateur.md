# Audit du parcours utilisateur

> Examen du parcours réel tel qu'il est **codé** aujourd'hui, confronté aux
> intentions de `ux-redesign.md` et à l'état de l'art de l'activation produit.
> Objectif : identifier où l'on perd le parent, et proposer des corrections
> classées par rapport valeur/effort.

Date : 2026-08-09
Statut : **proposition — aucune décision n'est prise ici**
Méthode : lecture du code (pas d'observation d'utilisateur, pas de mesure), plus
recherche documentaire externe (sources en annexe).

**Avertissement de méthode.** Ce rapport dit ce que le code fait, pas ce que les
parents font. Aucune des priorités ci-dessous ne vaut une session d'observation
avec trois parents — et la friction F13 explique pourquoi on ne peut pas non
plus départager ces hypothèses par la donnée aujourd'hui.

---

## 1. Le parcours réel, bout à bout

```
  ┌─ PUBLIC ───────────────────────────────────────────────────────────┐
  │  /                landing, 10 sections, 3 CTA identiques           │
  │       ↓                                                            │
  │  /decouvrir       questionnaire — 5 écrans (chemin court)          │
  │                                    9 écrans (chemin « déjà         │
  │                                    commencé », dont 2 listes)      │
  │       ↓                                                            │
  │  aperçu           1 journée détaillée + 6 lignes de résumé         │
  │                   → lecture seule, aucun geste possible            │
  └────────────────────────────────────────────────────────────────────┘
              ↓  bloc de conversion en pied de page
  ┌─ COMPTE ───────────────────────────────────────────────────────────┐
  │  /login           email → code à 6 chiffres                        │
  │       ↓                                                            │
  │  /aujourdhui      arrivée directe, aucun premier contact           │
  └────────────────────────────────────────────────────────────────────┘
```

Détail du questionnaire (`src/components/onboarding.tsx`) :

| #   | Écran                     | Geste demandé                                                 | Coût                                 |
| --- | ------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| 1   | Prénom + couleur d'avatar | **saisie clavier** + choix décoratif                          | le plus cher du parcours, en premier |
| 2   | Fille ou garçon           | 1 tap, **bloquant**                                           | 1 écran pour un accord grammatical   |
| 3   | Date de naissance         | calendrier                                                    | c'est la vraie question              |
| 4   | Déjà commencé ?           | 1 tap                                                         | branche le parcours                  |
| 5a  | On démarre quand ?        | 0 tap (présélectionné)                                        | ✅ bien fait                         |
| 5b  | Depuis quand solide ?     | 1 tap                                                         | ok                                   |
| 6b  | Ce qu'il a déjà goûté     | **~77 pastilles** dans un cadre de 46 % de la hauteur d'écran | rupture probable                     |
| 7b  | Allergènes                | **16 lignes**, chacune pouvant ouvrir une sous-question       | rupture probable                     |
| 8b  | Goûts (facultatif)        | 2 taps                                                        | ok                                   |

La cible fixée par `ux-redesign.md` §3.1 est **« moins de 60 secondes »**. Le
chemin court y arrive peut-être ; le chemin long, celui du parent le plus mûr
(décision D9), n'en est pas près.

---

## 2. Ce que dit l'état de l'art

Les repères que la recherche fait ressortir, et qui cadrent le diagnostic :

- **Le temps jusqu'à la valeur est la métrique qui commande le reste.** Moins de
  5 minutes est excellent en self-serve ; 20 à 60 minutes fait perdre les
  inscrits avant qu'ils atteignent la valeur. Le taux d'activation médian tourne
  autour de 38 % en SaaS B2B, 40-60 % pour les bons produits.
- **La friction de formulaire se paye cash.** Passer un formulaire d'inscription
  de 7 champs à 3 a réduit l'abandon du tunnel de 44,7 % dans un cas documenté.
- **Une liste de démarrage tient en 3 à 5 items.** Au-delà de 8, le taux
  d'achèvement chute.
- **La divulgation progressive** (Nielsen, 1995) : montrer d'abord la seule
  action qui mène au premier succès, révéler le reste quand le comportement
  signale que l'utilisateur est prêt. Deux niveaux maximum.
- **Les états vides ont trois devoirs** : dire pourquoi c'est vide, montrer la
  forme que ça prendra une fois rempli, et porter l'action qui le remplit —
  **dans la zone vide**, pas dans une barre ailleurs.
- **Le rappel est le premier levier de rétention.** Une seule notification
  poussée dans la fenêtre des 90 premiers jours améliore la rétention à 90 jours
  de 147 % dans les données citées. Pour un produit dont l'usage est quotidien
  et matinal, c'est structurant.
- **Le modèle « Tiny Habits »** (ancrer un geste minuscule sur une habitude
  existante, célébrer immédiatement) est ce qui marche en santé/suivi. Le repas
  **est** l'ancre — elle est déjà là, gratuite.

Rien de tout cela ne contredit `ux-redesign.md` : le document avait vu juste sur
le fond. L'écart est entre le document et le code.

---

## 3. Diagnostic — 13 frictions

### Bloc A — Le questionnaire coûte plus cher qu'annoncé

**F1 · La promesse « 3 questions » n'est pas tenue.**
`src/app/page.tsx:805` annonce « Répondez à 3 questions ». Le chemin court en
compte 5, le long 9. Le décalage se découvre à la deuxième minute, c'est-à-dire
au pire moment — juste après l'engagement, avant la récompense.

**F2 · Le geste le plus cher est placé en premier.**
`ux-redesign.md` §3.2 prévoyait un accueil à un seul champ : la date de
naissance. La landing s'y tient encore (« Il ne manque que sa date de
naissance », `page.tsx:936`). Mais le questionnaire démarre sur un **champ texte
libre au clavier** (le prénom), doublé d'un **choix de couleur d'avatar**
(`onboarding.tsx:516-528`) — de la personnalisation pure, à l'instant zéro, avant
que le parent ait vu quoi que ce soit qui justifie l'effort.

**F3 · L'écran « fille ou garçon » est un péage.**
Il est bloquant (`onboarding.tsx:542`, `nextDisabled={!sexe}`) et ne sert qu'aux
accords grammaticaux. C'est 20 % du chemin court dépensé pour du confort de
rédaction — et un mur pour qui ne souhaite pas répondre.

**F4 · Le « rattrapage express » n'est pas express.**
§3.4 promet « un balayage visuel de quelques secondes », une grille « ordonnée
par probabilité » et « limitée aux aliments compatibles avec l'âge ».
L'implémentation (`onboarding.tsx:211-223`) prend **tout le catalogue** — 77
aliments — groupé par catégorie, dans un conteneur `max-h-[46vh]` à défilement
(`onboarding.tsx:755`). Puis 16 allergènes à trancher un par un, dans le même
type de cadre (`onboarding.tsx:787`), chacun pouvant déplier une sous-question.

Le commentaire du code justifie très bien l'absence de filtre d'âge (on veut
savoir ce que l'enfant a _réellement_ goûté, y compris hors repères). L'argument
tient. Ce qui manque, c'est le reste de la promesse : **le tri par probabilité et
une recherche**, qui ne coûtent presque rien et changent tout.

C'est, à la lecture, le point de rupture le plus probable du tunnel — et il
frappe précisément le segment que la décision D9 voulait accueillir.

### Bloc B — La récompense est sous-dimensionnée, et stérile

**F5 · Trois promesses différentes pour la même chose.**
`ux-redesign.md` D3 dit « le 1er mois consultable ». La landing dit « un
calendrier complet ». `ProgramPreview` livre **une journée détaillée plus six
lignes de résumé** (`program-preview.tsx:48-51`). Puis le bloc de conversion vend
« Les 8 mois de programme, jour par jour » (`program-preview.tsx:153-165`) à
quelqu'un qui vient d'en voir sept jours. L'écart entre le vu et le vendu est
exactement ce qui rend un mur d'inscription crédible ou pénible.

**F6 · Le levier le plus fort du document n'est pas branché.**
§3.5 : « Le compte est aussi demandé **au moment d'une intention** (noter un
repas, ouvrir la liste de courses) : c'est là que la motivation est maximale. »
Dans l'aperçu, **aucun geste n'est possible** : rien n'est notable, rien n'est
cliquable, il n'y a qu'un bloc de conversion en pied de page. Le parent doit
décider à froid, sans jamais avoir touché le produit.

**F7 · Quitter l'aperçu le détruit.**
`DiscoverFlow` garde son résultat dans un `useState` (`discover-flow.tsx:24-27`)
et ne le reconstruit jamais depuis `localStorage`, alors que les réponses y sont
bel et bien (`lib/pending-setup.ts`). Conséquence : un parent qui va sur
`/login`, hésite, et revient sur `/decouvrir` **retrouve un questionnaire
vierge**. L'aperçu — la récompense — a disparu, et le message « Vos réponses sont
conservées » se retourne contre nous.

**F8 · Le code à 6 chiffres n'a pas de bouton de renvoi.**
`login/page.tsx:223-235` n'offre que « Changer d'adresse ». §3.6 maquettait
pourtant « Renvoyer le code (0:42) ». Un email lent ou classé en indésirable
laisse le parent sans issue, à l'étape la plus fragile du parcours.

### Bloc C — Après l'inscription, plus personne ne guide

**F9 · Aucun premier contact dans l'application.**
On atterrit sur `/aujourdhui` avec quatre onglets et un micro, sans un mot. La
**commande vocale**, argument différenciant n° 1 de la landing (une section
entière, `page.tsx:559`), n'a aucune présentation : le parent doit deviner qu'un
bouton rond au centre de la barre basse accepte des phrases entières. Il n'y a
ni liste de démarrage, ni premier geste désigné, ni célébration du premier repas
noté.

**F10 · L'état vide d'« Aujourd'hui » est un cul-de-sac, et contredit D2.**
`today-meals.tsx:64-71` : « Rien de prévu aujourd'hui. Composez la semaine depuis
l'onglet **Ma semaine**. » Le nom de l'onglet est en gras mais **n'est pas un
lien**. Le texte est le même que l'enfant soit trop jeune pour manger solide ou
que le programme soit arrivé à sa fin. Et surtout, il redemande au parent de
composer un menu, ce que la décision D2 (« aucun bouton générer nulle part »)
avait précisément banni.

**F11 · La boucle de partage n'est jamais amorcée.**
§3.7 prévoyait l'invitation du co-parent « **après** le premier repas noté,
moment où la valeur du partage devient évidente ». Rien de tel n'existe :
`HelpersManager` ne vit que sur `/foyer`, où il faut aller de soi-même. C'est la
boucle de croissance la moins chère du produit — un parent qui invite l'autre
parent double l'usage sans coût d'acquisition — et elle est laissée au hasard.

### Bloc D — Ce qui manque au produit pour tenir dans la durée

**F12 · Ni installation, ni rappel.**
Aucun manifeste PWA, aucune icône d'application, aucun service worker, aucune
notification. `public/` contient encore les SVG livrés par défaut avec Next
(`next.svg`, `vercel.svg`, `window.svg`). Pour un produit dont le contexte
d'usage assumé est « la cuisine, à 6 h du matin, d'une seule main », ne pas être
sur l'écran d'accueil et ne jamais rappeler le repas du jour est le plus gros
levier de rétention non exploité — c'est exactement ce que quantifie la
recherche citée au §2.

**F13 · Aucune mesure.**
Il n'y a pas une ligne d'instrumentation dans `src/`. `ux-redesign.md` §3.1 fixe
pourtant une métrique unique, et §9.4 reconnaît que tout le document est une
hypothèse non validée. En l'état, on ne peut ni connaître le taux d'activation,
ni savoir lequel des neuf écrans du questionnaire perd les parents, ni départager
deux des propositions ci-dessous. **Tout le reste de ce rapport est un pari tant
que ce point n'est pas traité.**

---

## 4. Propositions

Classées par rapport valeur/effort. « Effort » est une estimation grossière en
jours-homme.

| #   | Proposition                                              | Corrige | Effort | Valeur |
| --- | -------------------------------------------------------- | ------- | ------ | ------ |
| P1  | Instrumenter le tunnel                                   | F13     | 1 j    | ⭐⭐⭐ |
| P2  | Restaurer l'aperçu au retour                             | F7      | 0,5 j  | ⭐⭐⭐ |
| P3  | Bouton « renvoyer le code »                              | F8      | 0,5 j  | ⭐⭐   |
| P4  | Rendre l'état vide actionnable                           | F10     | 0,5 j  | ⭐⭐   |
| P5  | Remettre la date de naissance en tête, sortir la couleur | F1, F2  | 1 j    | ⭐⭐⭐ |
| P6  | Trier et filtrer le rattrapage                           | F4      | 1,5 j  | ⭐⭐⭐ |
| P7  | Rendre l'aperçu manipulable                              | F5, F6  | 3 j    | ⭐⭐⭐ |
| P8  | Premier contact dans l'app                               | F9      | 2 j    | ⭐⭐⭐ |
| P9  | Inviter le co-parent après le 1ᵉʳ repas noté             | F11     | 1 j    | ⭐⭐   |
| P10 | PWA + icônes                                             | F12     | 1 j    | ⭐⭐   |
| P11 | Rendre le sexe facultatif                                | F3      | 0,5 j  | ⭐     |
| P12 | Rappel quotidien                                         | F12     | 3 j    | ⭐⭐⭐ |

### P1 · Instrumenter le tunnel — **à faire en premier**

Six événements suffisent, et ils répondent à toutes les questions ouvertes de ce
rapport :

```
landing_cta_click · onboarding_step_view {step} · onboarding_abandon {step}
preview_shown {days, path} · signup_completed · first_meal_logged
```

Le seul indicateur qui compte : **% des visiteurs de `/` qui atteignent
`preview_shown`**, et le temps écoulé pour y arriver (la métrique de §3.1,
enfin mesurée). `onboarding_step_view` par étape donne immédiatement la courbe
d'abandon écran par écran, et tranchera entre P5, P6 et P11 sans discussion.

Contrainte à respecter : données de santé d'un mineur, public français. Un outil
sans cookie, hébergé en Europe, sans identifiant personnel (Plausible, Umami
auto-hébergé) est le bon compromis — et ne rouvre pas le chantier RGPD du §9.3
de `ux-redesign.md`.

### P2 · Restaurer l'aperçu au retour

`DiscoverFlow` relit `readPendingSetup()` au montage et reconstruit
`buildPreview()` : le parent qui revient de `/login` retrouve son programme au
lieu d'un questionnaire vide. Une demi-journée, et c'est un bug de parcours
franc, pas une amélioration d'agrément.

Corollaire : sur `/login`, remplacer « Retour à l'accueil » par « Revenir au
programme de {prénom} » quand des réponses sont en attente.

### P3 · Bouton « renvoyer le code »

Avec le compte à rebours prévu par §3.6 (60 s). Plus un mot sur les indésirables,
qui est la cause réelle d'échec la plus fréquente.

### P4 · Rendre l'état vide actionnable

Trois cas distincts, trois messages, chacun portant son action **dans la zone
vide** :

- **trop jeune pour le solide** → « Encore un peu de patience : {prénom} n'a
  besoin que de lait pour l'instant. Son premier repas est prévu le {date}. » —
  aucune action, et c'est très bien ;
- **programme terminé** (1ᵉʳ anniversaire) → le message de fin d'accompagnement,
  déjà rédigé dans `OutOfScopeNotice` ;
- **trou de programme** → ne pas demander au parent de composer un menu (D2) :
  générer la suite, et le dire.

### P5 · Remettre la date de naissance en tête

L'ordre que le document prévoyait, et que la landing promet encore :

```
1. Date de naissance   ← seul champ, celui qui déclenche tout
2. Prénom              ← personnalise la suite
3. Déjà commencé ?
4. Quand ? / Depuis quand ?
```

Le choix de couleur d'avatar quitte le questionnaire pour `/foyer` : c'est de la
personnalisation, elle a sa place quand le parent explore, pas quand il est en
train d'évaluer si le produit vaut son temps.

Bénéfice secondaire : le contrôle d'éligibilité (≥ 12 mois → refus) s'exécute
alors **au premier écran**, avant tout investissement du parent, ce que §3.3
demandait explicitement.

Et une fois l'ordre corrigé, la landing peut enfin dire vrai — « 3 questions »,
ou « 4 », mais le compte exact.

### P6 · Trier et filtrer le rattrapage

Garder le catalogue entier (l'argument du code est juste), mais :

- **trier par probabilité** : aliments de démarrage d'abord, puis ordre
  d'introduction du programme — pas l'ordre alphabétique d'une table ;
- **un champ de recherche** en tête de liste ;
- **remonter les aliments plausibles pour l'âge** en premier bloc, le reste sous
  un « Voir tout le catalogue » (divulgation progressive, deux niveaux) ;
- pour les allergènes : passer de 16 lignes à trancher à **une grille de
  pastilles multi-sélection** (« touchez ce qu'il a déjà rencontré »), la
  sous-question « une réaction ? » n'apparaissant que pour les allergènes
  sélectionnés. On passe de 16 décisions à 1 balayage plus 0 à 2 décisions.

### P7 · Rendre l'aperçu manipulable

C'est la proposition qui rapporte le plus, et la seule qui demande un vrai
travail. Deux mouvements :

1. **Étendre l'aperçu au premier mois** (D3), en calendrier résumé — pour que
   « les 8 mois » vendus ensuite soient une extrapolation crédible de ce qu'on
   vient de voir, et non une promesse en l'air.
2. **Autoriser un geste, un seul, et faire du compte sa conséquence.** Le parent
   tape « adoré » sur le repas du jour ; l'application enregistre en mémoire,
   affiche l'effet (« noté — {prénom} le retrouvera dans trois jours »), et
   c'est _ce_ moment qui appelle le compte : « pour garder ça, votre email ».
   La motivation y est maximale, et le mur devient une conséquence de son propre
   geste plutôt qu'un péage.

Aligner ensuite les trois formulations (document, landing, aperçu) sur ce qui est
réellement montré.

### P8 · Premier contact dans l'application

Pas un tour guidé — le parent est débordé, il n'en lira pas un. Trois choses :

- **une phrase, une fois**, en tête d'« Aujourd'hui », le premier jour :
  « Ce soir, dites-nous comment ça s'est passé — un tap, ou une phrase à voix
  haute » ; elle disparaît au premier repas noté ;
- **une bulle sur le micro**, une seule fois, montrant une phrase d'exemple —
  c'est la fonctionnalité que la landing vend le plus et que rien ne présente ;
- **célébrer le premier repas noté** (Tiny Habits : la récompense immédiate est
  ce qui installe la boucle). C'est aussi le bon moment pour P9.

### P9 · Inviter le co-parent après le premier repas noté

Exactement ce que prévoyait §3.7, et jamais implémenté. Un bloc discret, une
seule fois, refusable : « {prénom} a son programme. L'autre parent, la nounou ou
les grands-parents peuvent le suivre aussi. » Le lien d'invitation existe déjà
(`HelpersManager`, `/rejoindre/[token]`) — il ne manque que le moment.

### P10 · PWA et icônes

Manifeste, icônes maskable, `apple-touch-icon`, `display: standalone`. Retirer
au passage les SVG par défaut de Next dans `public/`. Une journée, et
l'application cesse d'être un onglet parmi trente pour devenir une icône sur
l'écran d'accueil — préalable technique à P12.

### P11 · Rendre le sexe facultatif

Ne plus bloquer : ajouter « Je préfère ne pas dire », qui bascule la rédaction
sur les formulations sans accord (le produit sait déjà le faire — le message de
fin d'accompagnement est écrit exactement comme ça, sans pronom, et il fonctionne
très bien). Ou, plus radical, fusionner la question avec l'écran du prénom.

### P12 · Le rappel quotidien

Le levier de rétention le plus puissant identifié par la recherche, et le plus
délicat à doser pour un produit qui a fait de la non-culpabilisation son
principe fondateur (D8). Deux garde-fous, non négociables :

- **jamais de rappel de retard, jamais de série, jamais de pastille rouge.** Le
  rappel dit ce qu'il y a à cuisiner (« Ce midi : courgette et poire »), pas ce
  qui a été manqué ;
- **une notification par jour au maximum**, à une heure choisie par le parent,
  désactivable en un geste.

Web Push fonctionne sur iOS depuis 16.4, à condition que l'application soit
installée — d'où P10 en préalable. Un email quotidien optionnel est le repli si
l'on veut aller plus vite.

---

## 5. Séquence proposée

**Lot 1 — voir clair et arrêter la fuite** (≈ 3 jours)
P1, P2, P3, P4. Après ce lot, on sait où l'on perd les parents et on a colmaté
les deux ruptures franches (aperçu détruit, code sans renvoi).

**Lot 2 — alléger l'entrée** (≈ 3 jours)
P5, P6, P11. À lancer **après avoir lu les premières données de P1** : la courbe
d'abandon par étape dira si c'est l'écran 1 ou l'écran 6 qu'il faut traiter en
priorité, et évitera de refaire un parcours au jugé — le reproche que
`ux-redesign.md` §9.4 s'adresse déjà à lui-même.

**Lot 3 — transformer l'aperçu en engagement** (≈ 3 jours)
P7. Le plus rentable, le plus coûteux, et celui qui a besoin des deux premiers
lots pour être évalué.

**Lot 4 — installer l'habitude** (≈ 7 jours)
P8, P9, P10, P12. Dans cet ordre : on ne notifie pas quelqu'un qui n'a pas
compris le produit, et on n'installe pas une PWA dont la première session est
muette.

**En parallèle, et bloquant avant l'ouverture publique** — hors périmètre de ce
rapport mais rappelé ici parce qu'aucun travail d'activation ne compense un
manquement de ce type :

- les **trois témoignages de la landing sont fictifs** (`page.tsx:717-746`, un
  commentaire du code le signale déjà). Publier des avis inventés est une
  pratique commerciale trompeuse : à remplacer par de vrais retours, ou à
  retirer ;
- CGU et traitement RGPD des données de santé d'un mineur (`ux-redesign.md`
  §9.2 et §9.3) ;
- `roadmap.md` est périmé (dernière mise à jour le 2026-07-20 ; les itérations 7
  et 8 y sont « à faire » alors que `/stats` et `food-stats.ts` existent).

---

## Annexe — sources

- [Time to Value : The 2026 SaaS Onboarding Metrics Framework](https://www.digitalapplied.com/blog/customer-onboarding-time-to-value-2026-saas-metrics-framework)
- [The 2026 Customer Onboarding Benchmark Report — Activation Rates by Industry](https://getperspective.ai/blog/2026-customer-onboarding-benchmark-activation-rates-by-industry)
- [SaaS Onboarding Benchmarks 2026](https://productgrowth.in/insights/saas/saas-onboarding-benchmarks/)
- [Customer Onboarding Best Practices for SaaS in 2026](https://www.arcade.software/post/customer-onboarding-best-practices)
- [What Is Progressive Disclosure in UX ?](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)
- [The UX of Empty States](https://timgraf.com/ui/the-ux-of-empty-states-designing-moments-of-nothing-into-something-exceptional/)
- [35 Push Notification Best Practices That Work](https://clevertap.com/blog/push-notification-best-practices/)
- [Health App Engagement & Retention Guide](https://productgrowth.in/insights/healthtech/health-app-retention-guide/)
- [Mobile App Engagement in 2026 : Fixing the First Session](https://userpilot.com/blog/mobile-app-engagement/)
- Concurrence française observée : [Bévia](https://bevia.fr/),
  [1000 premiers jours](https://www.1000-premiers-jours.fr/fr/appli-et-autres-outils),
  Baby First Foods, Cuisinez pour bébé — aucune ne combine programme quotidien
  généré, protocole allergènes et commande vocale. Le positionnement tient.
