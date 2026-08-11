# Créneaux horaires — l'application sait quelle heure il est

> Un moment de repas n'est aujourd'hui qu'un nom et un rang. L'application sait
> donc dans quel **ordre** les repas se suivent, jamais **où on en est**. À 16 h,
> elle ne distingue pas ce qui est derrière nous de ce qui est devant : le dîner
> compte déjà comme mangé, le goûter n'est réclamé nulle part, et « il a mangé
> des courgettes » se range au petit bonheur.
>
> Cette fonctionnalité attache un **intervalle horaire** à chaque moment, et en
> tire partout la même conséquence : ce qui est passé, ce qui est en cours, ce
> qui reste à venir.
>
> S'appuie sur `suivi-reel-et-rattrapage.md` (les statuts et le rattrapage) et
> `commande-vocale.md` (la compréhension). Les numéros de § y renvoient.

---

## 1. Le constat

L'ordre suffit à afficher une journée. Il ne suffit à rien d'autre.

**Sur l'écran du jour.** Le curseur va au « premier repas dont le parent n'a rien
dit » (`today-meals.tsx`). Un petit-déjeuner oublié le retient donc toute la
journée : à 19 h, la fiche dépliée est celle du matin, et le dîner — le seul
repas que le parent vient chercher — est replié trois lignes plus bas. Le
rattrapage, lui, ne regarde que les jours **révolus** (`awaitsSignal`, `date <
todayISO`) : un repas d'aujourd'hui resté sans réponse n'est réclamé nulle part,
il attend minuit pour exister.

**Sur les aliments et les allergènes.** `getFoodStats` compte tout repas dont la
date est `<= aujourd'hui`. Le dîner de ce soir compte donc comme exposition dès
le réveil : à 8 h, le brocoli du soir est déjà « découvert », la pastille
« nouveauté » a disparu, et le programme croit avoir avancé d'un cran. Même
biais sur la page allergènes (`pastMeals = meals.filter(m => m.date <=
todayISO)`), là où l'asymétrie de confiance est censée être la plus stricte.

**Sur la commande vocale.** `resolution.ts` maintient une table de correspondance
entre un libellé et une heure conventionnelle — `/petit.?d[eé]j|matin/ → 8 h`,
`/go[uû]ter/ → 16 h` —, avec un étalement de 8 h à 20 h pour les libellés
inconnus. C'est une donnée métier déduite d'une expression régulière, et elle est
fausse dès qu'un foyer renomme ses moments. Surtout, elle ne sert qu'à une seule
question (« quel est le dernier repas passé ? ») : le **temps du verbe** — « il a
mangé », « il mange », « il mangera » — n'est exploité nulle part, alors que
c'est l'information que le parent donne le plus naturellement.

**Et une horloge fausse par-dessus.** Tout le code serveur fait `new Date()`.
En production, c'est l'heure de Vercel, donc UTC : entre minuit et 2 h du matin,
l'application croit encore être la veille. Le bug est aujourd'hui invisible parce
que rien ne dépend de l'heure ; il devient bloquant à la minute où quelque chose
en dépend.

## 2. La promesse, en une phrase

**L'application sait à tout instant quel repas vient de passer, lequel est en
cours et lequel arrive — et elle n'affirme rien sur un repas qui n'a pas encore
eu lieu.**

## 3. Le modèle : un moment est un intervalle

Trois règles, et rien d'autre à retenir.

1. **Un moment occupe un intervalle**, borne de début incluse, borne de fin
   exclue. `[6 h, 10 h[` contient 6 h 00 et ne contient pas 10 h 00.
2. **Deux moments ne se chevauchent jamais.** Ils peuvent se toucher : goûter
   `[15 h, 18 h[` et dîner `[18 h, 22 h[` sont contigus, et 18 h 00 appartient au
   dîner sans ambiguïté.
3. **La journée n'a pas à être couverte.** 3 h du matin n'appartient à aucun
   moment, 10 h 30 non plus. Ces trous sont **le cas normal**, pas une erreur de
   configuration — et ce sont eux qui rendent certaines phrases ambiguës (§7.3).

