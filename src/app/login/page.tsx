"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readPendingSetup } from "@/lib/pending-setup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SpoonIcon } from "@/components/brand-mark";
import {
  AuthDivider,
  GoogleSignInButton,
} from "@/components/google-sign-in-button";

/**
 * Sign-in by 6-digit code (see docs/ux-redesign.md §3.6). The parent receives the
 * code by email and types it without ever leaving the app — unlike the magic
 * link, which forces an app switch. The link stays in the same email as a
 * fallback for whoever prefers to click.
 *
 * Google comes second: it is the shortcut for whoever has a Google account, but
 * passwordless email stays the default entry — it assumes nothing about the
 * parent.
 *
 * Supabase prerequisite: the email templates must expose {{ .Token }} (the code)
 * as well as {{ .ConfirmationURL }} — **"Magic Link" AND "Confirm signup"**, the
 * latter being the one received on first sign-in. Without that, the parent gets
 * a magic link whatever this component does: the email's content depends only on
 * the template. See `supabase/email-templates/`.
 */
/** The pending answers do not change while this screen is on display. */
const subscribeToNothing = () => () => {};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  // First name of the baby whose questionnaire is waiting to be attached to an
  // account. Local storage does not exist during server rendering, so
  // `useSyncExternalStore` renders the screen neutral on the server, then
  // personalises it on hydration with no mismatch.
  const pendingPrenom = useSyncExternalStore(
    subscribeToNothing,
    () => readPendingSetup()?.prenom ?? null,
    () => null,
  );

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("idle");
      setPhase("code");
      setTimeout(() => codeRef.current?.focus(), 50);
    }
  }

  async function verifyCode(value: string) {
    setStatus("loading");
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: value,
      type: "email",
    });
    if (error) {
      setStatus("error");
      setMessage("Code incorrect ou expiré. Réessayez.");
      setCode("");
      codeRef.current?.focus();
    } else {
      router.replace("/aujourdhui");
      router.refresh();
    }
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (status === "error") setStatus("idle");
    if (digits.length === 6) verifyCode(digits);
  }

  return (
    <main className="relative grid min-h-screen place-items-center bg-background px-4 py-20">
      {/*
       * Escape hatch back to the landing. Without it, a visitor who arrived here
       * out of curiosity has no way back: the page has neither site header nor
       * footer.
       */}
      <Link
        href="/"
        className="absolute top-5 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground md:top-7 md:left-7"
      >
        <ArrowLeft className="size-4" />
        Retour à l'accueil
      </Link>

      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex flex-col items-center text-center"
          aria-label="Petite Cuillère, accueil"
        >
          <span className="blob grid size-14 place-items-center bg-apricot text-apricot-foreground">
            <SpoonIcon className="size-7" />
          </span>
          <span className="mt-4 font-heading text-2xl font-bold">
            Petite Cuillère
          </span>
          <span className="mt-1 text-sm text-muted-foreground">
            Les premiers repas de bébé, en toute confiance.
          </span>
        </Link>

        {phase === "email" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {pendingPrenom
                  ? `On garde le programme de ${pendingPrenom}`
                  : "Connexion"}
              </CardTitle>
              <CardDescription>
                {pendingPrenom
                  ? "Votre email suffit à le retrouver : un code à 6 chiffres, pas de mot de passe, et vous ne resaisissez rien."
                  : "Recevez un code à 6 chiffres par email, sans mot de passe."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={sendCode} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    autoFocus
                    inputMode="email"
                    autoComplete="email"
                    placeholder="votre@email.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-md border bg-background pl-10 pr-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {status === "error" && (
                  <p className="text-sm text-destructive">{message}</p>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    "Recevoir mon code"
                  )}
                </Button>
              </form>
              <AuthDivider />
              <GoogleSignInButton />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Entrez votre code</CardTitle>
              <CardDescription>
                Un code à 6 chiffres a été envoyé à{" "}
                <span className="font-medium text-foreground">{email}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                aria-label="Code à 6 chiffres"
                className="h-16 w-full rounded-md border bg-background text-center font-heading text-3xl font-semibold tracking-[0.4em] outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {status === "loading" && (
                <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Vérification…
                </p>
              )}
              {status === "error" && (
                <p className="text-center text-sm text-destructive">
                  {message}
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => {
                  setPhase("email");
                  setCode("");
                  setStatus("idle");
                }}
              >
                <ArrowLeft className="size-4" />
                Changer d'adresse
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
