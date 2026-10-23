create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  rating int not null check (rating between 1 and 5),
  category text not null default 'general'
    check (category in ('general', 'timetable', 'bug', 'feature')),
  message text not null
    check (char_length(btrim(message)) between 3 and 1200),
  section_key text,
  department_code text,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

create index if not exists feedback_status_idx
  on public.feedback (status);

alter table public.feedback enable row level security;

drop policy if exists "public submit feedback" on public.feedback;
create policy "public submit feedback" on public.feedback
  for insert to anon, authenticated
  with check (
    rating between 1 and 5
    and category in ('general', 'timetable', 'bug', 'feature')
    and char_length(btrim(message)) between 3 and 1200
    and status = 'new'
  );

drop policy if exists "admin read feedback" on public.feedback;
create policy "admin read feedback" on public.feedback
  for select to authenticated using (true);

drop policy if exists "admin update feedback" on public.feedback;
create policy "admin update feedback" on public.feedback
  for update to authenticated using (true) with check (true);

drop policy if exists "admin delete feedback" on public.feedback;
create policy "admin delete feedback" on public.feedback
  for delete to authenticated using (true);

grant usage on schema public to anon, authenticated;
grant insert on public.feedback to anon, authenticated;
grant select, update, delete on public.feedback to authenticated;

notify pgrst, 'reload schema';
