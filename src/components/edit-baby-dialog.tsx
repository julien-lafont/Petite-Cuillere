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

export function EditBabyDialog({
  babyId,
  prenom,
  dateNaissance,
  dateTerme,
}: {
  babyId: string;
  prenom: string;
  dateNaissance: string;
  dateTerme: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    prenom,
    dateNaissance,
    dateTerme: dateTerme ?? "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateBaby(
        babyId,
        form.prenom,
        form.dateNaissance,
        form.dateTerme,
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prenom">Prénom</Label>
            <Input
              id="prenom"
              required
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_naissance">Date de naissance</Label>
            <Input
              id="date_naissance"
              type="date"
              required
              value={form.dateNaissance}
              onChange={(e) =>
                setForm({ ...form, dateNaissance: e.target.value })
              }
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
              <Input
                id="date_terme"
                type="date"
                value={form.dateTerme}
                onChange={(e) => setForm({ ...form, dateTerme: e.target.value })}
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
