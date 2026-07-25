"use client";

import { useState } from "react";
import { fr } from "react-day-picker/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fromISODate, toISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Sélection de date de l'app, en français et en un geste. Deux formes :
 * `DateCalendar` (calendrier toujours visible, pour les écrans qui ne posent
 * que cette question) et `DatePicker` (bouton + calendrier en surcouche, pour
 * les formulaires).
 *
 * Les dates circulent partout en 'YYYY-MM-DD' local, comme dans `lib/dates` et
 * en base : la conversion vers les `Date` de react-day-picker est confinée ici.
 */

type DateRangeProps = {
  /** Date sélectionnée, en 'YYYY-MM-DD'. Chaîne vide si aucune. */
  value?: string;
  onChange: (iso: string) => void;
  /** Bornes inclusives, en 'YYYY-MM-DD'. */
  min?: string;
  max?: string;
};

function clampISO(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** Libellé long : « 12 février 2026 ». */
export function formatLongDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DateCalendar({
  value,
  onChange,
  min,
  max,
  className,
  "aria-label": ariaLabel,
}: DateRangeProps & { className?: string; "aria-label"?: string }) {
  const selected = value ? fromISODate(value) : undefined;
  // Les cases sont larges (44 px) : l'app s'utilise debout, d'une seule main.
  return (
    <Calendar
      mode="single"
      locale={fr}
      // Mois et année en listes déroulantes : remonter à une naissance d'il y a
      // onze mois ne doit pas coûter onze clics de flèche.
      captionLayout="dropdown"
      startMonth={min ? fromISODate(min) : undefined}
      endMonth={max ? fromISODate(max) : undefined}
      defaultMonth={
        selected ?? fromISODate(clampISO(toISODate(new Date()), min, max))
      }
      selected={selected}
      // rdp renvoie `undefined` quand on reclique la date déjà choisie : ici
      // une date est toujours attendue, on ignore la désélection.
      onSelect={(d) => d && onChange(toISODate(d))}
      disabled={[
        ...(min ? [{ before: fromISODate(min) }] : []),
        ...(max ? [{ after: fromISODate(max) }] : []),
      ]}
      aria-label={ariaLabel}
      className={cn("[--cell-size:--spacing(11)] p-0", className)}
      classNames={{ root: "w-full", month: "w-full gap-3" }}
    />
  );
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  id,
  placeholder = "Choisir une date",
  className,
}: DateRangeProps & {
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
          !value && "text-muted-foreground",
          className,
        )}
      >
        {value ? formatLongDate(value) : placeholder}
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2.5">
        <DateCalendar
          value={value}
          min={min}
          max={max}
          onChange={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
