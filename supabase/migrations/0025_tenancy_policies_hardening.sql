-- ============================================================================
-- Petite Cuillère — Lock the columns that grant rights
-- ============================================================================
-- Two policies from 0001 say which ROWS a member sees and nothing about the
-- VALUES they may write into them — while the household granting those rights
-- is one of those values.
--
--   · `households` was open `for all`: an invited helper could set
--     `owner_id = auth.uid()`, which makes `is_household_owner()` true and
--     unlocks `remove_helper()` — SECURITY DEFINER, deletes from `auth.users`.
--     The same `for all` covered DELETE, cascading to profiles/babies/meals.
--   · `profiles` has no `with check`, so Postgres reuses the `using` clause,
--     which says nothing about `household_id`. That write is refused today, but
--     only because the SELECT policy is applied to the NEW row — a protection
--     that would vanish the day the read rule is relaxed.
--
-- Same fix for both, and it is the one 0007 already applies to
-- `invitations.token`: RLS says which rows, column privileges say which columns.
--
-- The app is unaffected — it only writes `profiles.prenom` and
-- `households.timezone`. SECURITY DEFINER functions are owned by `postgres`, so
-- neither layer applies to them: closing the API does not close joining a
-- household.
--
-- Run in Supabase: SQL Editor → paste → Run. Re-runnable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Households
-- ----------------------------------------------------------------------------
-- No INSERT policy: a household is born in `handle_new_user()`, nowhere else.
-- No DELETE policy: the only legitimate one is the empty household left behind
-- when joining another, and it happens inside `accept_invitation()`.

drop policy if exists "own household" on public.households;

drop policy if exists "read own household" on public.households;
create policy "read own household" on public.households
  for select using (id = public.current_household_id());

-- UPDATE stays open to every member, not just the owner: the timezone is saved
-- by whichever device first reports a different one (`saveHouseholdTimeZone`).
-- The column grant below is what bounds what "writing the household" means.
drop policy if exists "update own household" on public.households;
create policy "update own household" on public.households
  for update using (id = public.current_household_id())
  with check (id = public.current_household_id());

-- `owner_id` carried the escalation, so it leaves the writable set. Accepted
-- consequence: no ownership transfer through the API. Nothing did that, and the
-- day the product wants it, it belongs in a function with its own checks.
revoke insert, update, delete on public.households from anon, authenticated;
grant update (name, timezone) on public.households to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Profiles
-- ----------------------------------------------------------------------------
-- `current_household_id()` is `stable`, so it resolves against the pre-update
-- snapshot: the check reads as "this column does not move".

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and household_id = public.current_household_id()
  );

-- `relation` rides along with `prenom`: 0015 documents it as editable, and a
-- column documented that way must not fail silently the day a screen edits it.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (prenom, relation) on public.profiles to authenticated;