Un moment ne franchit pas minuit : `début < fin`, toujours. Un « dîner de 22 h à
2 h » n'existe pas — il faudrait deux intervalles, et aucune des règles ci-dessus
ne survivrait à un intervalle qui se replie sur lui-même. Si le besoin apparaît,
il se traitera par un second moment nommé, pas par un intervalle circulaire.

### 3.1 Les valeurs par défaut

| Moment         | Début | Fin  |
| -------------- | ----- | ---- |
| Petit-déjeuner | 6 h   | 10 h |
| Déjeuner       | 11 h  | 14 h |
| Goûter         | 15 h  | 18 h |
| Dîner          | 18 h  | 22 h |

Deux trous assumés — `[10 h, 11 h[` et `[14 h, 15 h[` — et une jointure franche
entre goûter et dîner. Ce sont exactement les cas que §7.3 doit savoir traiter :
un jeu de valeurs par défaut qui couvrirait la journée entière masquerait le
problème au lieu de le régler.

### 3.2 L'horloge du foyer

Le fuseau appartient au **foyer**, pas à l'appareil : les repas ont lieu chez
l'enfant, et un aidant en déplacement doit voir la journée du bébé, pas la
sienne. D'où une colonne `households.timezone` (défaut `Europe/Paris`),
renseignée au premier chargement depuis `Intl.DateTimeFormat().resolvedOptions()
.timeZone` si elle diffère du défaut, et jamais exposée dans l'interface pour
l'instant.

Conséquence immédiate, et c'est la partie qui touche tout le code existant :
**`new Date()` cesse d'être une source d'heure valable côté serveur.** Une
fonction unique la remplace, qui rend le jour et la minute du foyer :

```ts
// src/lib/clock.ts
export type Now = { todayISO: string; minutes: number; timeZone: string };
export function nowIn(timeZone: string, at: Date = new Date()): Now;
```

`minutes` compte les minutes depuis minuit local (`16 h 30` → `990`). Tout le
reste du produit ne manipule que ça : un entier, comparable, sérialisable,
testable sans geler l'horloge.

## 4. Modèle de données

### 4.1 Migration `0022_meal_moment_time_slots.sql`

```sql
create extension if not exists btree_gist;

alter table public.households
  add column timezone text not null default 'Europe/Paris';

alter table public.meal_moments
  add column start_minute int,
  add column end_minute   int;

-- Attribution des horaires aux moments existants, par libellé, dans l'ordre du
-- plus spécifique au plus général (« Petit-déjeuner » contient « déjeuner »).
-- Les moments qu'aucun motif ne reconnaît sont étalés sur les plages libres.
update public.meal_moments set start_minute = ..., end_minute = ... where ...;

alter table public.meal_moments
  alter column start_minute set not null,
  alter column end_minute   set not null,
  add constraint meal_moments_window check (
    start_minute >= 0 and end_minute <= 1440 and start_minute < end_minute
  ),
  add constraint meal_moments_no_overlap exclude using gist (
    household_id with =,
    int4range(start_minute, end_minute) with &&
  );
```

**Les horaires sont obligatoires.** Un moment sans heure serait un moment que
toutes les règles de §5 devraient traiter à part — jamais en cours, jamais passé,
jamais à venir —, c'est-à-dire une deuxième sémantique à maintenir partout pour
un cas que le produit ne demande pas.

**Le non-chevauchement est garanti en base.** La contrainte d'exclusion est ce
qui permet à `currentMoment()` de renvoyer un moment et non une liste : la règle 2
n'est pas une convention de code, c'est un invariant. `position` reste la colonne
d'affichage, mais devient **dérivée** : le gestionnaire la recalcule depuis
`start_minute` à chaque écriture, si bien que l'ordre affiché ne peut plus
contredire l'ordre horaire.

Les trois copies de `handle_new_user()` (migrations `0001`, `0007`, `0015`) et
`supabase/reset.sql` sèment désormais les quatre moments avec leurs horaires.

### 4.2 Types

