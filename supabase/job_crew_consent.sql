-- Worker consent loop (Sprint 1.3): assigned crew accept/decline a job.
-- Run this in the Supabase SQL editor, then: notify pgrst, 'reload schema';
--
-- Each job_crew row (one per assigned worker, primary included) carries a
-- consent status. A job is "tentative" — awaiting confirmation — until at
-- least one crew member has accepted; that state is derived in the app, so
-- no change to the job_status enum is needed. Re-assigning a job deletes and
-- reinserts job_crew rows, so new assignments naturally start 'pending'.

alter table public.job_crew
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined'));

alter table public.job_crew
  add column if not exists responded_at timestamptz;

-- Workers can accept/decline their own assignment (update their own row only).
drop policy if exists "employees respond to own job_crew" on public.job_crew;
create policy "employees respond to own job_crew"
  on public.job_crew for update
  using (
    team_member_id in (
      select id from public.team_members where user_id = auth.uid()
    )
  )
  with check (
    team_member_id in (
      select id from public.team_members where user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
