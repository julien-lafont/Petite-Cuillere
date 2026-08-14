"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown, Plus } from "lucide-react";
import { setActiveBaby } from "@/lib/data/baby.actions";
import { BabyAvatar } from "@/components/baby-avatar";

type BabyOption = { id: string; prenom: string; avatar_color: string | null };

/**
 * The nav's baby badge: a menu listing every child (switching to the /bebe
 * card), always followed by "Ajouter un enfant" — even when there is only one.
 */
export function BabySwitcher({
  babies,
  activeId,
}: {
  babies: BabyOption[];
  activeId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = babies.find((b) => b.id === activeId) ?? babies[0];

  function handleSelect(id: string) {
    if (id === activeId) {
      router.push("/bebe");
      return;
    }
    startTransition(async () => {
      await setActiveBaby(id);
      router.push("/bebe");
      router.refresh();
    });
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={isPending}
        className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent/40 disabled:opacity-60"
      >
        <BabyAvatar
          prenom={active.prenom}
          color={active.avatar_color}
          className="size-6 text-xs"
        />
        <span className="font-medium">{active.prenom}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="start"
          sideOffset={6}
          className="isolate z-50"
        >
          <Menu.Popup className="min-w-48 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none">
            {babies.map((b) => (
              <Menu.Item
                key={b.id}
                onClick={() => handleSelect(b.id)}
                className="relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-7 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground"
              >
                <BabyAvatar
                  prenom={b.prenom}
                  color={b.avatar_color}
                  className="size-5 text-[10px]"
                />
                <span className="truncate">{b.prenom}</span>
                {b.id === activeId && (
                  <Check className="absolute right-2 size-4 text-primary" />
                )}
              </Menu.Item>
            ))}
            <div className="my-1 h-px bg-border" />
            {/*
             * Adding a child means redoing the whole onboarding (profile plus
             * programme): a dedicated page, not a creation dialogue.
             */}
            <Menu.LinkItem
              render={<Link href="/nouvel-enfant" />}
              closeOnClick
              className="flex cursor-default items-center gap-2 rounded-md py-1.5 pl-1.5 text-sm text-primary outline-hidden select-none focus:bg-accent"
            >
              <Plus className="size-4" />
              Ajouter un enfant
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