`MealMoment` (`src/lib/data/meal-moments.ts`) et `MomentContext`
(`src/lib/voice/types.ts`) gagnent `startMinute` / `endMinute`. Les deux types
convergent — c'est déjà la même donnée écrite deux fois.

## 5. La bibliothèque pure — `src/lib/moments.ts`

Tout ce qui suit est **pur** : des moments, un entier de minutes, aucune base,
aucune horloge. C'est ce qui rend les règles de §7 rejouables dans le jeu de
tests sans geler le temps.

```ts
export type Phase = "past" | "current" | "future";

/** Le moment dont l'intervalle contient `minutes`. Null dans un trou. */
export function currentMoment(moments, minutes): MealMoment | null;

/** Le dernier moment déjà terminé (fin <= minutes). */
export function lastEndedMoment(moments, minutes): MealMoment | null;

/** Le premier moment pas encore commencé (début > minutes). */
export function nextMoment(moments, minutes): MealMoment | null;

/** Passé / en cours / à venir, pour un moment donné à un instant donné. */
export function phaseOf(moment, minutes): Phase;

/** « 11 h – 14 h », pour l'affichage. */
export function windowLabel(moment): string;
```

Et, pour un repas plutôt qu'un moment, la question que pose la moitié du
produit :

```ts
/**
 * Ce repas appartient-il au passé ?
 *
 * Deux façons de l'être, et la seconde est celle qui compte : le créneau est
 * terminé, **ou** le parent s'est prononcé. Un déjeuner marqué « servi » à
 * 12 h 30 est mangé, même si son créneau court jusqu'à 14 h — l'application ne
 * doit pas oublier pendant une heure ce qu'on vient de lui dire.
 */
export function isPastMeal(meal, moment, now): boolean;
```

C'est cette fonction, et non une comparaison de dates, qui décide désormais
qu'un aliment est « déjà consommé ».

## 6. Les écrans

### 6.1 Aujourd'hui — le repas devant soi, toujours

Le curseur de `TodayMeals` ne suit plus « le premier repas non renseigné » mais
**l'horloge** : le moment en cours s'il y en a un, sinon le prochain à venir,
sinon le dernier terminé (`lastEndedMoment`) — soit, dans les trois cas, le repas
le plus proche de l'heure qu'il est. Un petit-déjeuner oublié ne retient plus
rien : il redevient une ligne repliée à sa place chronologique, et c'est le bloc
de rattrapage qui le réclame.

Deux précisions, et la première est celle qui manquait au premier jet :

- **le curseur ne s'arrête que sur un repas resté sans réponse.** Sinon le
  « Ce repas est fait » du déjeuner rouvrait le déjeuner : la fiche se repliait
  le temps d'un aller-retour serveur, puis le curseur — qui ne regardait que
  l'heure — la désignait de nouveau. Le geste semblait sans effet, et la règle 2
  (« un repas renseigné se replie ») était contredite par la règle 1. Une journée
  entièrement renseignée n'a donc plus aucune fiche dépliée, et c'est le bon
  état : il ne reste rien à faire ;
- **le dernier cran n'est pas « le dernier repas de la journée ».** Il l'a été,
  et la liste finissait par un repas que l'heure avait quitté depuis longtemps.
  C'est le dernier créneau _terminé_ : à 20 h, sans dîner au programme, ce sera
  le goûter. À 2 h du matin, le prochain repas est déjà le petit-déjeuner, et la
  cascade s'arrête avant d'arriver à ce cran-là.

Chaque ligne repliée annonce son créneau (« Déjeuner · 11 h – 14 h ») et le
moment en cours porte un marqueur « maintenant ». Le numéro de rang de
`MealSummaryRow` (`position: i + 1`) perd son intérêt le jour où l'heure est
écrite : il cède la place.

Le garde-fou « Ce repas vient plus tard dans la journée » (`ahead`, aujourd'hui
calculé par différence avec le curseur) se lit désormais sur la phase :
`phaseOf(moment) === "future"`. Un repas passé ouvert à la main redevient
directement renseignable — c'est le geste qu'on attend de lui.

