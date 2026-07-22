"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addMealMoment,
  renameMealMoment,
  removeMealMoment,
  reorderMealMoment,
} from "@/lib/data/meal-moments.actions";
import type { MealMoment } from "@/lib/data/meal-moments";

function MomentRow({
  moment,
  isFirst,
  isLast,
  isPending,
  run,
}: {
  moment: MealMoment;
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const [label, setLabel] = useState(moment.label);

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-2">
      <div className="flex flex-col">
        <button
          disabled={isPending || isFirst}
          onClick={() => run(() => reorderMealMoment(moment.id, "up"))}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Monter"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          disabled={isPending || isLast}
          onClick={() => run(() => reorderMealMoment(moment.id, "down"))}
          className="text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Descendre"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          if (label.trim() && label !== moment.label) {
            run(() => renameMealMoment(moment.id, label));
          } else {
            setLabel(moment.label);
          }
        }}
        className="h-9 flex-1"
      />
      <button
        disabled={isPending}
        onClick={() => run(() => removeMealMoment(moment.id))}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Supprimer"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

export function MealMomentsManager({ moments }: { moments: MealMoment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {moments.map((m, i) => (
        <MomentRow
          key={m.id}
          moment={m}
          isFirst={i === 0}
          isLast={i === moments.length - 1}
          isPending={isPending}
          run={run}
        />
      ))}
      <div className="flex gap-2 pt-1">
        <Input
          placeholder="Nouveau moment (ex. Collation)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="h-9"
        />
        <Button
          variant="secondary"
          disabled={isPending || !newLabel.trim()}
          onClick={() =>
            run(async () => {
              await addMealMoment(newLabel);
              setNewLabel("");
            })
          }
        >
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>
    </div>
  );
}
