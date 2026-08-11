"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CalendarDays,
  Loader2,
  Sprout,
} from "lucide-react";
import { setupBaby, type BabySetup } from "@/lib/data/baby.actions";
import {
  readPendingSetup,
  savePendingSetup,
  clearPendingSetup,
} from "@/lib/pending-setup";
import { ageBetween, ageEligibility, daysUntilFirstBirthday } from "@/lib/age";
import { toISODate, addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateCalendar, formatLongDate } from "@/components/date-picker";
import { BrandMark } from "@/components/brand-mark";
import { BabyColorPicker } from "@/components/baby-color-picker";
import { SexePicker } from "@/components/sexe-picker";
import {
  DEFAULT_AVATAR_COLOR,
  resolveAvatarColor,
  type AvatarColor,
} from "@/lib/avatar-colors";
import { subjectPronoun, type Sexe } from "@/lib/sexe";
import { normalizePrenom, MAX_PRENOM_LENGTH } from "@/lib/prenom";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";

/**
 * Assistant de premier lancement (cf. docs/ux-redesign.md §3). Une question par
 * écran, réponse en un geste, progression visible. À la fin, tout est enregistré
 * d'un coup et le programme est généré automatiquement — aucun bouton « générer ».
 *
 * Étapes : prénom → sexe → naissance → point de départ → [rattrapage aliments +
 * allergènes si déjà commencé] → génération.
 *
 * Le même parcours sert à ajouter un enfant supplémentaire (mode « add ») : un
 * profil sans programme n'aurait aucun sens, quel que soit le rang de l'enfant.
 */

type StartChoice = "today" | "tomorrow" | "custom";

type Step =
  | "prenom"
  | "sexe"
  | "naissance"
  | "depart"
  | "quand"
  | "depuis"
  | "aliments"
  | "allergenes"
  | "gouts";

/**
 * Depuis combien de temps l'enfant mange solide. Ce n'est pas une coquetterie :
 * c'est cette durée, et non le seul âge, qui décide de la vitesse à laquelle le
 * programme ouvre les repas. Un enfant de 7 mois qui a commencé la semaine
 * dernière ne reçoit pas le programme d'un enfant de 7 mois diversifié depuis
 * trois mois.
 */
type SinceChoice = "1w" | "2w" | "1m" | "2m" | "custom";

const SINCE_DAYS: Record<Exclude<SinceChoice, "custom">, number> = {
  "1w": 7,
  "2w": 14,
  "1m": 30,
  "2m": 61,
};

/**
 * Les rayons proposés au rattrapage. Volontairement plus courts que le
 * catalogue : on demande au parent ce que l'enfant a déjà goûté, et personne ne
 * se souvient d'une pincée de cumin. Les doses (oléagineux, condiments) sont
 * donc absentes — la page « Aliments » les porte, pas ce questionnaire.
 */
const CATEGORY_ORDER = [
  "légume",
  "fruit",
  "protéine",
  "céréale",
  "légumineuse",
  "féculent",
  "laitier",
];
const CATEGORY_LABEL: Record<string, string> = {
  légume: "Légumes",
  fruit: "Fruits",
  protéine: "Viandes, poissons, œufs",
  céréale: "Céréales, pain, pâtes",
  légumineuse: "Légumineuses",
  féculent: "Pommes de terre et tubercules",
  laitier: "Produits laitiers",
};