La ligne repliée, enfin, se lit à son fond. Tout ce qui a déjà eu son heure —
pris, sauté, ou resté sans réponse — porte le fond de carte de la fiche
dépliée : ces lignes racontent la journée réelle, elles appartiennent au même
plan qu'elle. Seul le repas à venir reste un contour en pointillés posé sur le
fond de page, parce qu'il n'a encore rien à raconter. Le gris uniforme qu'elles
portaient toutes mettait au second plan le repas de ce midi comme celui de ce
soir.

### 6.2 Le rattrapage et la journée en cours

`awaitsSignal` quitte `meals.types.ts` — où elle ne pouvait rien savoir de
l'heure — et devient `awaitsSignalAt` dans `lib/moments.ts` : au lieu de
`date < todayISO`, elle demande « le créneau de ce repas est-il terminé ? ».

**La bande de rattrapage, elle, s'en tient aux jours révolus.** Elle a couvert un
temps la journée en cours, pour qu'un repas de ce matin n'attende pas minuit
d'être réclamé. Mais le fil du jour est juste en dessous, et il montre déjà ces
repas-là : une ligne qui dit « à renseigner », un tap pour l'ouvrir sur le geste
complet. Le même déjeuner se demandait donc deux fois sur le même écran, avec
deux jeux de cibles différents à quelques centimètres l'un de l'autre. La bande
réclame ce qu'aucun autre écran ne montre — hier, avant-hier — et rien d'autre.

Ce qui en découle :

- **La confirmation groupée ne peut plus mordre sur l'avenir.**
  `confirmMealsAsPlanned(babyId, from, to)` marque « servi » tout ce qui est
  resté « prévu » entre deux dates. Bornée à aujourd'hui, elle aurait validé le
  dîner de ce soir ; bornée à hier, elle n'a devant elle que des journées
  complètes. La liste des moments encore ouverts qu'elle recevait en garde-fou
  (`openMomentIds`) n'a plus d'objet et disparaît.
- **Le seuil de fatigue.** La fenêtre est de deux jours glissants (§4.4 du suivi
  réel), soit deux jours de lignes au plus : c'est le seul endroit où la
  fonctionnalité _ajoute_ de la sollicitation, et le premier à surveiller aux
  tests.
- **`awaitsSignalAt` garde son sens complet ailleurs.** `week-planner.tsx` s'en
  sert pour poser le « ? » sur un repas passé du jour en cours : dans une grille
  de semaine, il n'y a pas de doublon, seulement un état à montrer.

`week-planner.tsx` portait la même règle en double (`unanswered = status ===
"prevu" && iso < todayISO`) : il passe par la fonction commune, et reçoit
l'instant du serveur au lieu de le lire dans `new Date()` — le navigateur d'un
aidant en déplacement n'a pas à décider quel jour on est chez l'enfant.

### 6.3 Expositions, découvertes, allergènes

`getFoodStats(babyId, todayISO)` devient `getFoodStats(babyId, now)` et exclut
les repas du jour qui ne sont pas encore passés au sens de `isPastMeal`. En
découlent, sans autre changement : la pastille « nouveauté » du jour, les
substituts proposés au remplacement, la liste `discovered` du contexte vocal,
les statistiques, la page Aliments.

Page **Allergènes** : `pastMeals` applique le même filtre, et la recherche de la
« 1ʳᵉ exposition prévue » redevient son exact complément. Un allergène servi au
dîner de ce soir s'affiche « prévu ce soir » jusqu'à 22 h, plus « introduit dès
le matin ».

### 6.4 Le gestionnaire de moments (caché)

`MealMomentsManager` gagne deux champs horaires par ligne et perd ses flèches de
réordonnancement : l'ordre découle des heures. Trois refus explicites, formulés
en français, à la saisie comme côté serveur :

- fin antérieure ou égale au début ;
- chevauchement avec un autre moment (avec le nom du moment en conflit) ;
- suppression du dernier moment restant.

La création propose le premier trou libre de la journée plutôt qu'un champ vide.
L'écran reste derrière `FEATURE_CUSTOM_MEALS`.

### 6.5 Ce qui ne bouge pas

