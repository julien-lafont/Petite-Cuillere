import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";

export const metadata: Metadata = { title: "Ajouter un enfant" };

/**
 * Adding another child: exactly the first child's onboarding flow. A profile
 * created without a diversification programme would be pointless — so we ask the
 * same questions (birth, starting point, catch-up) and generate the programme
 * straight away.
 *
 * The page lives outside the `(app)` group: full screen, no navigation, like the
 * initial onboarding. Access stays protected by the proxy (non-public path).
 */
export default async function NouvelEnfantPage() {
  const [foods, allergens] = await Promise.all([getFoods(), getAllergens()]);

  return <Onboarding foods={foods} allergens={allergens} mode="add" />;
}
