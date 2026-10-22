# Production Execution Plan: TrackClass & Cross-Section AI Platform

## 1. Architecture Overview

- Dataset scale: 3 departments, 22 sections, 10 slots per section, 220 slot cells total. Current file: 177 occupied cells, 43 free cells.
- The full active timetable is a small JSON snapshot (about 20 KB). The client fetches it once, stores it in `localStorage`, and serves cross-section queries instantly. `vite-plugin-pwa` provides offline caching of the app shell and assets.
- No `chat_cache` table. Time-relative answers ("now", "today", "next class") become stale if cached globally.
- No Supabase Realtime WebSockets. Timetable changes are rare. Check `version_id` / `content_hash` on app load and window focus.
- Store the original uploaded `.xlsx` in Supabase Storage bucket `official_timetables` so students can view or download the official sheet.

## 2. Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, `vite-plugin-pwa`
- Backend: Supabase Postgres, Auth, Storage, Edge Functions
- Parsing: SheetJS (`xlsx`), `zod`, `date-fns`, `date-fns-tz` with `Asia/Karachi`
- Testing: Vitest
- AI: Groq (`llama-3.3-70b-versatile`) primary, Gemini (`gemini-2.5-flash`) fallback, called only from the Edge Function

## 3. Corrections Applied To The Original Plan

1. Periods are per department and day. Times differ:
   - BSCS afternoon: 12:10 to 15:10
   - BSIT and BSAI afternoon: 12:00 to 15:00
   - Friday for all departments: 09:00 to 11:30 and 11:30 to 14:00
   - Schema key: `(department_id, day_of_week, slot_index)`.
2. A single grid cell can contain two courses. Entries are split into multiple rows sharing `(section_id, day_of_week, slot_index)` and distinguished by `cell_index`. A slot is free only when no entry exists for that cell.
3. Version retention: keep the latest version and one previous version for rollback and diffing. Delete older versions after publish.
4. Cross-section features need normalized `rooms` and `teachers` tables plus alias mapping. Room strings such as `A3 & A8`, `Lab 01`, and bare `A8` are normalized during parsing.
5. No `chat_cache` table.
6. No Supabase Realtime subscriptions. Use load and focus version checks.
7. Admin AI normalization is optional and must show before and after values. It never silently rewrites published data.

## 4. Database Schema

### 4.1 Storage

- Bucket: `official_timetables`
- Public read, authenticated admin write
- Object path: `fall-2026-v1.xlsx`, `fall-2026-v2.xlsx`, etc.

### 4.2 Tables

`departments`
- `id uuid primary key`
- `code text unique not null`
- `name text not null`

`sections`
- `id uuid primary key`
- `department_id uuid references departments`
- `semester int not null`
- `section_name text not null`
- `batch_label text not null`
- `display_name text unique not null`
- unique `(department_id, semester, section_name, batch_label)`

`periods`
- `department_id uuid references departments`
- `day_of_week int not null check between 1 and 5`
- `slot_index int not null check in (1, 2)`
- `start_time text not null`
- `end_time text not null`
- `label text not null`
- primary key `(department_id, day_of_week, slot_index)`

`teachers`
- `id uuid primary key`
- `name text not null`
- `normalized_name text unique not null`

`rooms`
- `id uuid primary key`
- `name text not null`
- `normalized_name text unique not null`

`timetable_meta`
- `id uuid primary key`
- `version_number int not null`
- `term text not null default 'Fall 2026'`
- `content_hash text not null`
- `note text`
- `changes_json jsonb not null default '{}'`
- `excel_file_url text`
- `source_file_name text`
- `is_active boolean not null default false`
- `updated_at timestamptz not null default now()`

`timetable_entries`
- `id uuid primary key`
- `version_id uuid references timetable_meta on delete cascade`
- `section_id uuid references sections`
- `day_of_week int not null`
- `slot_index int not null`
- `cell_index int not null default 0`
- `raw_text text not null`
- `subject_code text`
- `subject_name text`
- `teacher_id uuid references teachers`
- `room_id uuid references rooms`
- `category text`
- `credits text`
- unique `(version_id, section_id, day_of_week, slot_index, cell_index)`

`chat_rate_limits`
- `client_ip_hash text primary key`
- `window_start timestamptz not null`
- `request_count int not null`

### 4.3 RLS

- Public `SELECT` on `departments`, `sections`, `periods`, `teachers`, `rooms`, `timetable_meta`, `timetable_entries`.
- Authenticated admin only for `INSERT`, `UPDATE`, `DELETE`.
- Storage bucket public read, authenticated write.

### 4.4 RPC `replace_timetable(payload jsonb)`

Atomic transaction:
1. Verify `auth.role() = 'authenticated'`.
2. Insert new `timetable_meta` row.
3. Upsert departments, sections, periods, teachers, rooms.
4. Bulk insert entries.
5. Set previous active version inactive.
6. Set new version active.
7. Delete versions older than the previous one.
8. Return new version id.

## 5. Parser Design

