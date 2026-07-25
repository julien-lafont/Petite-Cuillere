"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SpoonIcon } from "@/components/brand-mark";

/**
 * Connexion par code à 6 chiffres (cf. docs/ux-redesign.md §3.6). Le parent reçoit
 * le code par email et le saisit sans jamais quitter l'app — contrairement au lien
 * magique, qui force à changer d'application. Le lien reste en secours dans le
 * même email pour qui préfère cliquer.
 *
 * Prérequis Supabase : les templates d'email doivent exposer {{ .Token }} (le
 * code) en plus de {{ .ConfirmationURL }} — **« Magic Link » ET « Confirm
 * signup »**, ce dernier étant celui reçu à la première connexion. Sans ça, le
 * parent reçoit un lien magique quoi que fasse ce composant : le contenu de
 * l'email ne dépend que du template. Voir `supabase/email-templates/`.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<"email" | "code">("email");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

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
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft">
            <SpoonIcon className="size-7" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight">
            Petite Cuillère
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Les premiers repas de bébé, en toute confiance.
          </p>
        </div>

        {phase === "email" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connexion</CardTitle>
              <CardDescription>
                Recevez un code à 6 chiffres par email, sans mot de passe.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                Changer d&apos;adresse
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
