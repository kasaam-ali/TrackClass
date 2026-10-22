create extension if not exists pgcrypto;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  department_id uuid not null references public.departments(id) on delete cascade,
  semester int not null check (semester between 1 and 12),
  section_name text not null,
  batch_label text not null,
  display_name text not null unique,
  is_active boolean not null default true,
  unique (department_id, semester, section_name, batch_label)
);

create table if not exists public.periods (
  department_id uuid not null references public.departments(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 5),
  slot_index int not null check (slot_index in (1, 2)),
  start_time text not null,
  end_time text not null,
  label text not null,
  primary key (department_id, day_of_week, slot_index)
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique
);

create table if not exists public.timetable_meta (
  id uuid primary key default gen_random_uuid(),
  version_number int not null,
  term text not null default 'Fall 2026',
  content_hash text not null,
  note text,
  changes_json jsonb not null default '{}'::jsonb,
  excel_file_url text,
  source_file_name text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index if not exists timetable_meta_one_active_idx
  on public.timetable_meta (is_active)
  where is_active = true;

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.timetable_meta(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 5),
  slot_index int not null check (slot_index in (1, 2)),
  cell_index int not null default 0,
  raw_text text not null,
  subject_code text,
  subject_name text,
  teacher_id uuid references public.teachers(id) on delete set null,
  teacher_name text,
  room_names text[] not null default '{}',
  room_keys text[] not null default '{}',
  category text,
  credits text,
  unique (version_id, section_id, day_of_week, slot_index, cell_index)
);

create index if not exists timetable_entries_version_idx
  on public.timetable_entries (version_id);

create index if not exists timetable_entries_section_idx
  on public.timetable_entries (section_id);

create index if not exists timetable_entries_teacher_idx
  on public.timetable_entries (teacher_id);

create table if not exists public.chat_rate_limits (
  client_ip_hash text primary key,
  window_start timestamptz not null default now(),
  request_count int not null default 0
);

alter table public.departments enable row level security;
alter table public.sections enable row level security;
alter table public.periods enable row level security;
alter table public.teachers enable row level security;
alter table public.rooms enable row level security;
alter table public.timetable_meta enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.chat_rate_limits enable row level security;

drop policy if exists "public read departments" on public.departments;
create policy "public read departments" on public.departments
  for select using (true);
drop policy if exists "admin write departments" on public.departments;
create policy "admin write departments" on public.departments
  for all to authenticated using (true) with check (true);

drop policy if exists "public read sections" on public.sections;
create policy "public read sections" on public.sections
  for select using (true);
drop policy if exists "admin write sections" on public.sections;
create policy "admin write sections" on public.sections
  for all to authenticated using (true) with check (true);

drop policy if exists "public read periods" on public.periods;
create policy "public read periods" on public.periods
  for select using (true);
drop policy if exists "admin write periods" on public.periods;
create policy "admin write periods" on public.periods
  for all to authenticated using (true) with check (true);

drop policy if exists "public read teachers" on public.teachers;
create policy "public read teachers" on public.teachers
  for select using (true);
drop policy if exists "admin write teachers" on public.teachers;
create policy "admin write teachers" on public.teachers
  for all to authenticated using (true) with check (true);

drop policy if exists "public read rooms" on public.rooms;
create policy "public read rooms" on public.rooms
  for select using (true);
drop policy if exists "admin write rooms" on public.rooms;
create policy "admin write rooms" on public.rooms
  for all to authenticated using (true) with check (true);

drop policy if exists "public read timetable_meta" on public.timetable_meta;
create policy "public read timetable_meta" on public.timetable_meta
  for select using (
    is_active = true or auth.role() in ('authenticated', 'service_role')
  );
drop policy if exists "admin write timetable_meta" on public.timetable_meta;
create policy "admin write timetable_meta" on public.timetable_meta
  for all to authenticated using (true) with check (true);

