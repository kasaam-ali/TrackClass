import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { toZonedTime } from 'date-fns-tz'
import {
  ArrowLeftRight,
  CalendarDays,
  Download,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { TimetableChat } from '../components/chat/TimetableChat'
import { DashboardTabs, type DashboardTabId } from '../components/dashboard/DashboardTabs'
import { OverviewPanel } from '../components/dashboard/OverviewPanel'
import { SectionRail } from '../components/dashboard/SectionRail'
import { PageShell } from '../components/PageShell'
import { ChangeBanner } from '../components/timetable/ChangeBanner'
import { FreeRoomsPanel } from '../components/timetable/FreeRoomsPanel'
import { TeacherLocator } from '../components/timetable/TeacherLocator'
import { WeeklyGrid } from '../components/timetable/WeeklyGrid'
import { useProfile } from '../context/ProfileContext'
import { useTimetable } from '../context/TimetableContext'
import { TIME_ZONE } from '../lib/timetable/engines'
import type {
  DayOfWeek,
  SlotIndex,
  TimetableSnapshot,
} from '../lib/timetable/types'
import { useNow } from '../lib/useNow'

function minutesOf(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function defaultDaySlot(
  snapshot: TimetableSnapshot,
  departmentCode: string,
  now: Date,
): { day: DayOfWeek; slot: SlotIndex } {
  const zoned = toZonedTime(now, TIME_ZONE)
  const jsDay = zoned.getDay()
  const day: DayOfWeek = jsDay >= 1 && jsDay <= 5 ? (jsDay as DayOfWeek) : 1
  const minutes = zoned.getHours() * 60 + zoned.getMinutes()
  const periods = snapshot.periods
    .filter((period) => period.departmentCode === departmentCode && period.dayOfWeek === day)
    .sort((a, b) => a.slotIndex - b.slotIndex)

  const current = periods.find(
    (period) =>
      minutes >= minutesOf(period.startTime) && minutes < minutesOf(period.endTime),
  )
  if (current) return { day, slot: current.slotIndex }

  const next = periods.find((period) => minutes < minutesOf(period.startTime))
  return { day, slot: next?.slotIndex ?? 1 }
}

const iconButton =
  'inline-flex size-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition hover:border-brand-400/30 hover:bg-brand-400/10 hover:text-white'

export function StudentDashboard() {
  const { profile, setProfile } = useProfile()
  const { snapshot, meta, loading, error, updateAvailable, reload } = useTimetable()
  const [activeTab, setActiveTab] = useState<DashboardTabId>('overview')
  const now = useNow()

  if (!profile) return <Navigate to="/onboarding" replace />

  if (loading) {
    return (
      <PageShell title="Loading timetable" subtitle="Fetching the latest published version.">
        <div className="glass-panel flex items-center gap-3 rounded-2xl p-6 text-sm text-slate-400">
          <RefreshCw className="size-4 animate-spin text-brand-400" aria-hidden="true" />
          Loading your section...
        </div>
      </PageShell>
    )
  }

  if (!snapshot) {
    return (
      <PageShell title="Timetable unavailable" subtitle="The live timetable could not be loaded.">
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-slate-400">{error ?? 'No timetable has been published yet.'}</p>
          <button
            type="button"
            onClick={() => {
              void reload()
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-400/30 hover:text-white"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </PageShell>
    )
  }

  const section = snapshot.sections.find((item) => item.key === profile.sectionKey)

  if (!section) {
    return (
      <PageShell title="Section not found" subtitle="This section is missing from the current timetable.">
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-slate-400">
            The timetable may have changed. Pick your section again to continue.
          </p>
          <Link
            to="/onboarding"
            className="mt-4 inline-flex rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
          >
            Change section
          </Link>
        </div>
      </PageShell>
    )
  }

  const defaults = defaultDaySlot(snapshot, section.departmentCode, now)

  const actions = (
    <>
      {meta?.excelFileUrl ? (
        <a
          href={meta.excelFileUrl}
          target="_blank"
          rel="noreferrer"
          title="Download original Excel"
          aria-label="Download original Excel"
          className={iconButton}
        >
          <Download className="size-4" aria-hidden="true" />
        </a>
      ) : null}
      <Link
        to="/onboarding"
        title="Change section"
        aria-label="Change section"
        className={iconButton}
      >
        <ArrowLeftRight className="size-4" aria-hidden="true" />
      </Link>
      <Link
        to="/admin/login"
        title="Admin login"
        aria-label="Admin login"
        className={iconButton}
      >
        <ShieldCheck className="size-4" aria-hidden="true" />
      </Link>
    </>
  )

  return (
    <PageShell
      center={<DashboardTabs active={activeTab} onChange={setActiveTab} />}
      below={
        <SectionRail
          sections={snapshot.sections}
          activeKey={section.key}
          onSelect={(next) => {
            setProfile({ departmentCode: next.departmentCode, sectionKey: next.key })
          }}
        />
      }
      actions={actions}
    >
      {updateAvailable ? (
        <div className="animate-fade mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4">
          <p className="text-sm text-amber-200">
            A newer timetable version has been published.
          </p>
          <button
            type="button"
            onClick={() => {
              void reload()
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-200"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Refresh
          </button>
        </div>
      ) : null}

      {meta ? <ChangeBanner meta={meta} sectionKey={section.key} /> : null}

      {meta?.note ? (
        <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-xs leading-5 text-slate-300">
          <span className="font-semibold text-slate-400">Admin note: </span>
          {meta.note}
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          role="tabpanel"
          id={`panel-${activeTab}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'overview' ? (
            <OverviewPanel
              snapshot={snapshot}
              section={section}
              meta={meta}
              now={now}
              onTab={setActiveTab}
            />
          ) : null}

          {activeTab === 'timetable' ? (
            <section className="glass-panel rounded-3xl p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl border border-brand-400/20 bg-brand-400/10">
                    <CalendarDays className="size-5 text-brand-300" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Full week
                    </p>
                    <h2 className="font-display mt-0.5 text-lg font-semibold text-white">
                      Weekly timetable
                    </h2>
                  </div>
                </div>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[10px] text-slate-400">
                  {snapshot.stats.freeCells} free cells across all sections
                </span>
              </div>
              <WeeklyGrid snapshot={snapshot} sectionKey={section.key} />
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-3 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm border border-dashed border-accent-400/50 bg-accent-500/10" />
                  Free slot
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-brand-400/70" />
                  Scheduled class
                </span>
              </div>
            </section>
          ) : null}

          {activeTab === 'rooms' ? (
            <FreeRoomsPanel
              snapshot={snapshot}
              initialDay={defaults.day}
              initialSlot={defaults.slot}
            />
          ) : null}

          {activeTab === 'teachers' ? <TeacherLocator snapshot={snapshot} now={now} /> : null}

          {activeTab === 'assistant' ? (
            <div className="mx-auto w-full max-w-4xl">
              <TimetableChat key={section.key} snapshot={snapshot} sectionKey={section.key} />
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  )
}