`classifyMoment` (`program/schedule.ts`) continue de lire le **libellé** pour
décider des catégories ouvertes : « Collation » à 10 h n'est pas un déjeuner, et
c'est la nature du repas, pas son heure, qui commande le contenu de l'assiette.
Les horaires ne descendent pas dans le générateur.

## 7. La commande vocale

### 7.1 Ce que le modèle voit

Le **bloc caché** (`catalogBlock`) porte les moments avec leurs horaires : c'est
une donnée stable pour un foyer, elle reste du bon côté de la coupure de cache
(§4.3 du vocal).

```
- Petit-déjeuner, de 6 h à 10 h → moment_id : …
```

Le **bloc volatile** (`todayBlock`) situe l'instant, en toutes lettres plutôt
qu'en calcul :

```
Il est 16 h 20. Nous sommes dans le créneau du Goûter.
Le dernier repas terminé est le Déjeuner. Le prochain est le Dîner.
```

Le modèle ne compare donc jamais deux heures — même principe que le calendrier
tout fait de §4.6 : ce qui se lit dans une table ne se calcule pas.

La table `MOMENT_HOURS` de `resolution.ts` disparaît, avec `momentHours()`.

### 7.2 Le temps du verbe devient un paramètre

Le paramètre `nature` (`constat` / `prevision`) ne suffit pas : il ne distingue
pas « il mange de la pomme » de « il mangera de la pomme », or c'est précisément
là que se joue l'ambiguïté. Le fragment de créneau (`slotSchema`) gagne donc un
champ, obligatoire partout où il apparaît, sur le modèle de `appreciation` — un
champ facultatif serait purement et simplement omis (§ des outils) :

```
temps : « passe »   — passé composé, imparfait : « il a mangé », « c'était »
        « present » — présent : « il mange », « il est en train de manger »
        « futur »   — futur, futur proche : « il mangera », « il va manger »
```

`nature` reste ce qu'il est : ce qui décide entre journaliser et verrouiller un
créneau. `temps` ne décide que du **créneau visé**. Les deux ne se recouvrent pas
— « il a mangé des carottes demain » n'existe pas, mais « il mange des carottes
ce soir » est un constat au présent qui vise l'avenir.

### 7.3 Les règles de déduction

Quand le parent **nomme** le repas (« ce midi », « au goûter »), rien ne se
déduit : le moment nommé gagne, toujours.

Quand il ne le nomme pas et que le jour visé est **aujourd'hui** :

| `temps`   | On est dans un créneau                                      | On est dans un trou        |
| --------- | ----------------------------------------------------------- | -------------------------- |
| `passe`   | le créneau en cours                                         | le dernier créneau terminé |
| `present` | le créneau en cours                                         | **ambigu → on demande**    |
| `futur`   | le créneau en cours s'il est encore vide, sinon le prochain | le prochain créneau        |

Les exemples du cadrage, vérifiés ligne à ligne :

| Heure   | Phrase                           | `temps`   | Résultat                    |
| ------- | -------------------------------- | --------- | --------------------------- |
| 10 h 30 | « Mathis mangera de la pomme »   | `futur`   | Déjeuner (prochain créneau) |
| 11 h 30 | « Mathis mangera de la pomme »   | `futur`   | Déjeuner (créneau en cours) |
| 11 h 30 | « Mathis va manger de la pomme » | `futur`   | Déjeuner (créneau en cours) |
| 10 h 30 | « Mathis mange de la pomme »     | `present` | **on demande** — entre deux |
| 12 h 30 | « Il a mangé des courgettes »    | `passe`   | Déjeuner (créneau en cours) |
| 14 h 30 | « Il a mangé des courgettes »    | `passe`   | Déjeuner (dernier terminé)  |
| 16 h 00 | « Il a mangé des courgettes »    | `passe`   | Goûter (créneau en cours)   |