drop policy if exists "public read timetable_entries" on public.timetable_entries;
create policy "public read timetable_entries" on public.timetable_entries
  for select using (
    exists (
      select 1
      from public.timetable_meta meta
      where meta.id = timetable_entries.version_id
        and (
          meta.is_active = true
          or auth.role() in ('authenticated', 'service_role')
        )
    )
  );
drop policy if exists "admin write timetable_entries" on public.timetable_entries;
create policy "admin write timetable_entries" on public.timetable_entries
  for all to authenticated using (true) with check (true);

create or replace view public.active_timetable_entries
with (security_invoker = true) as
select
  entry.id,
  entry.version_id,
  section.section_key,
  section.display_name as section_name,
  department.code as department_code,
  entry.day_of_week,
  entry.slot_index,
  entry.cell_index,
  entry.raw_text,
  entry.subject_code,
  entry.subject_name,
  entry.teacher_id,
  entry.teacher_name,
  entry.room_names,
  entry.room_keys,
  entry.category,
  entry.credits
from public.timetable_entries entry
join public.sections section on section.id = entry.section_id
join public.departments department on department.id = section.department_id
join public.timetable_meta meta on meta.id = entry.version_id
where meta.is_active = true
  and section.is_active = true;

grant select on public.active_timetable_entries to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('official_timetables', 'official_timetables', true)
on conflict (id) do update set public = true;

drop policy if exists "public read official timetables" on storage.objects;
create policy "public read official timetables" on storage.objects
  for select using (bucket_id = 'official_timetables');

drop policy if exists "admin insert official timetables" on storage.objects;
create policy "admin insert official timetables" on storage.objects
  for insert to authenticated with check (bucket_id = 'official_timetables');

drop policy if exists "admin update official timetables" on storage.objects;
create policy "admin update official timetables" on storage.objects
  for update to authenticated using (bucket_id = 'official_timetables')
  with check (bucket_id = 'official_timetables');

drop policy if exists "admin delete official timetables" on storage.objects;
create policy "admin delete official timetables" on storage.objects
  for delete to authenticated using (bucket_id = 'official_timetables');

