"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
 * First-run wizard (see docs/ux-redesign.md §3). One question per screen, an
 * answer in one gesture, visible progress. At the end everything is saved in one
 * go and the programme is generated automatically — no "generate" button.
 *
 * Steps: first name → sex → birth → starting point → [food and allergen catch-up
 * if already started] → generation.
 *
 * The same flow serves for adding another child ("add" mode): a profile without
 * a programme would make no sense, whatever the child's rank.
 */

type StartChoice = "today" | "tomorrow" | "custom";

/**
 * The hour past which "today" is no longer offered as a first day. The evening
 * meal has happened or is happening: starting the programme now means starting
 * it on a day already gone, which the parent will see the next morning as a
 * missed day.
 */
const LATEST_START_HOUR = 20;

/**
 * The parent's local time, which the server does not know: it prerenders at its
 * own, and a plain `new Date()` during render would break hydration. So the
 * server fallback answers "no", and the real answer arrives on the client — as
 * with local storage on the sign-in screen.
 *
 * Nothing to subscribe to, the clock warns nobody: the value is re-read on every
 * render, which is enough to cover a questionnaire started at 19:55.
 */
const subscribeToNothing = () => () => {};
const readTooLateForToday = () => new Date().getHours() >= LATEST_START_HOUR;

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
 * How long the child has been eating solids. Not a nicety: it is that duration,
 * and not age alone, that decides how fast the programme opens meals. A
 * 7-month-old who started last week does not get the programme of a
 * 7-month-old three months in.
 */
type SinceChoice = "1w" | "2w" | "1m" | "2m" | "custom";

const SINCE_DAYS: Record<Exclude<SinceChoice, "custom">, number> = {
  "1w": 7,
  "2w": 14,
  "1m": 30,
  "2m": 61,
};

