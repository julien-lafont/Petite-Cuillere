"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarRange } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/date-picker";
import { generateProgram } from "@/lib/data/program.actions";

const DAYS_PER_MONTH = 30.4375;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type Scope = "week" | "months";

export function AutoProgramDialog({
  babyId,
  weekStartISO,
  trigger,
}: {
  babyId: string;
  weekStartISO: string;
  /** Élément déclencheur personnalisé (défaut : bouton "Générer plan…"). */
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("months");
  const [startDate, setStartDate] = useState(todayISO());
  const [months, setMonths] = useState(6);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const start = scope === "week" ? weekStartISO : startDate;
    const days = scope === "week" ? 7 : Math.round(months * DAYS_PER_MONTH);
    startTransition(async () => {
      await generateProgram(babyId, start, days);
      router.refresh();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button className="gap-2">
              <CalendarRange className="size-4" />
              Générer le programme
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <CalendarRange className="size-4 text-primary" />
            Programme de diversification
          </DialogTitle>
          <DialogDescription>
            Des repas adaptés à l'âge, avec introduction progressive des
            aliments et allergènes, d'après les recommandations des autorités de
            santé.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Portée */}
          <div className="space-y-1.5">
            <Label>Portée</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { v: "week", label: "Cette semaine" },
                  { v: "months", label: "Plusieurs mois" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setScope(opt.v)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    scope === opt.v
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {scope === "months" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="start">Jour de démarrage</Label>
                <DatePicker
                  id="start"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="months">Durée (mois)</Label>
                <Input
                  id="months"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                />
              </div>
            </>
          )}

          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            ⚠️ Cela <strong>remplace</strong> les repas de la{" "}
            {scope === "week" ? "semaine affichée" : "période"}.
          </p>

          <div className="flex justify-end gap-2">
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
              Générer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