create or replace function public.replace_timetable(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_version_id uuid;
  new_version_number int;
  previous_version_id uuid;
  dep_id uuid;
  sec_id uuid;
  tea_id uuid;
  dep record;
  sec record;
  per record;
  tea record;
  roo record;
  ent record;
  room_names_arr text[];
  room_keys_arr text[];
begin
  if auth.role() not in ('authenticated', 'service_role') then
    raise exception 'Admin authentication required';
  end if;

  select id into previous_version_id
  from public.timetable_meta
  where is_active = true
  order by updated_at desc
  limit 1;

  select coalesce(max(version_number), 0) + 1 into new_version_number
  from public.timetable_meta;

  insert into public.timetable_meta (
    version_number,
    term,
    content_hash,
    note,
    changes_json,
    excel_file_url,
    source_file_name,
    is_active
  ) values (
    new_version_number,
    coalesce(payload->>'term', 'Fall 2026'),
    payload->>'content_hash',
    payload->>'note',
    coalesce(payload->'changes', '{}'::jsonb),
    payload->>'excel_file_url',
    payload->>'source_file_name',
    false
  )
  returning id into new_version_id;

  for dep in
    select * from jsonb_to_recordset(coalesce(payload->'departments', '[]'::jsonb))
      as x(code text, name text)
  loop
    insert into public.departments (code, name)
    values (dep.code, dep.name)
    on conflict (code) do update set name = excluded.name;
  end loop;

  update public.sections set is_active = false where is_active = true;

  for sec in
    select * from jsonb_to_recordset(coalesce(payload->'sections', '[]'::jsonb))
      as x(
        section_key text,
        department_code text,
        semester int,
        section_name text,
        batch_label text,
        display_name text
      )
  loop
    select id into dep_id from public.departments where code = sec.department_code;
    if dep_id is null then
      raise exception 'Unknown department %', sec.department_code;
    end if;

    insert into public.sections (
      section_key,
      department_id,
      semester,
      section_name,
      batch_label,
      display_name,
      is_active
    ) values (
      sec.section_key,
      dep_id,
      sec.semester,
      sec.section_name,
      sec.batch_label,
      sec.display_name,
      true
    )
    on conflict (section_key) do update set
      department_id = excluded.department_id,
      semester = excluded.semester,
      section_name = excluded.section_name,
      batch_label = excluded.batch_label,
      display_name = excluded.display_name,
      is_active = true;
  end loop;

  for per in
    select * from jsonb_to_recordset(coalesce(payload->'periods', '[]'::jsonb))
      as x(
        department_code text,
        day_of_week int,
        slot_index int,
        start_time text,
        end_time text,
        label text
      )
  loop
    select id into dep_id from public.departments where code = per.department_code;
    if dep_id is null then
      raise exception 'Unknown department %', per.department_code;
    end if;

    insert into public.periods (
      department_id,
      day_of_week,
      slot_index,
      start_time,
      end_time,
      label
    ) values (
      dep_id,
      per.day_of_week,
      per.slot_index,
      per.start_time,
      per.end_time,
      per.label
    )
    on conflict (department_id, day_of_week, slot_index) do update set
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      label = excluded.label;
  end loop;

  for tea in
    select * from jsonb_to_recordset(coalesce(payload->'teachers', '[]'::jsonb))
      as x(name text, normalized_name text)
  loop
    insert into public.teachers (name, normalized_name)
    values (tea.name, tea.normalized_name)
    on conflict (normalized_name) do update set name = excluded.name;
  end loop;

  for roo in
    select * from jsonb_to_recordset(coalesce(payload->'rooms', '[]'::jsonb))
      as x(name text, normalized_name text)
  loop
    insert into public.rooms (name, normalized_name)
    values (roo.name, roo.normalized_name)
    on conflict (normalized_name) do update set name = excluded.name;
  end loop;

  for ent in
    select * from jsonb_to_recordset(coalesce(payload->'entries', '[]'::jsonb))
      as x(
        section_key text,
        day_of_week int,
        slot_index int,
        cell_index int,
        raw_text text,
        subject_code text,
        subject_name text,
        teacher_name text,
        teacher_key text,
        room_names jsonb,
        room_keys jsonb,
        category text,
        credits text
      )
  loop
    select id into sec_id from public.sections where section_key = ent.section_key;
    if sec_id is null then
      raise exception 'Unknown section %', ent.section_key;
    end if;

    tea_id := null;
    if ent.teacher_key is not null and ent.teacher_key <> '' then
      select id into tea_id from public.teachers where normalized_name = ent.teacher_key;
    end if;

    room_names_arr := array(
      select jsonb_array_elements_text(coalesce(ent.room_names, '[]'::jsonb))
    );
    room_keys_arr := array(
      select jsonb_array_elements_text(coalesce(ent.room_keys, '[]'::jsonb))
    );

    insert into public.timetable_entries (
      version_id,
      section_id,
      day_of_week,
      slot_index,
      cell_index,
      raw_text,
      subject_code,
      subject_name,
      teacher_id,
      teacher_name,
      room_names,
      room_keys,
      category,
      credits
    ) values (
      new_version_id,
      sec_id,
      ent.day_of_week,
      ent.slot_index,
      coalesce(ent.cell_index, 0),
      ent.raw_text,
      ent.subject_code,
      ent.subject_name,
      tea_id,
      ent.teacher_name,
      room_names_arr,
      room_keys_arr,
      ent.category,
      ent.credits
    )
    on conflict (version_id, section_id, day_of_week, slot_index, cell_index)
    do nothing;
  end loop;

  update public.timetable_meta set is_active = false where is_active = true;
  update public.timetable_meta set is_active = true where id = new_version_id;

  delete from public.timetable_meta
  where id <> new_version_id
    and id <> coalesce(previous_version_id, new_version_id);

  return new_version_id;
end;
$$;

grant execute on function public.replace_timetable(jsonb) to authenticated, service_role;
