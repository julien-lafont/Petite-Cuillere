"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setActiveBaby, deleteBaby } from "@/lib/data/baby.actions";
import { DELETE_BABY_WORD, isDeleteBabyConfirmed } from "@/lib/baby-deletion";
import { BabyAvatar } from "@/components/baby-avatar";

type BabyOption = { id: string; prenom: string; avatar_color: string | null };

/**
 * Suppression d'un enfant : le mot recopié, pas la boîte native.
 *
 * `window.confirm` se congédie d'un même geste que le bouton qui l'ouvre, et ce
 * qui part ici ne revient pas — tout ce que le foyer a noté de cet enfant. Le
 * mot oblige à lire avant de détruire ; le serveur le revérifie.
 */
function DeleteBabyDialog({
  baby,
  isLast,
}: {
  baby: BabyOption;
  isLast: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await deleteBaby(baby.id, word);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setWord("");
          setError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <button
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Supprimer ${baby.prenom}`}
          >
            <Trash2 className="size-4" />
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Supprimer {baby.prenom} ?
          </DialogTitle>
          <DialogDescription>
            {`Ses repas, son programme, ses aliments goûtés et ses allergènes rencontrés seront effacés définitivement. Personne ne pourra les retrouver.${
              isLast
                ? " C'est le dernier enfant du foyer : l'écran de création de profil réapparaîtra."
                : ""
            }`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>
              {`Pour confirmer, écris « ${DELETE_BABY_WORD} » ci-dessous`}
            </Label>
            <Input
              id={inputId}
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={DELETE_BABY_WORD}
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending || !isDeleteBabyConfirmed(word)}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Supprimer définitivement
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BabyListManager({
  babies,
  activeBabyId,
  isOwner,
}: {
  babies: BabyOption[];
  activeBabyId: string;
  /** Seul le responsable du foyer supprime un enfant (migration 0030). */
  isOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleSwitch(id: string) {
    if (id === activeBabyId) return;
    setPendingId(id);
    startTransition(async () => {
      await setActiveBaby(id);
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div>
      <div className="divide-y">
        {babies.map((b) => (
          <div key={b.id} className="flex items-center gap-3 py-3">
            <BabyAvatar
              prenom={b.prenom}
              color={b.avatar_color}
              className="size-9 text-sm"
            />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {b.prenom}
            </p>
            {b.id === activeBabyId ? (
              <Badge variant="secondary">Actif</Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleSwitch(b.id)}
              >
                {isPending && pendingId === b.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Basculer"
                )}
              </Button>
            )}
            {isOwner && (
              <DeleteBabyDialog baby={b} isLast={babies.length === 1} />
            )}
          </div>
        ))}
      </div>
      {/* Onboarding complet (profil + programme), sur sa page dédiée. */}
      <Button
        variant="outline"
        size="sm"
        className="mt-3 gap-2"
        render={<Link href="/nouvel-enfant" />}
      >
        <Plus className="size-4" />
        Ajouter un enfant
      </Button>

      {!isOwner && (
        <>
          <Separator className="my-4" />
          <p className="text-center text-xs text-muted-foreground">
            Seul le responsable du foyer peut supprimer un enfant.
          </p>
        </>
      )}
    </div>
  );
}
