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
