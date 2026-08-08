"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfile } from "@/lib/data/profile.actions";

/**
 * Un seul champ, donc une seule ligne : champ et bouton côte à côte, libellé
 * porté par la carte qui l'accueille (« Vous », dans Mon foyer). Ce formulaire
 * n'a plus d'écran à lui, il ne doit pas en occuper la place.
 *
 * Pas d'`autoFocus` non plus, pour la même raison : il ferait défiler la page
 * jusqu'à cette carte au chargement.
 */
export function ProfileForm({ prenom }: { prenom: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(prenom ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateMyProfile(value);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center gap-2">
        <Label htmlFor="my_prenom" className="sr-only">
          Votre prénom
        </Label>
        <Input
          id="my_prenom"
          required
          value={value}
          placeholder="Votre prénom"
          /* Un prénom ne mérite pas 900 px : le champ s'arrête vite en desktop. */
          className="h-11 min-w-0 flex-1 sm:max-w-xs"
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
        />
        <Button type="submit" disabled={isPending || !value.trim()}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
      {/* Le retour ne s'affiche qu'après une action : rien ne réserve de place. */}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {saved && !error && (
        <p className="mt-2 text-sm text-primary">Prénom mis à jour.</p>
      )}
    </form>
  );
}
