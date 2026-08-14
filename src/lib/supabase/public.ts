import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client **without a session**, for prerendered pages.
 *
 * The client in `supabase/server.ts` reads cookies: any page calling it turns
 * dynamic, and Next then gives up prerendering it. This one has access to no
 * cookie, so it runs during static generation.
 *
 * What it sees is limited to what RLS opens to the `anon` role: the common
 * catalogue (`household_id is null`), and nothing of any household — see
 * migration `0010_public_catalog_read.sql`, which grants that SELECT explicitly.
 * Do not use it for anything but the catalogue.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
