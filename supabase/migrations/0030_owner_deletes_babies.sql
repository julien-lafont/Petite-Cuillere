-- ============================================================================
-- Petite Cuillère — Only the household owner deletes a child
-- ============================================================================
-- `babies in household` (0001) is a single `for all`: every member of the
-- household could delete a child, and the row takes with it — by cascade — the
-- meals, the food introductions and the allergen introductions. That is the one
-- destruction the product cannot undo, and it sat behind a single tap for an
-- invited helper who is only there to feed the child.
--
-- Same split as `invitations` (0007): reading and editing stay open to everyone
-- who looks after the child, deleting belongs to the owner alone.
--
-- Consequence for the caller: a DELETE the policy refuses is not an error, it
-- simply matches no row. `deleteBaby` counts the deleted rows to tell a refusal
-- from a success — without that count, a helper's click would look like it
-- worked.
--
-- Run in Supabase: SQL Editor → paste → Run. Re-runnable.
-- ============================================================================

drop policy if exists "babies in household" on public.babies;

drop policy if exists "read babies in household" on public.babies;
create policy "read babies in household" on public.babies
  for select using (household_id = public.current_household_id());

drop policy if exists "insert babies in household" on public.babies;
create policy "insert babies in household" on public.babies
  for insert with check (household_id = public.current_household_id());

drop policy if exists "update babies in household" on public.babies;
create policy "update babies in household" on public.babies
  for update using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "owner deletes babies" on public.babies;
create policy "owner deletes babies" on public.babies
  for delete using (
    household_id = public.current_household_id() and public.is_household_owner()
  );
