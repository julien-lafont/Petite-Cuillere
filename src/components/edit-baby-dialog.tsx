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
}: {
  babyId: string;
  prenom: string;
  dateNaissance: string;
  dateTerme: string | null;
  avatarColor: string | null;
  sexe: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    prenom,
    dateNaissance,
    dateTerme: dateTerme ?? "",
    avatarColor: resolveAvatarColor(avatarColor) as AvatarColor,
    // Profils créés avant la fonctionnalité (sexe NULL) → masculin présélectionné.
    sexe: resolveSexe(sexe),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateBaby(
        babyId,
        form.prenom,
        form.dateNaissance,
        form.dateTerme,
        form.avatarColor,
        form.sexe,
      );
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
