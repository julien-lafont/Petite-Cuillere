"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBaby } from "@/lib/data/baby.actions";
import { FEATURE_PREMATURE_BABY_ENABLED } from "@/lib/features";
import { BabyColorPicker } from "@/components/baby-color-picker";
import { DatePicker } from "@/components/date-picker";
import { toISODate } from "@/lib/dates";
import { SexePicker } from "@/components/sexe-picker";
import { resolveAvatarColor, type AvatarColor } from "@/lib/avatar-colors";
import { resolveSexe } from "@/lib/sexe";
import { normalizePrenom, MAX_PRENOM_LENGTH } from "@/lib/prenom";

export function EditBabyDialog({
  babyId,
  prenom,
  dateNaissance,
  dateTerme,
  avatarColor,
  sexe,
  diversificationStartedOn,
}: {
  babyId: string;
  prenom: string;
  dateNaissance: string;
  dateTerme: string | null;
  avatarColor: string | null;
  sexe: string | null;
  diversificationStartedOn: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    prenom,
    dateNaissance,
    dateTerme: dateTerme ?? "",
    avatarColor: resolveAvatarColor(avatarColor) as AvatarColor,
    // Profils créés avant la fonctionnalité (sexe NULL) → masculin présélectionné.
    sexe: resolveSexe(sexe),
    diversificationStartedOn: diversificationStartedOn ?? "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateBaby(
        babyId,
        form.prenom,
        form.dateNaissance,
        form.dateTerme,
        form.avatarColor,
        form.sexe,
        form.diversificationStartedOn,
      );
      // Une date refusée fermait la boîte comme si elle avait été enregistrée.
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2">
            <Pencil className="size-4" />
            Modifier
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Modifier le profil</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="prenom">Prénom</Label>
            <Input
              id="prenom"
              required
              maxLength={MAX_PRENOM_LENGTH}
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              // Le champ montre la forme qui sera enregistrée : la même
              // normalisation est appliquée côté serveur.
              onBlur={() =>
                setForm((f) => ({ ...f, prenom: normalizePrenom(f.prenom) }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Couleur de la pastille</Label>
            <BabyColorPicker
              value={form.avatarColor}
              onChange={(avatarColor) => setForm({ ...form, avatarColor })}
              prenom={form.prenom || "?"}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Sexe</Label>
            <SexePicker
              value={form.sexe}
              onChange={(sexe) => setForm({ ...form, sexe })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_naissance">Date de naissance</Label>
            <DatePicker
              id="date_naissance"
              value={form.dateNaissance}
              max={toISODate(new Date())}
              onChange={(dateNaissance) => setForm({ ...form, dateNaissance })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diversification_started_on">
              Premier repas solide
            </Label>
            <DatePicker
              id="diversification_started_on"
              value={form.diversificationStartedOn}
              min={form.dateNaissance || undefined}
              max={toISODate(new Date())}
              placeholder="Non renseignée"
              onChange={(diversificationStartedOn) =>
                setForm({ ...form, diversificationStartedOn })
              }
            />
            <p className="text-xs text-muted-foreground">
              Cette date décide de la vitesse à laquelle les repas s'ouvrent.
              Les textures et les allergènes, eux, suivent l'âge.
            </p>
          </div>
          {FEATURE_PREMATURE_BABY_ENABLED && (
            <div className="space-y-1.5">
              <Label htmlFor="date_terme">
                Date de terme théorique{" "}
                <span className="font-normal text-muted-foreground">
                  (optionnel)
                </span>
              </Label>
              <DatePicker
                id="date_terme"
                value={form.dateTerme}
                placeholder="Non renseignée"
                onChange={(dateTerme) => setForm({ ...form, dateTerme })}
              />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
