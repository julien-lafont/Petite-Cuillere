"use client";

import { useState } from "react";
import { Baby } from "lucide-react";
import { createBaby } from "@/lib/data/baby.actions";
import { getAgeInfo } from "@/lib/age";
import { FEATURE_PREMATURE_BABY_ENABLED } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Première connexion : aucun bébé en base → on invite à créer le profil. */
export function Onboarding() {
  const [prenom, setPrenom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [premature, setPremature] = useState(false);
  const [dateTerme, setDateTerme] = useState("");

  function togglePremature(v: boolean) {
    setPremature(v);
    if (v && !dateTerme && dateNaissance) setDateTerme(dateNaissance);
  }

  // Résumé en direct
  const age = dateNaissance
    ? getAgeInfo(
        new Date(dateNaissance),
        premature && dateTerme ? new Date(dateTerme) : null,
      )
    : null;
  const name = prenom.trim() || "Bébé";

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Baby className="size-7" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-extrabold tracking-tight">
            Bienvenue&nbsp;!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pour commencer, créons le profil de bébé.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profil de bébé</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createBaby} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  name="prenom"
                  required
                  placeholder="Ex. Léa"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="date_naissance">Date de naissance</Label>
                <Input
                  id="date_naissance"
                  name="date_naissance"
                  type="date"
                  required
                  value={dateNaissance}
                  onChange={(e) => setDateNaissance(e.target.value)}
                />
              </div>

              {FEATURE_PREMATURE_BABY_ENABLED && (
                <>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label htmlFor="premature" className="cursor-pointer">
                      Né·e prématurément ?
                    </Label>
                    <Switch
                      id="premature"
                      checked={premature}
                      onCheckedChange={togglePremature}
                    />
                  </div>

                  {premature && (
                    <div className="space-y-1.5">
                      <Label htmlFor="date_terme">Date de terme théorique</Label>
                      <Input
                        id="date_terme"
                        name="date_terme"
                        type="date"
                        required
                        value={dateTerme}
                        onChange={(e) => setDateTerme(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Sert à calculer l&apos;âge corrigé.
                      </p>
                    </div>
                  )}
                </>
              )}

              <Button type="submit" className="w-full">
                Créer le profil
              </Button>

              {age && (
                <div className="rounded-lg bg-primary/[0.06] p-3 text-center text-sm">
                  <p>
                    <span className="font-heading font-bold">{name}</span>,{" "}
                    {age.chronological}
                    {premature && age.corrected && (
                      <> (âge corrigé : {age.corrected})</>
                    )}
                    .
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Hâte d&apos;accompagner ses premières découvertes
                    gustatives&nbsp;! 🥄💛
                  </p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
