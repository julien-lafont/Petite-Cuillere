import { Skeleton } from "@/components/ui/skeleton";

/**
 * La page est atteinte par un `<Link>` — depuis la liste des enfants et depuis
 * le sélecteur — et elle lit le catalogue du foyer, donc elle est rendue à la
 * demande. Sans ce fichier, Next renoncerait à la précharger et le tap sur
 * « Ajouter un enfant » resterait sans effet visible jusqu'à la réponse
 * complète.
 *
 * Le squelette reprend la charpente de l'onboarding en mode « ajout » : marque
 * et sortie de secours sur une ligne, jauge d'étapes, puis la carte du
 * questionnaire. Pas de coquille de navigation — cette page vit hors du groupe
 * `(app)`, en plein écran.
 */
export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>

        {/* La jauge à sa première étape : le questionnaire ouvre sur le prénom. */}
        <div className="flex justify-center gap-1.5">
          <Skeleton className="h-1.5 w-6 rounded-full" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-1.5 w-1.5 rounded-full" />
          ))}
        </div>

        <div className="mt-6 space-y-4 rounded-lg border bg-card p-6 shadow-soft">
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </main>
  );
}
