"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/categories";
import { monthsToSeason } from "@/lib/season";
import { createFood } from "@/lib/data/foods.actions";
import type { AllergenRow } from "@/lib/data/allergens";

const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const EMPTY = {
  name: "",
  category: "",
  ageMin: "",
  isAllergen: false,
  allergenType: "",
  texture: "",
  preparation: "",
  restrictions: "",
  quantite: "",
  months: [] as number[],
};

export function FoodFormDialog({ allergens }: { allergens: AllergenRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  function reset() {
    setForm(EMPTY);
    setError(null);
  }

  function toggleMonth(m: number) {
    setForm((f) => ({
      ...f,
      months: f.months.includes(m)
        ? f.months.filter((x) => x !== m)
        : [...f.months, m].sort((a, b) => a - b),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createFood({
        name: form.name,
        category: form.category || null,
        ageIntroductionMin: form.ageMin === "" ? null : Number(form.ageMin),
        isAllergen: form.isAllergen,
        allergenType: form.allergenType || null,
        texture: form.texture.trim() || null,
        preparation: form.preparation.trim() || null,
        restrictions: form.restrictions.trim() || null,
        quantiteIndicative: form.quantite.trim() || null,
        season: monthsToSeason(form.months),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Plus className="size-4" />
            Ajouter un aliment
          </Button>
        }
      />
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Nouvel aliment
          </DialogTitle>
          <DialogDescription>
            Ajouté au catalogue de ton foyer (le catalogue commun n&apos;est
            pas modifié).
          </DialogDescription>
        </DialogHeader>

        <form
          id="food-form"
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto pr-1"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom *</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v ?? "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {categoryMeta(cat).emoji} {categoryMeta(cat).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ageMin">Âge d&apos;introduction (mois)</Label>
              <Input
                id="ageMin"
                type="number"
                min={0}
                max={36}
                value={form.ageMin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ageMin: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="isAllergen">Allergène</Label>
              <p className="text-xs text-muted-foreground">
                Nécessite un suivi d&apos;introduction dédié.
              </p>
            </div>
            <Switch
              id="isAllergen"
              checked={form.isAllergen}
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, isAllergen: v }))
              }
            />
          </div>

          {form.isAllergen && (
            <div className="space-y-1.5">
              <Label>Type d&apos;allergène</Label>
              <Select
                value={form.allergenType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, allergenType: v ?? "" }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {allergens.map((a) => (
                    <SelectItem key={a.id} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="texture">Texture</Label>
            <Input
              id="texture"
              placeholder="ex. purée lisse, écrasé, morceaux…"
              value={form.texture}
              onChange={(e) =>
                setForm((f) => ({ ...f, texture: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preparation">Préparation</Label>
            <Textarea
              id="preparation"
              placeholder="Conseil de préparation…"
              value={form.preparation}
              onChange={(e) =>
                setForm((f) => ({ ...f, preparation: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="restrictions">Restrictions</Label>
              <Input
                id="restrictions"
                placeholder="ex. à éviter avant 12 mois"
                value={form.restrictions}
                onChange={(e) =>
                  setForm((f) => ({ ...f, restrictions: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantite">Quantité indicative</Label>
              <Input
                id="quantite"
                placeholder="ex. 10 g/jour"
                value={form.quantite}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantite: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Saison (optionnel)</Label>
            <div className="grid grid-cols-6 gap-1.5">
              {MONTH_LABELS.map((label, i) => {
                const m = i + 1;
                const active = form.months.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMonth(m)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent/40",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/8 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        <div className="-mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button type="submit" form="food-form" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Créer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