**Aux bords de la journée, on déborde sur le jour voisin.** À 5 h, « il a mangé
des céréales » vise le dîner d'hier ; à 23 h, « il mangera de la pomme » vise le
petit-déjeuner de demain. La recherche du dernier créneau terminé et celle du
prochain créneau ne s'arrêtent donc pas à minuit — elles reculent ou avancent
d'un jour, une seule fois. Le résultat est affiché avec sa date (« hier ·
Dîner ») et modifiable d'un tap : on épargne un geste, on ne décide pas à la
place du parent.

Quand le jour visé **n'est pas** aujourd'hui, les règles actuelles tiennent et ne
changent pas : un jour écoulé vise son dernier repas, un jour à venir vise le
repas de midi. Le temps du verbe n'y ajoute rien — « samedi » a déjà tranché.

### 7.4 L'ambiguïté ne jette pas la phrase

Une déduction impossible ne fait pas perdre les aliments compris. `ResolvedSlot`
gagne un drapeau à côté de `momentInferred` :

```ts
/** Aucun créneau ne s'impose : le parent doit trancher. */
momentAmbiguous: boolean;
```

L'intention part alors avec `ready: false` et une question courte
(« Petit-déjeuner ou déjeuner ? »), le moment provisoire étant le plus proche
dans le temps. `VoiceIntentBlock` ouvre déjà son sélecteur de moment de lui-même
quand `momentInferred` est vrai : il suffit qu'il l'ouvre aussi ici, avec le
libellé « Deviné » remplacé par la question. Un tap sur une pastille rend
l'intention exécutable — c'est un geste, contre une phrase entière à redire.

### 7.5 Le contexte du modèle vieillit

`loadVoiceContext` lit l'heure au moment de la requête. Rien à changer, sinon la
source de `now` (§3.2) — et le fait que `discovered` hérite du filtre de §6.3 :
le modèle cesse d'annoncer comme découvert un aliment prévu le soir même.

## 8. Le jeu de tests

### 8.1 Famille L — les créneaux horaires

Une nouvelle famille dans `scripts/fixtures/voice-cases.jsonl`, seuil à 100 % :
la seule chose qu'on y demande au modèle est de nommer le temps du verbe. Un cas
y gagne un champ facultatif `now` qui remplace l'heure du contexte de
référence — sans quoi la famille entière testerait une ligne d'un tableau qui en
compte quatorze.

L'horloge du foyer de référence passe au passage de 18 h 40 à **17 h 00**. Avec
les horaires par défaut, 18 h 40 tombe désormais **dans** le créneau du dîner,
alors que les cas historiques (A7, B3, B4, C4, I3, I4…) visent tous « le dernier
repas », c'est-à-dire le goûter. 17 h 00 les laisse viser la même cible, et pour
la bonne raison cette fois : le goûter est le créneau **en cours**.

| Id  | `now`   | Phrase                                 | Attendu                            |
| --- | ------- | -------------------------------------- | ---------------------------------- |
| L1  | 10 h 30 | « Mathis mangera de la pomme »         | logMeal · Déjeuner · prévision     |
| L2  | 11 h 30 | « Mathis mangera de la pomme »         | logMeal · Déjeuner · prévision     |
| L3  | 11 h 30 | « Mathis va manger de la pomme »       | logMeal · Déjeuner · prévision     |
| L4  | 10 h 30 | « Mathis mange de la pomme »           | ambigu · sélecteur ouvert          |
| L5  | 12 h 30 | « Il a mangé des courgettes »          | logMeal · Déjeuner · constat       |
| L6  | 14 h 30 | « Il a mangé des courgettes »          | logMeal · Déjeuner · constat       |
| L7  | 16 h 00 | « Il a mangé des courgettes »          | logMeal · Goûter · constat         |
| L8  | 16 h 00 | « Il a mangé des courgettes ce matin » | logMeal · Petit-déjeuner (nommé)   |
| L9  | 23 h 30 | « Demain il mangera des céréales »     | logMeal · demain · midi (jour dit) |
| L10 | 23 h 30 | « Il mangera des céréales »            | logMeal · demain · Petit-déjeuner  |
| L11 | 5 h 00  | « Il a bien mangé »                    | rateMeal · hier · Dîner            |
| L12 | 16 h 00 | « Il n'a rien mangé »                  | skipMeal · Goûter                  |
| L13 | 14 h 30 | « Il mange des courgettes »            | ambigu · sélecteur ouvert          |
| L14 | 19 h 00 | « Il a adoré le goûter »               | rateMeal · Goûter (nommé)          |

