/**
 * How well a food went down (0-100), computed from past meals containing it.
 * `null` = not rated yet.
 */
export type ToleranceInfo = {
  label: string;
  emoji: string;
  cls: string;
};

export function toleranceInfo(score: number | null): ToleranceInfo | null {
  if (score === null) return null;
  if (score >= 75)
    return {
      label: "Bien apprécié",
      emoji: "😋",
      cls: "bg-primary/12 text-primary border-primary/20",
    };
  if (score >= 40)
    return {
      label: "Mitigé",
      emoji: "😐",
      cls: "bg-chart-3/20 text-amber-700 border-chart-3/30",
    };
  return {
    label: "Peu apprécié",
    emoji: "😕",
    cls: "bg-destructive/10 text-destructive border-destructive/20",
  };
}
