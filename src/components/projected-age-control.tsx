"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import { formatAge } from "@/lib/age";
import { setAgeReferenceDate } from "@/lib/data/baby.actions";

const MS_PER_WEEK = 7 * 86_400_000;

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Curseur d'âge projeté (prématurés) : choisit une date de référence entre la
 * naissance (âge réel, offset 0) et le terme (âge corrigé, offset max).
 */
export function ProjectedAgeControl({
  babyId,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  babyId: string;
  birthDate: string;
  dueDate: string;
  ageReferenceDate: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const birth = useMemo(() => new Date(birthDate), [birthDate]);
  const due = useMemo(() => new Date(dueDate), [dueDate]);
  const maxWeeks = Math.max(
    1,
    Math.round((due.getTime() - birth.getTime()) / MS_PER_WEEK),
  );

  // Offset (en semaines) depuis la naissance. Défaut = terme (âge corrigé).
  const initialOffset = ageReferenceDate
    ? Math.round(
        (new Date(ageReferenceDate).getTime() - birth.getTime()) / MS_PER_WEEK,
      )
    : maxWeeks;
  const [offset, setOffset] = useState(
    Math.min(maxWeeks, Math.max(0, initialOffset)),
  );

  const referenceDate = new Date(birth.getTime() + offset * MS_PER_WEEK);
  const projectedLabel = formatAge(referenceDate);

  function commit(weeks: number) {
    const date = new Date(birth.getTime() + weeks * MS_PER_WEEK);
    startTransition(async () => {
      await setAgeReferenceDate(babyId, toIsoDate(date));
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Âge projeté</p>
        <span className="font-heading text-base font-bold text-primary">
          {projectedLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ajuste l&apos;âge pris en compte partout dans l&apos;app, entre l&apos;âge
        corrigé et l&apos;âge réel.
      </p>

      <div className="mt-4">
        <Slider
          min={0}
          max={maxWeeks}
          step={1}
          value={[offset]}
          onValueChange={(v) => setOffset(Array.isArray(v) ? v[0] : v)}
          onValueCommitted={(v) => commit(Array.isArray(v) ? v[0] : v)}
          disabled={isPending}
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>Âge réel</span>
          <span>Âge corrigé</span>
        </div>
      </div>
    </div>
  );
}