### 8.2 Invariants

`scripts/voice-invariants.test.ts` reçoit deux propriétés de plus, qui doivent
tenir quoi que raconte le modèle :

- **une ambiguïté n'est jamais exécutable** — `momentAmbiguous` implique
  `ready === false` et une question non vide. Un créneau qui avoue ne pas savoir
  tout en restant validable serait pire que celui qui devinait en silence ;
- **le jour déduit ne dérive jamais de plus d'un jour** par rapport à celui que
  le parent a demandé. Le test balaie neuf heures de la journée × trois jours ×
  trois temps : le débordement des bords est voulu, deux jours ne le seraient
  plus.

### 8.3 Sans modèle

Deux fichiers, aucune clé d'API, et c'est là que se joue la vraie couverture — la
famille L ne vérifie que la capacité du modèle à nommer le temps du verbe.

- **`scripts/moments.test.ts`** (`npm run moments:test`) — les règles pures :
  bornes incluses/exclues, la jonction de 18 h 00, les trous, les deux bords de
  journée, `isPastMeal` avec et sans témoignage du parent, la cascade du curseur
  du fil du jour (§6.1) et la validation du gestionnaire de moments
  (chevauchement, créneau libre proposé).
- **`scripts/voice-slots.test.ts`** (`npm run voice:slots`) — le tableau de §7.3,
  une ligne par test, en passant par le vrai `resolveIntents` : dans un créneau
  les trois temps convergent, dans un trou le temps du verbe fait tout, un moment
  ou un jour nommé écrase toute déduction, et un `temps` absent retombe sur le
  comportement d'avant les créneaux.

`npm test` joue les trois fichiers d'un coup — 48 cas, sans réseau.

## 9. Découpage en lots

**Lot 1 — le socle.** Migration `0022`, `households.timezone`, `src/lib/clock.ts`,
`src/lib/moments.ts` et ses tests, types étendus. Aucun changement visible.

**Lot 2 — les écrans.** Curseur d'aujourd'hui, `isPastMeal` branché sur les
expositions et les allergènes, affichage des créneaux, gestionnaire de moments.
C'est le lot que le parent voit. Le rattrapage y avait absorbé le jour en cours ;
il est revenu aux jours révolus (§6.2), le fil du jour faisant le travail mieux
que lui.

**Lot 3 — le vocal.** Contexte, paramètre `temps`, règles de déduction,
ambiguïté, famille L et invariants.

Les lots sont livrables séparément : après le lot 1 le produit est inchangé,
après le lot 2 il est déjà juste, le lot 3 ajoute la compréhension.

### 9.1 Ce qu'il reste à faire à la main

La migration n'est pas rejouée automatiquement : **exécuter
`supabase/migrations/0022_meal_moment_time_slots.sql` dans le SQL Editor de
Supabase** avant de déployer. Elle est ré-exécutable, et elle échoue franchement
si un foyer a plus de vingt-quatre moments sans horaire reconnaissable — auquel
cas le message dit lequel supprimer.

Reste ouvert, une fois la migration passée : rejouer `npm run voice:eval --
--family L` sur le modèle configuré, ce qui demande une clé d'API.

## 10. Ce qu'on ne fait pas

- **Pas d'heure sur le repas.** On situe le repas dans un créneau, on n'enregistre
  pas l'heure à laquelle l'enfant a mangé. Personne ne la demande, et la saisir
  coûterait le geste qu'on passe notre temps à supprimer.
- **Pas de notification.** Savoir qu'un créneau se termine ouvrirait la porte au
  rappel poussé ; c'est une autre fonctionnalité, avec son propre débat sur la
  culpabilisation.
- **Pas d'intervalle franchissant minuit** (§3), ni de créneaux différents selon
  le jour de la semaine.
- **Pas de réglage de fuseau dans l'interface.** La détection suffit tant que le
  produit est francophone.
