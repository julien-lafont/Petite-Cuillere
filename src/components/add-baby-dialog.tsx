"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addBaby } from "@/lib/data/baby.actions";
import { FEATURE_PREMATURE_BABY_ENABLED } from "@/lib/features";
import { BabyColorPicker } from "@/components/baby-color-picker";
import { DatePicker } from "@/components/date-picker";
import { toISODate } from "@/lib/dates";
import { PronounPicker } from "@/components/pronoun-picker";
import { DEFAULT_AVATAR_COLOR, type AvatarColor } from "@/lib/avatar-colors";
import type { Pronoun } from "@/lib/pronoun";

/**
 * Dialogue d'ajout d'un enfant supplémentaire au foyer. Contrôlé de l'extérieur
 * (pas de trigger intégré) : ouvert depuis le sélecteur d'enfant ou la page /bebe.
 */
export function AddBabyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [prenom, setPrenom] = useState("");
  const [avatarColor, setAvatarColor] = useState<AvatarColor>(
    DEFAULT_AVATAR_COLOR,
  );
  const [pronoun, setPronoun] = useState<Pronoun | null>(null);
  const [dateNaissance, setDateNaissance] = useState("");
  const [dateTerme, setDateTerme] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPrenom("");
    setAvatarColor(DEFAULT_AVATAR_COLOR);
    setPronoun(null);
    setDateNaissance("");
    setDateTerme("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addBaby(
        prenom,
        dateNaissance,
        dateTerme,
        avatarColor,
        pronoun,
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      onOpenChange(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Ajouter un enfant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new_baby_prenom">Prénom</Label>
            <Input
              id="new_baby_prenom"
              required
              autoFocus
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Couleur de la pastille</Label>
            <BabyColorPicker
              value={avatarColor}
              onChange={setAvatarColor}
              prenom={prenom || "?"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pronom</Label>
            <PronounPicker value={pronoun} onChange={setPronoun} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new_baby_date_naissance">Date de naissance</Label>
            <DatePicker
              id="new_baby_date_naissance"
              value={dateNaissance}
              max={toISODate(new Date())}
              onChange={setDateNaissance}
            />
          </div>
          {FEATURE_PREMATURE_BABY_ENABLED && (
            <div className="space-y-1.5">
              <Label htmlFor="new_baby_date_terme">
                Date de terme théorique{" "}
                <span className="font-normal text-muted-foreground">
                  (optionnel)
                </span>
              </Label>
              <DatePicker
                id="new_baby_date_terme"
                value={dateTerme}
                placeholder="Non renseignée"
                onChange={setDateTerme}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isPending || !prenom.trim() || !dateNaissance || !pronoun}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Ajouter
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
