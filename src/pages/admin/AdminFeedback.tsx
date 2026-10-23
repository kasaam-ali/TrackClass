import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Star,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react'
import { AdminGate } from '../../components/admin/AdminGate'
import { Reveal, Stagger, StaggerItem } from '../../components/motion/Reveal'
import { PageShell } from '../../components/PageShell'
import { LoadingPanel } from '../../components/ui/LoadingState'
import { useAdminAuth } from '../../context/AdminAuthContext'
import {
  FEEDBACK_STATUSES,
  feedbackCategoryLabel,
  feedbackStatusLabel,
  listFeedback,
  updateFeedbackStatus,
  type FeedbackEntry,
  type FeedbackStatus,
} from '../../lib/feedback'

type FeedbackFilter = FeedbackStatus | 'all'

const FILTERS: { value: FeedbackFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
]

const STATUS_STYLES: Record<FeedbackStatus, string> = {
  new: 'border-brand-400/25 bg-brand-400/10 text-brand-200',
  reviewed: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  resolved: 'border-accent-400/25 bg-accent-400/10 text-accent-300',
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={`size-3.5 ${value <= rating ? 'text-amber-400' : 'text-slate-700'}`}
          fill={value <= rating ? 'currentColor' : 'none'}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function AdminFeedbackContent() {
  const { signOut } = useAdminAuth()
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FeedbackFilter>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await listFeedback())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load feedback.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const counts = useMemo(
    () => ({
      total: entries.length,
      new: entries.filter((entry) => entry.status === 'new').length,
      reviewed: entries.filter((entry) => entry.status === 'reviewed').length,
      resolved: entries.filter((entry) => entry.status === 'resolved').length,
    }),
    [entries],
  )

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((entry) => entry.status === filter)),
    [entries, filter],
  )

  const stats: { label: string; value: number; icon: LucideIcon }[] = [
    { label: 'Total', value: counts.total, icon: MessageSquareText },
    { label: 'New', value: counts.new, icon: Clock3 },
    { label: 'Reviewed', value: counts.reviewed, icon: Inbox },
    { label: 'Resolved', value: counts.resolved, icon: CheckCircle2 },
  ]

  const changeStatus = async (entry: FeedbackEntry, status: FeedbackStatus) => {
    if (entry.status === status) return
    setUpdatingId(entry.id)
    setError(null)
    try {
      await updateFeedbackStatus(entry.id, status)
      setEntries((current) =>
        current.map((item) => (item.id === entry.id ? { ...item, status } : item)),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update feedback.')
    } finally {
      setUpdatingId(null)
    }
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        to="/admin/timetable"
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
      >
        <CalendarDays className="size-3.5" aria-hidden="true" />
        Current timetable
      </Link>
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

  return (
    <PageShell
      title="Student feedback"
      subtitle="Review notes from students and keep track of what has been handled."
      actions={actions}
    >
      <Stagger className="grid gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <StaggerItem
            key={label}
            whileHover={{ y: -3, scale: 1.004 }}
            className="glass-panel card-lift rounded-2xl p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <Icon className="size-4 text-brand-300" aria-hidden="true" />
            </div>
            <p className="mt-1 text-xl font-semibold text-white">{value}</p>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-4 flex flex-wrap items-center gap-2 glass-panel rounded-2xl p-3">
        <span className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Filter
        </span>
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              filter === item.value
                ? 'bg-brand-500 text-white'
                : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            void load()
          }}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          Refresh
        </button>
      </Reveal>

      {loading ? (
        <div className="mt-4">
          <LoadingPanel
            label="Loading feedback..."
            detail="Fetching the latest student notes."
            rows={3}
          />
        </div>
      ) : error ? (
        <div className="mt-4 glass-panel rounded-2xl p-6">
          <p className="text-sm text-slate-300">{error}</p>
          <p className="mt-2 text-xs text-slate-500">
            If this is a fresh project, run the feedback migration in
            <code className="mx-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-slate-300">
              supabase/migrations/003_feedback.sql
            </code>
            first.
          </p>
          <button
            type="button"
            onClick={() => {
              void load()
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 glass-panel rounded-2xl p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <Inbox className="size-6 text-slate-500" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm font-semibold text-white">No feedback here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
            Student notes will appear here as soon as they are submitted.
          </p>
        </div>
      ) : (
        <Stagger className="mt-4 space-y-3">
          {filtered.map((entry) => (
            <StaggerItem key={entry.id} className="glass-panel card-lift rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-400/20 bg-brand-400/10">
                    <MessageSquareText className="size-4 text-brand-300" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={entry.rating} />
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[entry.status]}`}
                      >
                        {feedbackStatusLabel(entry.status)}
                      </span>
                      <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        {feedbackCategoryLabel(entry.category)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {entry.sectionKey ?? 'Unknown section'}
                      {entry.departmentCode ? ` - ${entry.departmentCode}` : ''} -{' '}
                      {formatDate(entry.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {updatingId === entry.id ? (
                    <Loader2 className="size-4 animate-spin text-slate-500" aria-hidden="true" />
                  ) : null}
                  <select
                    aria-label={`Update status for feedback from ${entry.sectionKey ?? 'unknown section'}`}
                    value={entry.status}
                    onChange={(event) => {
                      void changeStatus(entry, event.target.value as FeedbackStatus)
                    }}
                    disabled={updatingId === entry.id}
                    className="rounded-xl border border-white/[0.08] bg-ink-900/70 px-3 py-1.5 text-xs text-slate-300 transition focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {FEEDBACK_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {entry.message}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </PageShell>
  )
}

export function AdminFeedback() {
  return (
    <AdminGate>
      <AdminFeedbackContent />
    </AdminGate>
  )
}
