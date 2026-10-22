import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, RefreshCw, UploadCloud } from 'lucide-react'
import { AdminGate } from '../../components/admin/AdminGate'
import { PageShell } from '../../components/PageShell'
import { WeeklyGrid } from '../../components/timetable/WeeklyGrid'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { useTimetable } from '../../context/TimetableContext'
import type { SnapshotDiff } from '../../lib/timetable/engines'
import { DAY_NAMES } from '../../lib/timetable/types'

function isDiff(value: unknown): value is SnapshotDiff {
  if (!value || typeof value !== 'object') return false
  const diff = value as Partial<SnapshotDiff>
  return Array.isArray(diff.added) && Array.isArray(diff.removed) && Array.isArray(diff.modified)
}

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

function AdminTimetableContent() {
  const { signOut } = useAdminAuth()
  const { snapshot, meta, loading, error, reload } = useTimetable()
  const [departmentCode, setDepartmentCode] = useState('')
  const [semester, setSemester] = useState<number | null>(null)
  const [sectionKey, setSectionKey] = useState('')

  const departments = snapshot?.departments ?? []
  const effectiveDepartment = departmentCode || departments[0]?.code || ''
  const departmentSections = useMemo(
    () =>
      (snapshot?.sections ?? []).filter(
        (section) => section.departmentCode === effectiveDepartment,
      ),
    [snapshot?.sections, effectiveDepartment],
  )
  const semesters = useMemo(
    () => [...new Set(departmentSections.map((section) => section.semester))].sort((a, b) => a - b),
    [departmentSections],
  )
  const effectiveSemester = semester ?? semesters[0] ?? null
  const visibleSections = useMemo(
    () => departmentSections.filter((section) => section.semester === effectiveSemester),
    [departmentSections, effectiveSemester],
  )
  const effectiveSectionKey = visibleSections.some((section) => section.key === sectionKey)
    ? sectionKey
    : (visibleSections[0]?.key ?? '')
  const section = (snapshot?.sections ?? []).find(
    (item) => item.key === effectiveSectionKey,
  )
  const entries = (snapshot?.entries ?? [])
    .filter((entry) => entry.sectionKey === effectiveSectionKey)
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex
      return a.cellIndex - b.cellIndex
    })

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to="/admin/upload"
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-400"
      >
        <UploadCloud className="size-3.5" aria-hidden="true" />
        Upload new
      </Link>
      <Link
        to="/"
        className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
      >
        Student view
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
  )

  if (loading) {
    return (
      <PageShell title="Current timetable" subtitle="Loading the active version." actions={actions}>
        <div className="flex items-center gap-3 glass-panel rounded-2xl p-6 text-sm text-slate-400">
          <RefreshCw className="size-4 animate-spin text-brand-400" aria-hidden="true" />
          Loading...
        </div>
      </PageShell>
    )
  }

  if (!snapshot) {
    return (
      <PageShell title="Current timetable" subtitle="No active version found." actions={actions}>
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-slate-400">{error ?? 'Upload the first timetable to get started.'}</p>
          <Link
            to="/admin/upload"
            className="mt-4 inline-flex rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
          >
            Upload timetable
          </Link>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Current timetable"
      subtitle={`${snapshot.term}${meta ? ` · Version ${meta.versionNumber} · Updated ${formatDate(meta.updatedAt)}` : ''}`}
      actions={actions}
    >
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ['Departments', snapshot.stats.departments],
          ['Sections', snapshot.stats.sections],
          ['Entries', snapshot.stats.entries],
          ['Free cells', snapshot.stats.freeCells],
        ].map(([label, value]) => (
          <div key={label} className="glass-panel rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 glass-panel rounded-2xl p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Admin note</p>
          <p className="mt-1 truncate text-sm text-slate-300">{meta?.note ?? 'No note'}</p>
        </div>
        {meta && isDiff(meta.changes) ? (
          <p className="text-[11px] text-slate-500">
            Last publish: {meta.changes.changedCount} changed cells
          </p>
        ) : null}
        {meta?.excelFileUrl ? (
          <a
            href={meta.excelFileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Excel
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void reload()
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400 transition hover:border-slate-700 hover:text-white"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Reload
        </button>
      </div>

      <section className="mt-6 glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="admin-department" className="text-[10px] uppercase tracking-wide text-slate-500">
              Department
            </label>
            <select
              id="admin-department"
              value={effectiveDepartment}
              onChange={(event) => {
                setDepartmentCode(event.target.value)
                setSemester(null)
                setSectionKey('')
              }}
              className="mt-1 block rounded-lg border border-white/[0.08] bg-ink-900/70 px-3 py-2 text-xs text-slate-300 focus:border-brand-500 focus:outline-none"
            >
              {departments.map((department) => (
                <option key={department.code} value={department.code}>
                  {department.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-semester" className="text-[10px] uppercase tracking-wide text-slate-500">
              Semester
            </label>
            <select
              id="admin-semester"
              value={effectiveSemester ?? ''}
              onChange={(event) => {
                setSemester(Number(event.target.value))
                setSectionKey('')
              }}
              className="mt-1 block rounded-lg border border-white/[0.08] bg-ink-900/70 px-3 py-2 text-xs text-slate-300 focus:border-brand-500 focus:outline-none"
            >
              {semesters.map((value) => (
                <option key={value} value={value}>
                  Semester {value}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label htmlFor="admin-section" className="text-[10px] uppercase tracking-wide text-slate-500">
              Section
            </label>
            <select
              id="admin-section"
              value={effectiveSectionKey}
              onChange={(event) => setSectionKey(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-white/[0.08] bg-ink-900/70 px-3 py-2 text-xs text-slate-300 focus:border-brand-500 focus:outline-none"
            >
              {visibleSections.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {section ? (
        <>
          <section className="mt-4 glass-panel rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Weekly grid</h2>
            <WeeklyGrid snapshot={snapshot} sectionKey={section.key} />
          </section>

          <section className="mt-4 glass-panel rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Parsed entries</h2>
              <span className="text-[11px] text-slate-500">{entries.length} entries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="border-b border-white/[0.08] py-2 pr-3">Day</th>
                    <th className="border-b border-white/[0.08] py-2 pr-3">Slot</th>
                    <th className="border-b border-white/[0.08] py-2 pr-3">Subject</th>
                    <th className="border-b border-white/[0.08] py-2 pr-3">Teacher</th>
                    <th className="border-b border-white/[0.08] py-2 pr-3">Rooms</th>
                    <th className="border-b border-white/[0.08] py-2 pr-3">Category</th>
                    <th className="border-b border-white/[0.08] py-2 pr-3">Credits</th>
                    <th className="border-b border-white/[0.08] py-2">Raw text</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={`${entry.dayOfWeek}-${entry.slotIndex}-${entry.cellIndex}`}
                      className="align-top"
                    >
                      <td className="border-b border-white/[0.05] py-2 pr-3 text-slate-300">
                        {DAY_NAMES[entry.dayOfWeek]}
                      </td>
                      <td className="border-b border-white/[0.05] py-2 pr-3 text-slate-400">
                        {entry.slotIndex}
                      </td>
                      <td className="border-b border-white/[0.05] py-2 pr-3 text-slate-300">
                        {entry.subjectCode ? `${entry.subjectCode} ` : ''}
                        {entry.subjectName ?? ''}
                      </td>
                      <td className="border-b border-white/[0.05] py-2 pr-3 text-slate-400">
                        {entry.teacherName ?? ''}
                      </td>
                      <td className="border-b border-white/[0.05] py-2 pr-3 text-slate-400">
                        {entry.roomNames.join(', ')}
                      </td>
                      <td className="border-b border-white/[0.05] py-2 pr-3 text-slate-500">
                        {entry.category ?? ''}
                      </td>
                      <td className="border-b border-white/[0.05] py-2 pr-3 text-slate-500">
                        {entry.credits ?? ''}
                      </td>
                      <td className="max-w-[320px] border-b border-white/[0.05] py-2 text-slate-500">
                        {entry.rawText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </PageShell>
  )
}

export function AdminTimetable() {
  return (
    <AdminGate>
      <AdminTimetableContent />
    </AdminGate>
  )
}
