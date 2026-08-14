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
 * The app's date picker, in French and in one gesture. Two forms:
 * `DateCalendar` (a permanently visible calendar, for screens that ask nothing
 * else) and `DatePicker` (button plus overlaid calendar, for forms).
 *
 * Dates travel everywhere as local 'YYYY-MM-DD', as in `lib/dates` and in the
 * database: converting to react-day-picker's `Date` objects is confined here.
 */

type DateRangeProps = {
  /** Selected date, as 'YYYY-MM-DD'. Empty string when there is none. */
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

/** Long label: "12 février 2026". */
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
  // The cells are wide (44 px): the app is used standing, one-handed.
  return (
    <Calendar
      mode="single"
      locale={fr}
      // Month and year as dropdowns: going back to a birth eleven months ago
      // must not cost eleven arrow clicks.
      captionLayout="dropdown"
      startMonth={min ? fromISODate(min) : undefined}
      endMonth={max ? fromISODate(max) : undefined}
      defaultMonth={
        selected ?? fromISODate(clampISO(toISODate(new Date()), min, max))
      }
      selected={selected}
      // rdp returns `undefined` when the already-chosen date is clicked again:
      // here a date is always expected, so we ignore the deselection.
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