- Input: `.xlsx` array buffer.
- Detect department header rows such as `Semesters BSCS`, `Semester BSIT`, `Semester BSAI`.
- Detect day header row containing MONDAY through FRIDAY.
- Read the following time row and build periods per department, day, slot.
- Detect section rows matching `BATCH-<n>TH SEMESTER <n>TH (SECTION-A)`.
- For every section row and day/slot cell:
  - Empty cell means free slot.
  - Non-empty cell is split by course code boundaries into one or more entries.
- Extract best-effort fields:
  - `subject_code` from patterns such as `CSC-211`, `ITC-212`, `UE-682`
  - `subject_name`
  - `teacher_name`
  - `room_name`
  - `category`
  - `credits`
  - `raw_text` always preserved
- Normalize room strings:
  - `A3 & A8` becomes two rooms
  - `Lab 01`, `Smart Lab`, `IoT Lab`, `Dld Lab` preserved as room names
  - bare trailing room tokens such as `A8` recognized
- Normalize teacher names:
  - strip titles and extra spaces for matching
  - keep display name

Verified counts from `sample/timetable-fall-2026.xlsx`:
- departments: 3
- sections: 22
- slot cells: 220
- free cells: 43
- occupied cells: 177

## 6. Application Pages

### 6.1 `/onboarding`

- Department, then semester, then section with batch label.
- Save selection in `localStorage`.
- Redirect to `/`.

### 6.2 `/` Student Main Page

Header:
- Section switcher
- `Updated: <timestamp>` badge and admin note
- `Download Official Excel (.xlsx)` button
- Dismissible change banner with section-specific diff

Tabs:
1. My Section Grid
   - Rows: `Slot 1 (09:00-12:00)`, `Slot 2 (12:10-15:10)` using department times
   - Columns: Mon to Fri
   - Empty cells badged `FREE`
   - Class cells show raw text plus parsed badges
2. University Free Rooms and Labs
   - Select day and slot, default current PKT slot
   - Show unoccupied rooms and labs across all sections
   - Show free sections for the selected slot
3. Teacher Locator
   - Search or select a teacher
   - Show current location and full weekly schedule

Bottom chat section:
- Suggested chips: `Abhi kaunsa room free hai?`, `Sir <name> abhi kis class mein hain?`, `Meri agli class konsi hai?`, `Friday ko kaunse slots free hain?`
- Answers include text and structured slot cards
- History in `localStorage`, clear button

### 6.3 Admin

- `/admin/login`: Supabase email/password
- `/admin/upload`: drag and drop `.xlsx`, parse, preview, optional AI normalization review, diff preview, note, upload to Storage, call RPC
- `/admin/timetable`: browse all sections and inspect parsed fields

## 7. Hybrid Chat

### Tier 1: Client deterministic engine

Runs first against the cached snapshot and current `Asia/Karachi` time:
- Free room queries
- Teacher location queries
- Section schedule and free slot queries
- Change queries
- Class timing queries

Deterministic answers cost nothing and work offline.

### Tier 2: Supabase Edge Function `timetable-chat`

- Rate limit: 10 requests per minute per hashed IP via `chat_rate_limits`.
- Context: current PKT day and time, selected section, compact relevant timetable JSON.
- Guardrails: only university timetable, room, teacher, and section questions. Off-topic requests refused.
- Provider chain: Groq 6 second timeout, then Gemini, then friendly fallback.
- Keys live in Supabase secrets: `GROQ_API_KEY`, `GEMINI_API_KEY`.

## 8. Phased Roadmap With Verification Gates

### Phase 1: Scaffold, Config, PWA

- Vite, React, TypeScript, Tailwind, `vite-plugin-pwa`
- `.env.example`
- Setup screen when Supabase keys are missing
- Verify: `npm run typecheck` and `npm run dev` pass.

### Phase 2: Parser, Entity Extractor, Tests

- Generic grid parser for this workbook
- Best-effort entity extraction
- Verify: Vitest asserts 3 departments, 22 sections, 220 slot cells, 177 occupied, 43 free.

### Phase 3: Cross-Section Engines

- Free room finder
- Teacher locator
- Diff engine
- Verify: unit tests for each engine.

### Phase 4: Supabase Migration, Storage, RLS, RPC

- SQL migrations for tables, policies, bucket, and `replace_timetable`
- Local mock store adapter so the app runs before live keys exist
- Verify: SQL review, mock adapter tests.

### Phase 5: Onboarding and Student Main Page

- Onboarding with persistence
- Header, grid, free rooms, teacher locator, Excel download
- Verify: persistence across refresh and responsive layout.

### Phase 6: Hybrid Chat

- Chat UI, chips, slot cards, history
- Tier 1 resolver
- Edge Function with rate limit and provider fallback
- Verify: sample queries, off-topic rejection, rate limit handling.

### Phase 7: Admin Portal

- Login, upload wizard, diff preview, Storage upload, publish
- Verify: upload flow, no-change detection, diff generation.

### Phase 8: Polish and Production Build

- Mobile ergonomics, empty and error states, README
- Verify: all Vitest tests green and `npm run build` succeeds with zero TypeScript errors.

## 9. Assumptions

- Upload replaces the full university timetable.
- Original `.xlsx` remains the source of truth.
- Teacher and room extraction is best-effort and `raw_text` is always shown.
- The `Remaining Classrooms` footer row and break timings are not used in v1.
- Admin account is created manually in Supabase Auth.
