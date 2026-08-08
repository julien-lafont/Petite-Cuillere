import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase **sans session**, pour les pages prérendues.
 *
 * Le client de `supabase/server.ts` lit les cookies : toute page qui l'appelle
 * devient dynamique, et Next renonce alors à la prérendre. Celui-ci n'a accès à
 * aucun cookie, donc il s'exécute pendant la génération statique.
 *
 * Ce qu'il voit se limite à ce que la RLS ouvre au rôle `anon` : le catalogue
 * commun (`household_id is null`), et rien des foyers — cf. la migration
 * `0010_public_catalog_read.sql`, qui accorde ce SELECT noir sur blanc. Ne pas
 * l'utiliser pour autre chose que du catalogue.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
