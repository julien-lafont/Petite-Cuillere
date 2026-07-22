"use client";

import { useState } from "react";
import { Baby, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Baby className="size-7" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-extrabold tracking-tight">
            Baby Food Tracker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            L&apos;alimentation de bébé, en toute sérénité.
          </p>
        </div>

        {status === "sent" ? (
          <Card>
            <CardContent className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="size-10 text-primary" />
              <p className="mt-4 font-heading font-bold">Vérifie tes emails</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Un lien de connexion a été envoyé à
                <br />
                <span className="font-medium text-foreground">{email}</span>.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => setStatus("idle")}
              >
                Utiliser une autre adresse
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Connexion</CardTitle>
              <CardDescription>
                Reçois un lien magique par email, sans mot de passe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="ton@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-lg border bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                {status === "error" && (
                  <p className="text-sm text-destructive">{message}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={status === "loading"}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Envoi…
                    </>
                  ) : (
                    "Recevoir le lien magique"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Outil d&apos;organisation — ne remplace pas un avis médical.
        </p>
      </div>
    </main>
  );
}
