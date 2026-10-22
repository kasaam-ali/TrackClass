# TrackClass

TrackClass is a university timetable web app for Fall 2026. Students pick their section once, then get a live weekly grid, free rooms, free slots, teacher location, change notices, and a timetable-only assistant.

## Stack

- React 18, Vite 6, TypeScript, Tailwind CSS v4
- Supabase Postgres, Auth, Storage, Edge Functions
- SheetJS for `.xlsx` parsing
- `date-fns-tz` with `Asia/Karachi`
- Vitest for tests
- `vite-plugin-pwa` for offline support

## Local demo

```bash
npm install
npm run dev
```

Open the app and choose **Continue in demo mode**. The demo snapshot is bundled from `sample/timetable-fall-2026.xlsx`, so no backend keys are needed.

Rebuild the demo snapshot after changing the parser:

```bash
npm run demo:snapshot
```

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/migrations/001_init.sql`.
3. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. In Supabase Auth, create the admin user with email and password. Public signup is not used.
5. Deploy the chat Edge Function:

```bash
supabase functions deploy timetable-chat
supabase secrets set GROQ_API_KEY=... GEMINI_API_KEY=... RATE_LIMIT_SALT=...
```

`RATE_LIMIT_SALT` is optional but recommended. The function uses Groq first, then Gemini, then a friendly fallback. Without provider keys the deterministic client answers still work.

6. Restart `npm run dev`.

## Admin flow

Sign in at `/admin/login`, then upload the official `.xlsx` at `/admin/upload`.

The upload flow:

1. Parses the workbook in the browser.
2. Shows parsed counts and a cell-level diff against the active version.
3. Uploads the original file to the public `official_timetables` Storage bucket.
4. Calls `replace_timetable` to publish a new active version.
5. Keeps the new version and the previous version.

The student page checks for a newer `content_hash` on focus and shows a refresh banner. Change notices are section-specific.

## Scripts

```bash
npm run dev
npm run build
npm run typecheck
npm run test
npm run demo:snapshot
```

## Project layout

```text
src/lib/timetable   parser, normalization, engines, types
src/lib/store       local demo store and Supabase store
src/lib/chat        deterministic resolver, history, AI client
src/components      shared, timetable, chat, admin UI
src/pages           student, onboarding, admin pages
supabase            SQL migration and Edge Function
sample              source workbook
scripts             demo snapshot generator
```

## Data notes

- The original `.xlsx` remains the source of truth.
- A slot cell can contain more than one course. Courses are split by course code and kept with `cell_index`.
- Period times vary by department and day. Periods are keyed by department, day, and slot.
- Teacher and room extraction is best effort. The raw cell text is always retained.
- The `Remaining Classrooms` footer row and break timings are not used in v1.
- The app stores the student section and chat history in `localStorage`.
- The app does not use Supabase Realtime. Freshness is checked on load and window focus.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

The current suite covers parsing, cross-section engines, snapshot rebuilding, and the deterministic chat resolver.
