"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Loader2,
  Link as LinkIcon,
  Check,
  Copy,
  Trash2,
  X,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  createInvitation,
  deleteInvitation,
  getInvitationToken,
  removeHelper,
} from "@/lib/data/helpers.actions";
import type { HouseholdMember, PendingInvitation } from "@/lib/data/helpers";

/** Construit l'URL du lien magique à transmettre. */
function inviteUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/rejoindre/${token}`;
}

function initials(member: { prenom: string | null; email: string | null }) {
  const src = member.prenom || member.email || "?";
  return src.charAt(0).toUpperCase();
}

/** Bouton qui récupère le lien d'une invitation et le copie dans le presse-papier. */
function CopyLinkButton({ invitationId }: { invitationId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">(
    "idle",
  );

  async function handleCopy() {
    setState("loading");
    const token = await getInvitationToken(invitationId);
    if (!token) {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setState("copied");
    } catch {
      // Repli : on préremplit une invite si le presse-papier est indisponible.
      window.prompt("Copie ce lien d'invitation :", inviteUrl(token));
      setState("idle");
      return;
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      disabled={state === "loading"}
      onClick={handleCopy}
    >
      {state === "loading" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "copied" ? (
        <Check className="size-4 text-primary" />
      ) : (
        <LinkIcon className="size-4" />
      )}
      {state === "copied" ? "Copié !" : "Copier le lien"}
    </Button>
  );
}

/** Copie du lien affiché dans la boîte de dialogue après création. */
function CopyGeneratedLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(token);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie ce lien d'invitation :", url);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
      <p className="text-sm font-medium">Lien à transmettre</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 font-mono text-xs text-muted-foreground outline-none"
        />
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0 gap-1.5"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Envoie ce lien à la personne : elle pourra créer son compte et rejoindre
        le foyer.
      </p>
    </div>
  );
}

function InviteDialog({ babyName }: { babyName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [prenom, setPrenom] = useState("");
  const [relation, setRelation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  function reset() {
    setPrenom("");
    setRelation("");
    setError(null);
    setToken(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createInvitation(prenom, relation);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setToken(res.token);
      router.refresh();
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
          <Button variant="ghost" size="sm" className="gap-2">
            <UserPlus className="size-4" />
            Inviter
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Inviter un aidant</DialogTitle>
          <DialogDescription>
            Renseigne son prénom et sa relation à {babyName}. Tu obtiendras un
            lien à lui transmettre.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="space-y-5">
            <CopyGeneratedLink token={token} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>
                Inviter quelqu&apos;un d&apos;autre
              </Button>
              <Button onClick={() => setOpen(false)}>Terminé</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="invite_prenom">Prénom</Label>
              <Input
                id="invite_prenom"
                required
                autoFocus
                placeholder="Ex. Sylvie"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite_relation">
                Relation{" "}
                <span className="font-normal text-muted-foreground">
                  (rôle)
                </span>
              </Label>
              <Input
                id="invite_relation"
                placeholder="Ex. Grand-mère, Nounou, Papa…"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || !prenom.trim()}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Créer le lien
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberRow({
  member,
  canRemove,
}: {
  member: HouseholdMember;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    const name = member.prenom || member.email || "cet aidant";
    if (
      !window.confirm(
        `Retirer définitivement ${name} ? Son compte et son accès au foyer seront supprimés.`,
      )
    )
      return;
    startTransition(async () => {
      await removeHelper(member.id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <span className="grid size-9 place-items-center rounded-full bg-muted text-sm font-bold">
        {initials(member)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.prenom || member.email || "Aidant"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {member.relation || member.email || "—"}
        </p>
      </div>
      {member.isOwner && <Badge variant="secondary">Responsable</Badge>}
      {member.isMe && <Badge variant="outline">Vous</Badge>}
      {canRemove && (
        <button
          disabled={isPending}
          onClick={handleRemove}
          className="text-muted-foreground hover:text-destructive disabled:opacity-40"
          aria-label={`Retirer ${member.prenom || "l'aidant"}`}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </button>
      )}
    </div>
  );
}

function PendingRow({
  invitation,
  isOwner,
}: {
  invitation: PendingInvitation;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Annuler l'invitation de ${invitation.prenom} ?`))
      return;
    startTransition(async () => {
      await deleteInvitation(invitation.id);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <span className="grid size-9 place-items-center rounded-full border border-dashed bg-muted/40 text-sm font-bold text-muted-foreground">
        {invitation.prenom.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{invitation.prenom}</p>
        <p className="truncate text-xs text-muted-foreground">
          {invitation.relation || "—"}
        </p>
      </div>
      <Badge
        variant="outline"
        className="border-amber-500/40 text-amber-700 dark:text-amber-400"
      >
        Invité·e
      </Badge>
      {isOwner && (
        <div className="flex items-center gap-1">
          <CopyLinkButton invitationId={invitation.id} />
          <button
            disabled={isPending}
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive disabled:opacity-40"
            aria-label={`Annuler l'invitation de ${invitation.prenom}`}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function HelpersManager({
  members,
  pending,
  isOwner,
  babyName,
}: {
  members: HouseholdMember[];
  pending: PendingInvitation[];
  isOwner: boolean;
  babyName: string;
}) {
  const total = members.length + pending.length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Toutes les personnes qui s&apos;occupent de {babyName}.
        </p>
        {isOwner && <InviteDialog babyName={babyName} />}
      </div>

      <div className="divide-y">
        {members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            canRemove={isOwner && !m.isOwner && !m.isMe}
          />
        ))}
        {pending.map((inv) => (
          <PendingRow key={inv.id} invitation={inv} isOwner={isOwner} />
        ))}
      </div>

      {total === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Aucun aidant pour le moment.
        </p>
      )}

      {!isOwner && (
        <>
          <Separator className="my-4" />
          <p className="text-center text-xs text-muted-foreground">
            Seul le responsable du foyer peut inviter ou retirer des aidants.
          </p>
        </>
      )}
    </div>
  );
}