/**
 * The aisles offered at catch-up. Deliberately shorter than the catalogue: we
 * ask the parent what the child has already tasted, and nobody remembers a pinch
 * of cumin. The doses (nut butters, condiments) are therefore absent — the
 * "Aliments" page carries them, not this questionnaire.
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
   * "account" (default): persists to the database and enters the app.
   * "add": the same flow for another child of the household. Nothing to resume
   * (pending answers belong to the first child) and an exit door, since the
   * parent can back out without being stuck.
   * "preview": does not touch the database, hands the answers back to the caller
   * that shows the no-account programme preview.
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
  // In "account" mode, answers may have been given before the account was
  // created: we replay them instead of asking again.
  const [resuming, setResuming] = useState(mode === "account");
  // Pending answers whose resume failed. While they are here we must not send
  // the parent back to a blank questionnaire: they would think everything was
  // lost and re-enter it all (an observed bug).
  const [resumeFailed, setResumeFailed] = useState<BabySetup | null>(null);
  // Resuming is attempted once per mount: in development React runs effects
  // twice, which would create two identical children.
  const resumeAttempted = useRef(false);

  const [step, setStep] = useState<Step>("prenom");
  const [prenom, setPrenom] = useState("");
  const [avatarColor, setAvatarColor] =
    useState<AvatarColor>(DEFAULT_AVATAR_COLOR);
  const [sexe, setSexe] = useState<Sexe | null>(null);
  const [dateNaissance, setDateNaissance] = useState("");
  // The date field emits a value on every partially valid keystroke: typing
  // "2026" passes through the years 0002, 0020, 0202… The child is momentarily
  // judged a millennium old. So we only announce the eligibility verdict once
  // the entry is confirmed with "Continuer".
  const [naissanceSubmitted, setNaissanceSubmitted] = useState(false);
  const [alreadyStarted, setAlreadyStarted] = useState<boolean | null>(null);
  // Starting point: three options of the same nature (a date), so a selectable
  // choice and not three actions. "Aujourd'hui" is preselected — by far the most
  // frequent case, and the parent then has a single gesture to make (see
  // docs/ux-redesign.md §1.1, "zero configuration"). Come evening, `startPick`
  // below moves that default to "tomorrow".
  const [startChoice, setStartChoice] = useState<StartChoice>("today");
  const [customStartISO, setCustomStartISO] = useState("");
  const tooLateForToday = useSyncExternalStore(
    subscribeToNothing,
    readTooLateForToday,
    () => false,
  );
  /*
   * The choice actually in force. "Aujourd'hui" stays the stored default — we do
   * not fix the state, we fix how it is read: past 8pm the card no longer
   * exists, and a selection pointing at an absent card is not repaired, it is
   * derived.
   */
  const startPick: StartChoice =
    tooLateForToday && startChoice === "today" ? "tomorrow" : startChoice;
  const [sinceChoice, setSinceChoice] = useState<SinceChoice>("2w");
  const [customSinceISO, setCustomSinceISO] = useState("");
  // Severe eczema or egg allergy: the LEAP protocol calls for medical advice
  // before peanut. We do not guess, we ask.
  const [atopicRisk, setAtopicRisk] = useState(false);
  const [tasted, setTasted] = useState<Set<string>>(new Set());
  const [exposed, setExposed] = useState<Map<string, boolean>>(new Map());
  const [favorite, setFavorite] = useState<string | null>(null);
  const [disliked, setDisliked] = useState<string | null>(null);

  const name = prenom.trim() || "bébé";
  const ageMonths = dateNaissance
    ? ageBetween(new Date(dateNaissance)).months
    : 0;
  // The product stops at the first birthday: beyond it we say so and do not
  // commit the parent any further (see docs/ux-redesign.md §3.3).
  const eligibility = dateNaissance
    ? ageEligibility(new Date(dateNaissance))
    : "ok";

  // Bounds of the birth calendar: no future date, and six years back — well
  // beyond the product's scope, so a parent of an older child can still enter
  // their date and read the explanation.
  const birthDateBounds = useMemo(() => {
    const today = new Date();
    const oldest = new Date(today);
    oldest.setFullYear(oldest.getFullYear() - 6);
    return { min: toISODate(oldest), max: toISODate(today) };
  }, []);

  // Dates for the start choice, computed once: the labels shown and the value
  // saved must point at exactly the same day.
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const tomorrowISO = useMemo(() => toISODate(addDays(new Date(), 1)), []);
  // A start is decided within a few days; two months of latitude covers "we're
  // waiting for the holidays to end" and stops a slip in the calendar setting a
  // start three years out. The calendar follows the same bound as the cards: the
  // day we no longer offer must not stay reachable through "another day".
  const startBounds = useMemo(
    () => ({
      min: tooLateForToday ? tomorrowISO : todayISO,
      max: toISODate(addDays(new Date(), 60)),
    }),
    [todayISO, tomorrowISO, tooLateForToday],
  );
  const startISO =
    startPick === "today"
      ? todayISO
      : startPick === "tomorrow"
        ? tomorrowISO
        : customStartISO;

  // The declared first day of solids. Bounded at birth: diversification cannot
  // have started before the child did.
  const sinceBounds = useMemo(
    () => ({ min: dateNaissance || undefined, max: todayISO }),
    [dateNaissance, todayISO],
  );
  const startedOnISO =
    sinceChoice === "custom"
      ? customSinceISO
      : toISODate(addDays(new Date(), -SINCE_DAYS[sinceChoice]));

  // Foods offered at catch-up: the whole catalogue, grouped — deliberately with
  // NO age filter. This catch-up is there to learn what the child has actually
  // tasted, including a food introduced earlier than our guidelines suggest;
  // hiding those foods would deprive us of exactly that information.
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

  // A declared reaction to egg is the only answer in the questionnaire that
  // makes atopic risk plausible: without it we already know the egg allergy is
  // not known, so the question is never put to the parent.
  const eggReaction = useMemo(
    () => allergens.some((a) => a.name === "Œuf" && exposed.get(a.id) === true),
    [allergens, exposed],
  );
  // The checkbox only counts while it is on screen: if the parent goes back on
  // the egg reaction, their answer must not stay active outside that screen.
  const atopicRiskAnswer = atopicRisk && eggReaction;

  /**
   * The first name takes its final form as soon as the step is left: the rest of
   * the flow ("Léa a-t-elle déjà goûté…") and the programme preview then show it
   * exactly as it will be saved.
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
   * Persists the answers to the database, then enters the app.
   *
   * `resumed` marks the answers given before the account existed: on failure
   * they are neither erased nor forgotten — the resume screen offers a retry,
   * otherwise the parent would re-enter them all.
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

  // Resume: the parent answered before creating their account → we apply
  // their answers directly, without making them fill the form in again.
  useEffect(() => {
    if (mode !== "account" || resumeAttempted.current) return;
    resumeAttempted.current = true;
    const pending = readPendingSetup();
    if (pending) {
      // The questionnaire may date from yesterday (account created the next
      // day): a programme never starts in the past.
      persist(
        pending.startISO < todayISO
          ? { ...pending, startISO: todayISO }
          : pending,
        true,
      );
    }
    // Nothing to resume: switch to the questionnaire. A non-urgent update,
    // deferred so it does not trigger a cascading render.
    else startTransition(() => setResuming(false));
  }, [mode, persist, todayISO]);

  /**
   * Feeds answers already given back into the questionnaire, positioned at its
   * last step: the parent re-reads, corrects if needed, and confirms again —
   * they never restart from a blank screen.
   */
  const applySetup = useCallback(
    (s: BabySetup) => {
      setPrenom(s.prenom);
      setAvatarColor(resolveAvatarColor(s.avatarColor));
      // No sex recorded: we do not guess it, the question will be asked again.
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

      // "Already started" is not kept as such: what has been tasted or met tells
      // it just as well, and that is the only thing that changes the rest of the
      // flow.
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
      // Two distinct clocks: `startISO` says when the programme starts,
      // `diversificationStartedOn` how long the child has been eating solids.
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

  // Saving the answers given before the account failed. They are still here: we
  // say so, and offer to retry rather than making them do the questionnaire
  // again.
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
          // Adding a child: the parent is not captive, they must be able to
          // leave at any step without a half-created profile.
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

        {/* Saving can fail from any step (a failed resume lands here): so the
            message lives above the questionnaire, not inside the steps that
            happen to trigger it. */}
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
                // Formatting waits for the step to be confirmed:
                // normalising on every keystroke would stop anyone typing
                // "Jean Jacques", the space being removed before the next
                // letter.
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
              subtitle={
                tooLateForToday
                  ? "La journée est déjà bien avancée : le programme commencera demain au plus tôt."
                  : "Le programme commencera ce jour-là. Vous pourrez toujours l'ajuster plus tard."
              }
            >
              <div
                role="radiogroup"
                aria-label="Premier jour du programme"
                className="space-y-2"
              >
                {/* After 8pm the card disappears rather than being disabled:
                    a greyed-out choice invites argument, an absent card does
                    not — and the subtitle has already said why. */}
                {!tooLateForToday && (
                  <SelectCard
                    label="Aujourd'hui"
                    description={formatLongDate(todayISO)}
                    selected={startPick === "today"}
                    onClick={() => setStartChoice("today")}
                  />
                )}
                <SelectCard
                  label="Demain"
                  description={formatLongDate(tomorrowISO)}
                  selected={startPick === "tomorrow"}
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
                  selected={startPick === "custom"}
                  onClick={() => setStartChoice("custom")}
                />
                {/* The calendar only appears once the option is chosen: otherwise
                    it would visually compete with the two quick answers. */}
                {startPick === "custom" && (
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
 * A choice that immediately moves the flow on — the arrow announces the
 * departure to the next screen. Not to be confused with `SelectCard`, which only
 * records an answer.
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
 * An answer chosen among equivalent ones, confirmed afterwards by the button at
 * the bottom. Every option gets exactly the same visual treatment: only the tick
 * marks the chosen one, so "selected" cannot be confused with "disabled" or
 * "field to fill in".
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
      {/* The badge is always there: without it, the unselected options would
          look like something had been cut off them. */}
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

/** Progress thread: one dot per step completed. */
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

/* ---------- label helpers ---------- */

/**
 * Age spelled out for the onboarding sentence, e.g. "3 semaines", "2 mois et 4
 * semaines", "5 mois". Under a week, we count in days.
 */
/**
 * The child is past their first birthday: the product no longer concerns them.
 * The refusal is worded as good news rather than a closed door — we never send a
 * parent away feeling they missed something. The copy sticks to the first name,
 * with no pronoun: nothing to agree, so nothing that can ring false.
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

/** "3 semaines", "5 jours" — the time left, with no needless precision. */
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