export function Onboarding({
  foods,
  allergens,
  /**
   * « account » (défaut) : persiste en base et entre dans l'app.
   * « add » : même parcours pour un enfant supplémentaire du foyer. Rien à
   * reprendre (les réponses en attente appartiennent au premier enfant) et une
   * porte de sortie, puisque le parent peut renoncer sans être bloqué.
   * « preview » : ne touche pas la base, remonte les réponses à l'appelant qui
   * affiche l'aperçu du programme sans compte.
   */
  mode = "account",
  onPreviewComplete,
}: {
  foods: FoodRow[];
  allergens: AllergenRow[];
  mode?: "account" | "add" | "preview";
  onPreviewComplete?: (setup: BabySetup) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // En mode « account », des réponses peuvent avoir été données avant la
  // création du compte : on les rejoue au lieu de les redemander.
  const [resuming, setResuming] = useState(mode === "account");
  // Réponses en attente dont la reprise a échoué. Tant qu'elles sont là, on ne
  // renvoie surtout pas le parent vers un questionnaire vierge : il croirait
  // avoir tout perdu et resaisirait tout (bug constaté).
  const [resumeFailed, setResumeFailed] = useState<BabySetup | null>(null);
  // La reprise n'est tentée qu'une fois par montage : en développement, React
  // exécute les effets deux fois, ce qui créerait deux enfants identiques.
  const resumeAttempted = useRef(false);

  const [step, setStep] = useState<Step>("prenom");
  const [prenom, setPrenom] = useState("");
  const [avatarColor, setAvatarColor] =
    useState<AvatarColor>(DEFAULT_AVATAR_COLOR);
  const [sexe, setSexe] = useState<Sexe | null>(null);
  const [dateNaissance, setDateNaissance] = useState("");
  // Le champ date remonte une valeur à chaque frappe partiellement valide :
  // saisir « 2026 » passe par les années 0002, 0020, 0202… L'enfant est alors
  // momentanément jugé millénaire. On n'annonce donc le verdict d'éligibilité
  // qu'une fois la saisie confirmée par « Continuer ».
  const [naissanceSubmitted, setNaissanceSubmitted] = useState(false);
  const [alreadyStarted, setAlreadyStarted] = useState<boolean | null>(null);
  // Point de départ : trois options de même nature (une date), donc un choix
  // sélectionnable et non trois actions. « Aujourd'hui » est présélectionné —
  // c'est le cas de très loin le plus fréquent, et le parent n'a alors qu'un
  // seul geste à faire (cf. docs/ux-redesign.md §1.1, « zéro configuration »).
  const [startChoice, setStartChoice] = useState<StartChoice>("today");
  const [customStartISO, setCustomStartISO] = useState("");
  const [sinceChoice, setSinceChoice] = useState<SinceChoice>("2w");
  const [customSinceISO, setCustomSinceISO] = useState("");
  // Eczéma sévère ou allergie à l'œuf : le protocole LEAP demande un avis
  // médical avant l'arachide. On ne devine pas, on demande.
  const [atopicRisk, setAtopicRisk] = useState(false);
  const [tasted, setTasted] = useState<Set<string>>(new Set());
  const [exposed, setExposed] = useState<Map<string, boolean>>(new Map());
  const [favorite, setFavorite] = useState<string | null>(null);
  const [disliked, setDisliked] = useState<string | null>(null);

  const name = prenom.trim() || "bébé";
  const ageMonths = dateNaissance
    ? ageBetween(new Date(dateNaissance)).months
    : 0;
  // Le produit s'arrête au premier anniversaire : au-delà, on le dit et on
  // n'engage pas le parent plus loin (cf. docs/ux-redesign.md §3.3).
  const eligibility = dateNaissance
    ? ageEligibility(new Date(dateNaissance))
    : "ok";

  // Bornes du calendrier de naissance : pas de date future, et six ans de recul
  // — bien au-delà du périmètre du produit, pour qu'un parent d'enfant plus
  // grand puisse quand même saisir sa date et lire l'explication.
  const birthDateBounds = useMemo(() => {
    const today = new Date();
    const oldest = new Date(today);
    oldest.setFullYear(oldest.getFullYear() - 6);
    return { min: toISODate(oldest), max: toISODate(today) };
  }, []);

  // Dates du choix de départ, calculées une fois : les libellés affichés et la
  // valeur enregistrée doivent désigner exactement le même jour.
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const tomorrowISO = useMemo(() => toISODate(addDays(new Date(), 1)), []);
  // Un démarrage se décide à quelques jours près ; deux mois de latitude
  // couvrent largement « on attend la fin des vacances » et évitent qu'une
  // fausse manœuvre dans le calendrier fixe un départ dans trois ans.
  const startBounds = useMemo(
    () => ({ min: todayISO, max: toISODate(addDays(new Date(), 60)) }),
    [todayISO],
  );
  const startISO =
    startChoice === "today"
      ? todayISO
      : startChoice === "tomorrow"
        ? tomorrowISO
        : customStartISO;

  // Le premier jour de solide déclaré. Borné à la naissance : une diversification
  // ne peut pas avoir commencé avant l'enfant.
  const sinceBounds = useMemo(
    () => ({ min: dateNaissance || undefined, max: todayISO }),
    [dateNaissance, todayISO],
  );
  const startedOnISO =
    sinceChoice === "custom"
      ? customSinceISO
      : toISODate(addDays(new Date(), -SINCE_DAYS[sinceChoice]));

  // Aliments proposés au rattrapage : tout le catalogue, groupé — volontairement
  // SANS filtre d'âge. Ce rattrapage sert à savoir ce que l'enfant a réellement
  // goûté, y compris un aliment introduit plus tôt que nos repères ne le
  // conseillent ; masquer ces aliments nous priverait justement de cette
  // information (et de la possibilité d'en tenir compte ensuite).
  const catchUpFoods = useMemo(() => {
    const groups = new Map<string, FoodRow[]>();
    for (const f of foods) {
      if (!CATEGORY_LABEL[f.category ?? ""]) continue;
      const key = f.category ?? "autre";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(f);
    }
    return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({
      category: c,
      items: groups.get(c)!,
    }));
  }, [foods]);

  const tastedList = foods.filter((f) => tasted.has(f.id));

  // Une réaction déclarée à l'œuf est la seule réponse du questionnaire qui
  // rende le risque atopique plausible : sans elle, on sait déjà que l'allergie
  // à l'œuf n'est pas connue, et la question ne se pose donc pas au parent.
  const eggReaction = useMemo(
    () => allergens.some((a) => a.name === "Œuf" && exposed.get(a.id) === true),
    [allergens, exposed],
  );
  // La case ne compte que tant qu'elle est posée : si le parent revient sur la
  // réaction à l'œuf, sa réponse ne doit pas rester active hors de l'écran.
  const atopicRiskAnswer = atopicRisk && eggReaction;

  /**
   * Le prénom est mis sous sa forme définitive dès qu'on quitte l'étape : tout
   * le reste du parcours (« Léa a-t-elle déjà goûté… ») et l'aperçu du
   * programme l'affichent alors tel qu'il sera enregistré.
   */
  function goToSexe() {
    setPrenom(normalizePrenom(prenom));
    setStep("sexe");
  }

  function toggleTasted(id: string) {
    setTasted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllergen(id: string, value: boolean | null) {
    setExposed((prev) => {
      const next = new Map(prev);
      if (value === null) next.delete(id);
      else next.set(id, value);
      return next;
    });
  }

  /**
   * Persiste les réponses en base puis entre dans l'app.
   *
   * `resumed` distingue les réponses données avant le compte : en cas d'échec,
   * elles ne sont ni effacées ni oubliées — l'écran de reprise propose de
   * réessayer, sinon le parent les resaisirait toutes.
   */
  const persist = useCallback(
    (payload: BabySetup, resumed = false) => {
      startTransition(async () => {
        const res = await setupBaby(payload);
        if (res.error) {
          setError(res.error);
          setResuming(false);
          if (resumed) setResumeFailed(payload);
          return;
        }
        clearPendingSetup();
        router.replace("/aujourdhui");
        router.refresh();
      });
    },
    [router],
  );

  // Reprise : le parent a répondu avant de créer son compte → on applique ses
  // réponses directement, sans lui refaire remplir le questionnaire.
  useEffect(() => {
    if (mode !== "account" || resumeAttempted.current) return;
    resumeAttempted.current = true;
    const pending = readPendingSetup();
    if (pending) {
      // Le questionnaire peut dater d'hier (compte créé le lendemain) : un
      // programme ne démarre jamais dans le passé.
      persist(
        pending.startISO < todayISO
          ? { ...pending, startISO: todayISO }
          : pending,
        true,
      );
    }
    // Rien à reprendre : on bascule sur le questionnaire. Mise à jour non
    // urgente, différée pour ne pas déclencher de rendu en cascade.
    else startTransition(() => setResuming(false));
  }, [mode, persist, todayISO]);

  /**
   * Réinjecte des réponses déjà données dans le questionnaire, positionné à sa
   * dernière étape : le parent relit, corrige au besoin, et revalide — il ne
   * repart jamais d'un écran vide.
   */
  const applySetup = useCallback(
    (s: BabySetup) => {
      setPrenom(s.prenom);
      setAvatarColor(resolveAvatarColor(s.avatarColor));
      // Sexe absent : on ne le devine pas, la question sera reposée.
      setSexe(s.sexe === "fille" || s.sexe === "garcon" ? s.sexe : null);
      setDateNaissance(s.dateNaissance);
      setNaissanceSubmitted(true);
      setTasted(new Set(s.tastedFoodIds));
      setExposed(
        new Map(s.exposedAllergens.map((a) => [a.allergenId, a.hadReaction])),
      );
      setFavorite(s.favoriteFoodId ?? null);
      setDisliked(s.dislikedFoodId ?? null);
      setAtopicRisk(s.atopicRisk ?? false);
      if (
        s.diversificationStartedOn &&
        s.diversificationStartedOn < s.startISO
      ) {
        setSinceChoice("custom");
        setCustomSinceISO(s.diversificationStartedOn);
      }

      // « Déjà commencé » n'est pas conservé tel quel : ce qui a été goûté ou
      // rencontré le raconte aussi bien, et c'est la seule chose qui change la
      // suite du parcours.
      const started =
        s.tastedFoodIds.length > 0 || s.exposedAllergens.length > 0;
      setAlreadyStarted(started);
      if (!started) {
        if (s.startISO === tomorrowISO) setStartChoice("tomorrow");
        else if (s.startISO > tomorrowISO) {
          setStartChoice("custom");
          setCustomStartISO(s.startISO);
        } else setStartChoice("today");
      }
      setStep(started ? "gouts" : "quand");
    },
    [tomorrowISO],
  );

  function finish() {
    setError(null);
    const payload: BabySetup = {
      prenom: normalizePrenom(prenom),
      avatarColor,
      sexe,
      dateNaissance,
      startISO: alreadyStarted ? todayISO : startISO,
      // Deux horloges distinctes : `startISO` dit quand le programme commence,
      // `diversificationStartedOn` depuis quand l'enfant mange solide.
      diversificationStartedOn: alreadyStarted ? startedOnISO : startISO,
      atopicRisk: atopicRiskAnswer,
      tastedFoodIds: [...tasted],
      favoriteFoodId: favorite,
      dislikedFoodId: disliked,
      exposedAllergens: [...exposed.entries()].map(
        ([allergenId, hadReaction]) => ({
          allergenId,
          hadReaction,
        }),
      ),
    };

    if (mode === "preview") {
      savePendingSetup(payload);
      onPreviewComplete?.(payload);
      return;
    }
    persist(payload);
  }

  if (resuming) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <BrandMark />
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-muted-foreground">
            On prépare le programme de votre bébé…
          </p>
        </div>
      </main>
    );
  }

  // L'enregistrement des réponses données avant le compte a échoué. Elles sont
  // toujours là : on le dit, et on propose de réessayer plutôt que de faire
  // recommencer le questionnaire.
  if (resumeFailed) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <BrandMark />
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-soft">
            <h1 className="font-heading text-xl font-semibold tracking-tight">
              On n'a pas réussi à enregistrer le programme de{" "}
              {resumeFailed.prenom}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Vos réponses sont conservées, rien n'est perdu.
            </p>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-6 space-y-2">
              <Button
                size="lg"
                className="w-full gap-1.5"
                disabled={isPending}
                onClick={() => {
                  setError(null);
                  setResumeFailed(null);
                  setResuming(true);
                  persist(resumeFailed, true);
                }}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Réessayer
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  applySetup(resumeFailed);
                  setResumeFailed(null);
                }}
              >
                Revoir mes réponses
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        {mode === "add" ? (
          // Ajout d'un enfant : le parent n'est pas captif, il doit pouvoir
          // ressortir à n'importe quelle étape sans profil à moitié créé.
          <div className="mb-8 flex items-center justify-between gap-3">
            <BrandMark />
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/aujourdhui" />}
            >
              Annuler
            </Button>
          </div>
        ) : (
          <div className="mb-8 flex justify-center">
            <BrandMark />
          </div>
        )}

        <Progress step={step} alreadyStarted={alreadyStarted} />

        {/* L'enregistrement peut échouer depuis n'importe quelle étape (une
            reprise ratée ramène ici) : le message vit donc au-dessus du
            questionnaire, et non dans les seules étapes qui le déclenchent. */}
        {error && (
          <p className="mt-6 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 rounded-lg border bg-card p-6 shadow-soft">
          {step === "prenom" && (
            <StepShell
              title={
                mode === "add"
                  ? "Qui rejoint le foyer ?"
                  : "Comment s'appelle votre bébé ?"
              }
              subtitle={
                mode === "add"
                  ? "Quelques questions, et son programme sera prêt lui aussi."
                  : "On personnalise tout le reste avec son prénom."
              }
            >
              <Input
                autoFocus
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                // La mise en forme attend la validation de l'étape : normaliser
                // à chaque frappe empêcherait de saisir « Jean Jacques »,
                // l'espace étant supprimé avant la lettre suivante.
                onBlur={() => setPrenom(normalizePrenom(prenom))}
                maxLength={MAX_PRENOM_LENGTH}
                placeholder="Ex. Léa"
                className="h-12 text-base"
                onKeyDown={(e) =>
                  e.key === "Enter" && prenom.trim() && goToSexe()
                }
              />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Choisissez sa couleur
                </p>
                <BabyColorPicker
                  value={avatarColor}
                  onChange={setAvatarColor}
                  prenom={prenom}
                  showInitial={false}
                  swatchClassName="size-8"
                  gapClassName="gap-2"
                />
              </div>
              <Nav onNext={goToSexe} nextDisabled={!prenom.trim()} />
            </StepShell>
          )}

          {step === "sexe" && (
            <StepShell
              title={`${name}, c'est une fille ou un garçon ?`}
              subtitle="C'est ce qui nous permet d'employer les bons mots partout dans l'app."
            >
              <SexePicker value={sexe} onChange={setSexe} />
              <Nav
                onBack={() => setStep("prenom")}
                onNext={() => setStep("naissance")}
                nextDisabled={!sexe}
              />
            </StepShell>
          )}

          {step === "naissance" && (
            <StepShell
              title={`Quelle est la date de naissance de ${name} ?`}
              subtitle="Cela nous sert à adapter chaque repas à son âge."
            >
              <DateCalendar
                value={dateNaissance}
                min={birthDateBounds.min}
                max={birthDateBounds.max}
                aria-label={`Date de naissance de ${name}`}
                onChange={(iso) => {
                  setDateNaissance(iso);
                  setNaissanceSubmitted(false);
                }}
              />
              {naissanceSubmitted && eligibility === "too-old" && (
                <OutOfScopeNotice
                  name={name}
                  ageMention={
                    ageMonths >= 24 ? "À son âge" : `À ${ageMonths} mois`
                  }
                />
              )}
              {dateNaissance && eligibility !== "too-old" && (
                <p className="rounded-md bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
                  Naissance le {formatLongDate(dateNaissance)} — {name} a{" "}
                  {formatAgeLong(new Date(dateNaissance))}.
                  {eligibility === "ending-soon" && (
                    <>
                      {" "}
                      Le programme s'arrêtera à son premier anniversaire, dans{" "}
                      {weeksLabel(
                        daysUntilFirstBirthday(new Date(dateNaissance)),
                      )}
                      . C'est court, mais tout ce qui est prévu d'ici là reste
                      utile.
                    </>
                  )}
                </p>
              )}
              <Nav
                onBack={() => setStep("sexe")}
                onNext={() => {
                  setNaissanceSubmitted(true);
                  if (eligibility !== "too-old") setStep("depart");
                }}
                nextDisabled={
                  !dateNaissance ||
                  (naissanceSubmitted && eligibility === "too-old")
                }
              />
            </StepShell>
          )}

          {step === "depart" && (
            <StepShell
              title={`La diversification de ${name} a-t-elle déjà commencé ?`}
              subtitle="Pas d'inquiétude, on s'adapte à votre situation."
            >
              <div className="space-y-3">
                <ChoiceCard
                  label="Pas encore"
                  description="On démarre bientôt, ensemble."
                  onClick={() => {
                    setAlreadyStarted(false);
                    setStep("quand");
                  }}
                />
                <ChoiceCard
                  label={`Oui, ${subjectPronoun(sexe)} a déjà goûté des aliments`}
                  description="On récupère rapidement ce qui a déjà été fait."
                  onClick={() => {
                    setAlreadyStarted(true);
                    setStep("depuis");
                  }}
                />
              </div>
              <Nav onBack={() => setStep("naissance")} />
            </StepShell>
          )}

          {step === "quand" && (
            <StepShell
              title="On démarre quand ?"
              subtitle="Le programme commencera ce jour-là. Vous pourrez toujours l'ajuster plus tard."
            >
              <div
                role="radiogroup"
                aria-label="Premier jour du programme"
                className="space-y-2"
              >
                <SelectCard
                  label="Aujourd'hui"
                  description={formatLongDate(todayISO)}
                  selected={startChoice === "today"}
                  onClick={() => setStartChoice("today")}
                />
                <SelectCard
                  label="Demain"
                  description={formatLongDate(tomorrowISO)}
                  selected={startChoice === "tomorrow"}
                  onClick={() => setStartChoice("tomorrow")}
                />
                <SelectCard
                  label="Un autre jour"
                  description={
                    customStartISO
                      ? formatLongDate(customStartISO)
                      : "À choisir dans le calendrier"
                  }
                  icon={<CalendarDays className="size-5 shrink-0" />}
                  selected={startChoice === "custom"}
                  onClick={() => setStartChoice("custom")}
                />
                {/* Le calendrier n'apparaît qu'une fois l'option choisie : sinon
                    il concurrencerait visuellement les deux réponses rapides. */}
                {startChoice === "custom" && (
                  <div className="rounded-lg border-2 border-primary bg-card p-3">
                    <DateCalendar
                      value={customStartISO}
                      min={startBounds.min}
                      max={startBounds.max}
                      aria-label="Premier jour du programme"
                      onChange={setCustomStartISO}
                    />
                  </div>
                )}
              </div>
              <Nav
                onBack={() => setStep("depart")}
                onNext={finish}
                nextLabel="Voir son programme"
                nextDisabled={!startISO}
                nextLoading={isPending}
              />
            </StepShell>
          )}

          {step === "depuis" && (
            <StepShell
              title={`Depuis quand ${name} mange-t-${subjectPronoun(sexe)} solide ?`}
              subtitle="Une approximation suffit. C'est ce qui nous dit à quelle vitesse ouvrir les repas."
            >
              <div
                role="radiogroup"
                aria-label="Début de la diversification"
                className="space-y-2"
              >
                <SelectCard
                  label="Environ une semaine"
                  selected={sinceChoice === "1w"}
                  onClick={() => setSinceChoice("1w")}
                />
                <SelectCard
                  label="Environ deux semaines"
                  selected={sinceChoice === "2w"}
                  onClick={() => setSinceChoice("2w")}
                />
                <SelectCard
                  label="Environ un mois"
                  selected={sinceChoice === "1m"}
                  onClick={() => setSinceChoice("1m")}
                />
                <SelectCard
                  label="Deux mois ou plus"
                  selected={sinceChoice === "2m"}
                  onClick={() => setSinceChoice("2m")}
                />
                <SelectCard
                  label="Je connais la date"
                  description={
                    customSinceISO
                      ? formatLongDate(customSinceISO)
                      : "À choisir dans le calendrier"
                  }
                  icon={<CalendarDays className="size-5 shrink-0" />}
                  selected={sinceChoice === "custom"}
                  onClick={() => setSinceChoice("custom")}
                />
                {sinceChoice === "custom" && (
                  <div className="rounded-lg border-2 border-primary bg-card p-3">
                    <DateCalendar
                      value={customSinceISO}
                      min={sinceBounds.min}
                      max={sinceBounds.max}
                      aria-label="Premier repas solide"
                      onChange={setCustomSinceISO}
                    />
                  </div>
                )}
              </div>
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Les textures et les allergènes, eux, restent calés sur l'âge de{" "}
                {name} : ces étapes-là ne se rattrapent pas plus tard.
              </p>
              <Nav
                onBack={() => setStep("depart")}
                onNext={() => setStep("aliments")}
                nextDisabled={sinceChoice === "custom" && !customSinceISO}
              />
            </StepShell>
          )}

          {step === "aliments" && (
            <StepShell
              title={`Qu'est-ce que ${name} a déjà goûté ?`}
              subtitle="Touchez ce qui vous revient — inutile d'être exhaustif."
            >
              <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
                {catchUpFoods.map(({ category, items }) => (
                  <div key={category}>
                    <p className="mb-2 text-sm font-semibold text-muted-foreground">
                      {CATEGORY_LABEL[category]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {items.map((f) => (
                        <Pill
                          key={f.id}
                          label={f.name}
                          active={tasted.has(f.id)}
                          onClick={() => toggleTasted(f.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Nav
                onBack={() => setStep("depuis")}
                onNext={() => setStep("allergenes")}
                nextLabel={tasted.size ? "Continuer" : "Passer"}
              />
            </StepShell>
          )}

          {step === "allergenes" && (
            <StepShell
              title="Les allergènes"
              subtitle={`Est-ce que ${name} a déjà rencontré l'un de ces aliments ? C'est important pour sa sécurité.`}
            >
              <div className="max-h-[46vh] space-y-2 overflow-y-auto pr-1">
                {allergens.map((a) => (
                  <AllergenRowInput
                    key={a.id}
                    name={a.name}
                    value={exposed.has(a.id) ? exposed.get(a.id)! : null}
                    present={exposed.has(a.id)}
                    onNo={() => setAllergen(a.id, null)}
                    onYes={() => setAllergen(a.id, exposed.get(a.id) ?? false)}
                    onReaction={(v) => setAllergen(a.id, v)}
                  />
                ))}
              </div>
              {eggReaction && (
                <label className="flex cursor-pointer items-start gap-3 rounded-md border-2 border-transparent bg-muted px-4 py-3 transition-colors hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={atopicRisk}
                    onChange={(e) => setAtopicRisk(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm">
                    <span className="block font-semibold">
                      {name} a un eczéma sévère, ou une allergie à l'œuf déjà
                      connue
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      Dans ce cas l'arachide s'introduit après un avis médical :
                      le programme ne la placera pas seul.
                    </span>
                  </span>
                </label>
              )}
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                On ne demande pas laquelle : en cas de réaction, parlez-en à un
                professionnel de santé.
              </p>
              <Nav
                onBack={() => setStep("aliments")}
                onNext={() => setStep("gouts")}
                nextLabel="Continuer"
              />
            </StepShell>
          )}

          {step === "gouts" && (
            <StepShell
              title="Ses goûts (facultatif)"
              subtitle="Cela nous aide à composer des repas qui lui plaisent."
            >
              {tastedList.length > 0 ? (
                <div className="space-y-4">
                  <FavoritePicker
                    label={`Ce que ${name} préfère`}
                    items={tastedList}
                    value={favorite}
                    onChange={setFavorite}
                  />
                  <FavoritePicker
                    label={`Ce qu'${subjectPronoun(sexe)} aime le moins`}
                    items={tastedList}
                    value={disliked}
                    onChange={setDisliked}
                    tone="muted"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Rien à préciser pour l'instant — on avance !
                </p>
              )}
              <Nav
                onBack={() => setStep("allergenes")}
                onNext={finish}
                nextLabel="Voir son programme"
                nextLoading={isPending}
              />
            </StepShell>
          )}
        </div>
      </div>
    </main>
  );
}

/* ---------- sous-composants ---------- */

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Nav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continuer",
  nextLoading,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  nextLoading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      {onBack ? (
        <Button variant="ghost" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="size-4" />
          Retour
        </Button>
      ) : (
        <span />
      )}
      {onNext && (
        <Button
          onClick={onNext}
          disabled={nextDisabled || nextLoading}
          className="gap-1.5"
        >
          {nextLoading && <Loader2 className="size-4 animate-spin" />}
          {nextLabel}
          {!nextLoading && <ArrowRight className="size-4" />}
        </Button>
      )}
    </div>
  );
}

/**
 * Choix qui fait immédiatement avancer le parcours — la flèche annonce le
 * départ vers l'écran suivant. À ne pas confondre avec `SelectCard`, qui ne
 * fait que retenir une réponse.
 */
function ChoiceCard({
  label,
  description,
  onClick,
}: {
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-md border-2 border-transparent bg-muted px-4 py-4 text-left transition-colors",
        "hover:border-primary/40 hover:bg-secondary/60",
      )}
    >
      <span>
        <span className="block font-heading font-semibold">{label}</span>
        {description && (
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/**
 * Réponse à choisir parmi plusieurs équivalentes, validée ensuite par le bouton
 * du bas. Toutes les options ont exactement le même traitement visuel : seule
 * la coche distingue celle qui est retenue, pour qu'on ne puisse pas confondre
 * « sélectionné » avec « désactivé » ou « champ à remplir ».
 */
function SelectCard({
  label,
  description,
  selected,
  onClick,
  icon,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md border-2 px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-primary bg-secondary text-secondary-foreground"
          : "border-transparent bg-muted hover:border-primary/40 hover:bg-secondary/60",
      )}
    >
      {icon && (
        <span className={selected ? "text-primary" : "text-muted-foreground"}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-heading font-semibold">{label}</span>
        {description && (
          <span
            className={cn(
              "mt-0.5 block text-sm",
              selected
                ? "text-secondary-foreground/80"
                : "text-muted-foreground",
            )}
          >
            {description}
          </span>
        )}
      </span>
      {/* Pastille toujours présente : sans elle, les options non retenues
          paraîtraient amputées de quelque chose. */}
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30",
        )}
      >
        {selected && <Check className="size-3" />}
      </span>
    </button>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-secondary text-secondary-foreground"
          : "border-transparent bg-muted text-muted-foreground hover:bg-secondary/50",
      )}
    >
      {active && <Check className="size-3.5" />}
      {label}
    </button>
  );
}

function AllergenRowInput({
  name,
  value,
  present,
  onNo,
  onYes,
  onReaction,
}: {
  name: string;
  value: boolean | null;
  present: boolean;
  onNo: () => void;
  onYes: () => void;
  onReaction: (v: boolean) => void;
}) {
  return (
    <div className="rounded-md border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{name}</span>
        <div className="flex gap-1.5">
          <MiniToggle label="Non" active={!present} onClick={onNo} />
          <MiniToggle label="Oui" active={present} onClick={onYes} />
        </div>
      </div>
      {present && (
        <div className="mt-2.5 flex items-center justify-between gap-3 border-t pt-2.5">
          <span className="text-sm text-muted-foreground">Une réaction ?</span>
          <div className="flex gap-1.5">
            <MiniToggle
              label="Non"
              active={value === false}
              onClick={() => onReaction(false)}
            />
            <MiniToggle
              label="Oui"
              tone="warn"
              active={value === true}
              onClick={() => onReaction(true)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniToggle({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "warn";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-w-[3rem] rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
        active && tone === "warn" && "bg-novelty text-novelty-foreground",
        active && !tone && "bg-primary text-primary-foreground",
        !active && "bg-muted text-muted-foreground hover:bg-secondary/60",
      )}
    >
      {label}
    </button>
  );
}

function FavoritePicker({
  label,
  items,
  value,
  onChange,
  tone,
}: {
  label: string;
  items: FoodRow[];
  value: string | null;
  onChange: (id: string | null) => void;
  tone?: "muted";
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {items.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(value === f.id ? null : f.id)}
            className={cn(
              "rounded-full border-2 px-3.5 py-2 text-sm font-medium transition-colors",
              value === f.id
                ? tone === "muted"
                  ? "border-muted-foreground bg-muted text-foreground"
                  : "border-primary bg-secondary text-secondary-foreground"
                : "border-transparent bg-muted text-muted-foreground hover:bg-secondary/50",
            )}
          >
            {f.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Fil de progression : un point par étape franchie. */
function Progress({
  step,
  alreadyStarted,
}: {
  step: Step;
  alreadyStarted: boolean | null;
}) {
  const flow: Step[] =
    alreadyStarted === true
      ? [
          "prenom",
          "sexe",
          "naissance",
          "depart",
          "depuis",
          "aliments",
          "allergenes",
          "gouts",
        ]
      : ["prenom", "sexe", "naissance", "depart", "quand"];
  const idx = flow.indexOf(step);
  return (
    <div className="flex justify-center gap-1.5">
      {flow.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i <= idx ? "w-6 bg-primary" : "w-1.5 bg-muted",
          )}
        />
      ))}
    </div>
  );
}

/* ---------- helpers de libellé ---------- */

/**
 * Âge en toutes lettres pour la phrase de l'onboarding, ex. « 3 semaines »,
 * « 2 mois et 4 semaines », « 5 mois ». En dessous d'une semaine, on compte en jours.
 */
/**
 * L'enfant a passé son premier anniversaire : le produit ne le concerne plus.
 * Le refus est formulé comme une bonne nouvelle plutôt que comme une porte
 * fermée — on ne renvoie jamais un parent avec le sentiment d'avoir raté
 * quelque chose. Le texte s'en tient au prénom, sans pronom : rien à accorder,
 * donc rien qui puisse sonner faux.
 */
function OutOfScopeNotice({
  name,
  ageMention,
}: {
  name: string;
  ageMention: string;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-primary/25 bg-secondary/60 p-4">
      <Sprout className="mt-0.5 size-5 shrink-0 text-primary" />
      <div>
        <p className="font-heading font-semibold text-secondary-foreground">
          Le plus dur est derrière vous !
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-secondary-foreground">
          Petite Cuillère accompagne la diversification, des premières cuillères
          au premier anniversaire. {ageMention}, {name} mange peu à peu comme le
          reste de la famille : vous n'avez plus besoin de nous pour ça.
        </p>
      </div>
    </div>
  );
}

/** « 3 semaines », « 5 jours » — le délai restant, sans précision inutile. */
function weeksLabel(days: number): string {
  if (days < 14) return `${days} jour${days > 1 ? "s" : ""}`;
  const weeks = Math.round(days / 7);
  return `${weeks} semaines`;
}

function formatAgeLong(birth: Date): string {
  const { months, weeks, remainingDays } = ageBetween(birth);
  const parts: string[] = [];
  if (months > 0) parts.push(`${months} mois`);
  if (weeks > 0) parts.push(`${weeks} semaine${weeks > 1 ? "s" : ""}`);
  if (parts.length === 0) {
    return `${remainingDays} jour${remainingDays > 1 ? "s" : ""}`;
  }
  return parts.join(" et ");
}
