import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  UploadCloud,
} from 'lucide-react'
import { AdminGate } from '../../components/admin/AdminGate'
import { PageShell } from '../../components/PageShell'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useTimetable } from '../../context/TimetableContext'
import { supabase } from '../../lib/supabase'
import { timetableStore } from '../../lib/store'
import { diffSnapshots } from '../../lib/timetable/engines'
import { parseTimetableWorkbook } from '../../lib/timetable/parse'
import { DAY_NAMES, type TimetableSnapshot } from '../../lib/timetable/types'

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not published yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function AdminUploadContent() {
  const navigate = useNavigate()
  const { signOut } = useAdminAuth()
  const { snapshot, meta, reload } = useTimetable()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<TimetableSnapshot | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const diff = parsed ? diffSnapshots(snapshot, parsed) : null

  const handleFile = async (nextFile: File | null) => {
    setError(null)
    setParsed(null)
    setFile(null)
    if (!nextFile) return

    if (!nextFile.name.toLowerCase().endsWith('.xlsx')) {
      setError('Only .xlsx files are supported.')
      return
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      setError('File is larger than 10 MB.')
      return
    }

    setFile(nextFile)
    setBusy(true)
    try {
      const data = new Uint8Array(await nextFile.arrayBuffer())
      const nextSnapshot = parseTimetableWorkbook(data, nextFile.name)
      setParsed(nextSnapshot)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not parse the workbook.')
    } finally {
      setBusy(false)
    }
  }

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0] ?? null)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    void handleFile(event.dataTransfer.files?.[0] ?? null)
  }

  const publish = async () => {
    if (!parsed || !file || !diff) return
    if (!supabase || timetableStore.kind !== 'supabase') {
      setError('Publishing requires a configured Supabase project.')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const path = `${Date.now()}-${sanitizeFileName(file.name)}`
      const { error: uploadError } = await supabase.storage
        .from('official_timetables')
        .upload(path, file, {
          contentType:
            file.type ||
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        })

      if (uploadError) throw new Error(uploadError.message)

      const { data: publicUrl } = supabase.storage
        .from('official_timetables')
        .getPublicUrl(path)

      try {
        await timetableStore.saveSnapshot(parsed, {
          note,
          changes: diff,
          excelFileUrl: publicUrl.publicUrl,
          sourceFileName: file.name,
        })
      } catch (cause) {
        await supabase.storage.from('official_timetables').remove([path])
        throw cause
      }

      await reload()
      navigate('/admin/timetable', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Publish failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      title="Upload timetable"
      subtitle="Parse the official workbook, review the diff, then publish a new version."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/timetable"
            className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Current timetable
          </Link>
          <button
            type="button"
            onClick={() => {
              void signOut()
            }}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-700 hover:text-slate-300"
          >
            Sign out
          </button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Active version</p>
          <p className="mt-1 text-lg font-semibold text-white">
            {meta ? `v${meta.versionNumber}` : 'None'}
          </p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Updated</p>
          <p className="mt-1 text-sm font-medium text-white">{formatDate(meta?.updatedAt)}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Last note</p>
          <p className="mt-1 truncate text-sm text-white">{meta?.note ?? 'No note'}</p>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={
          dragActive
            ? 'mt-6 rounded-2xl border-2 border-dashed border-brand-500 bg-brand-500/10 p-8 text-center'
            : 'mt-6 rounded-2xl border-2 border-dashed border-white/[0.1] bg-white/[0.02] p-8 text-center'
        }
      >
        <UploadCloud className="mx-auto size-8 text-brand-400" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-white">
          Drop the official .xlsx file here
        </p>
        <p className="mt-1 text-xs text-slate-500">Maximum 10 MB, one workbook per upload.</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
        >
          <FileSpreadsheet className="size-4" aria-hidden="true" />
          Choose file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          onChange={onInputChange}
          className="hidden"
        />
        {file ? (
          <p className="mt-3 text-xs text-slate-400">
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {busy && !parsed ? (
        <div className="mt-4 flex items-center gap-2 glass-panel rounded-2xl p-4 text-sm text-slate-400">
          <Loader2 className="size-4 animate-spin text-brand-400" aria-hidden="true" />
          Parsing workbook...
        </div>
      ) : null}

      {parsed && diff ? (
        <div className="mt-6 space-y-4">
          <section className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-white">Parsed workbook</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Departments', parsed.stats.departments],
                ['Sections', parsed.stats.sections],
                ['Entries', parsed.stats.entries],
                ['Free cells', parsed.stats.freeCells],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Term: {parsed.term} · File: {parsed.sourceFileName}
            </p>
          </section>

          <section className="glass-panel rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Change preview</h2>
              <span className="text-[11px] text-slate-500">
                {diff.changedCount} changed cells
              </span>
            </div>
            {diff.changedCount === 0 ? (
              <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-xs text-amber-200">
                No changes detected against the active version. Publishing is disabled.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {[...diff.added, ...diff.removed, ...diff.modified]
                  .slice(0, 12)
                  .map((cell, index) => (
                    <div
                      key={`${cell.sectionKey}-${cell.dayOfWeek}-${cell.slotIndex}-${index}`}
                      className="rounded-lg border border-white/[0.08] bg-ink-900/70/50 p-3"
                    >
                      <p className="text-[11px] font-medium text-slate-300">
                        {cell.sectionName} · {DAY_NAMES[cell.dayOfWeek]} Slot {cell.slotIndex}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {cell.before || 'Free'} → {cell.after || 'Free'}
                      </p>
                    </div>
                  ))}
                {diff.changedCount > 12 ? (
                  <p className="text-[11px] text-slate-500">
                    + {diff.changedCount - 12} more changes
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <section className="glass-panel rounded-2xl p-5">
            <label htmlFor="publish-note" className="text-xs font-medium text-slate-300">
              Admin note (optional)
            </label>
            <textarea
              id="publish-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={400}
              placeholder="e.g. Lab room changed for BSCS Semester 4"
              className="mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-ink-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                This upload becomes the active version. The previous version is kept.
              </p>
              <button
                type="button"
                disabled={busy || diff.changedCount === 0}
                onClick={() => {
                  void publish()
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-slate-600"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UploadCloud className="size-4" aria-hidden="true" />
                )}
                {busy ? 'Publishing...' : 'Publish version'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </PageShell>
  )
}

export function AdminUpload() {
  return (
    <AdminGate>
      <AdminUploadContent />
    </AdminGate>
  )
}
