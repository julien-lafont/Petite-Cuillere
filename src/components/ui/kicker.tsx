import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A small caps label: a section eyebrow, a card's column heading. Same
 * typography everywhere on purpose — `tone` and `weight` are the only axes
 * that are meant to vary, not the size or the interletting.
 */
const kickerVariants = cva("text-xs uppercase tracking-kicker", {
  variants: {
    tone: {
      muted: "text-muted-foreground",
      primary: "text-primary",
      "secondary-strong": "text-secondary-foreground/75",
      "secondary-soft": "text-secondary-foreground/60",
    },
    weight: {
      bold: "font-bold",
      semibold: "font-semibold",
    },
  },
  defaultVariants: {
    tone: "muted",
    weight: "bold",
  },
});

function Kicker({
  className,
  tone,
  weight,
  render,
  ...props
}: useRender.ComponentProps<"p"> & VariantProps<typeof kickerVariants>) {
  return useRender({
    defaultTagName: "p",
    props: mergeProps<"p">(
      {
        className: cn(kickerVariants({ tone, weight }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "kicker",
      tone,
      weight,
    },
  });
}

export { Kicker, kickerVariants };
