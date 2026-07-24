import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";

export const metadata: Metadata = { title: "Ajouter un enfant" };

/**
 * Ajout d'un enfant supplémentaire : exactement le parcours d'onboarding du
 * premier enfant. Un profil créé sans programme de diversification n'aurait
 * aucun intérêt — on pose donc les mêmes questions (naissance, point de départ,
 * rattrapage) et on génère le programme dans la foulée.
 *
 * La page vit hors du groupe `(app)` : plein écran, sans navigation, comme
 * l'onboarding initial. L'accès reste protégé par le proxy (chemin non public).
 */
export default async function NouvelEnfantPage() {
  const [foods, allergens] = await Promise.all([getFoods(), getAllergens()]);

  return <Onboarding foods={foods} allergens={allergens} mode="add" />;
}
