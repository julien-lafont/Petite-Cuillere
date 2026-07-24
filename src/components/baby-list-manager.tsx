"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setActiveBaby, deleteBaby } from "@/lib/data/baby.actions";
import { AddBabyDialog } from "@/components/add-baby-dialog";
import { BabyAvatar } from "@/components/baby-avatar";

type BabyOption = { id: string; prenom: string; avatar_color: string | null };

export function BabyListManager({
  babies,
  activeBabyId,
}: {
  babies: BabyOption[];
  activeBabyId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  function handleSwitch(id: string) {
    if (id === activeBabyId) return;
    setPendingId(id);
    startTransition(async () => {
      await setActiveBaby(id);
      router.refresh();
      setPendingId(null);
    });
  }

  function handleDelete(b: BabyOption) {
    const warning =
      babies.length === 1
        ? `Supprimer ${b.prenom} ? Tous ses repas et son suivi seront définitivement perdus, et tu retourneras à l'écran de création de profil.`
        : `Supprimer ${b.prenom} ? Tous ses repas et son suivi seront définitivement perdus.`;
    if (!window.confirm(warning)) return;
    setPendingId(b.id);
    startTransition(async () => {
      await deleteBaby(b.id);
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
            <button
              disabled={isPending}
              onClick={() => handleDelete(b)}
              className="text-muted-foreground hover:text-destructive disabled:opacity-40"
              aria-label={`Supprimer ${b.prenom}`}
            >
              {isPending && pendingId === b.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
            </button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 gap-2"
        onClick={() => setAddOpen(true)}
      >
        <Plus className="size-4" />
        Ajouter un enfant
      </Button>
      <AddBabyDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
