"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, CheckCircle2, Home } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/data/helpers.actions";

/**
 * Deux états selon que la personne est déjà connectée ou non :
 *  - non connectée : saisit son email → reçoit un lien magique qui la ramène ici.
 *  - connectée : confirme et rejoint le foyer.
 */
export function JoinForm({
  token,
  loggedIn,
  householdName,
}: {
  token: string;
  loggedIn: boolean;
  householdName: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "sent" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const supabase = createClient();
    const next = `/rejoindre/${token}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  async function handleJoin() {
    setStatus("loading");
    const res = await acceptInvitation(token);
    if (res.error) {
      setStatus("error");
      setMessage(res.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <CheckCircle2 className="size-10 text-primary" />
        <p className="mt-4 font-heading font-bold">Vérifie tes emails</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Un lien de connexion a été envoyé à
          <br />
          <span className="font-medium text-foreground">{email}</span>.
          <br />
          En cliquant dessus, tu reviendras ici pour rejoindre le foyer.
        </p>
      </div>
    );
  }

  if (loggedIn) {
    return (
      <div className="space-y-4">
        <Button
          className="w-full"
          disabled={status === "loading"}
          onClick={handleJoin}
        >
          {status === "loading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Home className="size-4" />
          )}
          Rejoindre {householdName}
        </Button>
        {status === "error" && (
          <p className="text-sm text-destructive">{message}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleEmail} className="space-y-4">
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
          "Recevoir le lien de connexion"
        )}
      </Button>
    </form>
  );
}
