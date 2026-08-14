"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfile } from "@/lib/data/profile.actions";

/**
 * One field, so one line: field and button side by side, the label carried by
 * the card hosting it ("Vous", in Mon foyer). This form no longer has a screen
 * of its own, and must not take up the space of one.
 *
 * No `autoFocus` either, for the same reason: it would scroll the page down to
 * this card on load.
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
          /* A first name does not deserve 900 px: the field stops early on desktop. */
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
      {/* Feedback only appears after an action: nothing reserves space for it. */}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {saved && !error && (
        <p className="mt-2 text-sm text-primary">Prénom mis à jour.</p>
      )}
    </form>
  );
}
