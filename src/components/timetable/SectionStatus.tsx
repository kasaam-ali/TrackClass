import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Clock, MapPin, Radio, User } from 'lucide-react'
import {
  TIME_ZONE,
  getScheduleState,
} from '../../lib/timetable/engines'
import { DAY_NAMES, type TimetableSnapshot } from '../../lib/timetable/types'

interface SectionStatusProps {
  snapshot: TimetableSnapshot
  sectionKey: string
  now: Date
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function formatClock(now: Date): string {
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)
}

export function SectionStatus({ snapshot, sectionKey, now }: SectionStatusProps) {
  const state = getScheduleState(snapshot, sectionKey, now)

  const headline = state.currentPeriod
    ? state.isFreeNow
      ? 'Free right now'
      : 'In class now'
    : state.nextPeriod
      ? 'Outside class hours'
      : 'No upcoming classes'

  const detail = state.currentPeriod
    ? state.isFreeNow
      ? `No class in ${state.currentPeriod.label}.`
      : state.currentEntries
          .map((entry) => entry.subjectName ?? entry.rawText)
          .join(', ')
    : state.nextPeriod && state.nextDayOfWeek
      ? `${state.nextEntries.length ? state.nextEntries.map((entry) => entry.subjectName ?? entry.rawText).join(', ') : 'Free'} on ${DAY_NAMES[state.nextDayOfWeek]} ${state.nextPeriod.label}`
      : 'The timetable has no more slots this week.'

  const accent = state.currentPeriod && !state.isFreeNow ? 'text-accent-300' : 'text-brand-300'
  const accentBg =
    state.currentPeriod && !state.isFreeNow
      ? 'from-accent-500/12 via-transparent to-transparent'
      : 'from-brand-500/12 via-transparent to-transparent'

  return (
    <section className="glass-panel relative overflow-hidden rounded-3xl p-5">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentBg}`}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span className={`relative size-1.5 rounded-full bg-current ${accent} live-dot`} />
            Live status
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-slate-400">
            <Clock className="size-3" aria-hidden="true" />
            {formatClock(now)} PKT
          </span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={headline}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className={`font-display mt-4 text-2xl font-semibold ${accent}`}>
              {headline}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-slate-400">{detail}</p>
          </motion.div>
        </AnimatePresence>

        {state.currentPeriod ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 text-slate-500" aria-hidden="true" />
              {state.currentPeriod.startTime} - {state.currentPeriod.endTime}
            </span>
            {state.currentEntries[0]?.teacherName ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3.5 text-slate-500" aria-hidden="true" />
                {state.currentEntries[0].teacherName}
              </span>
            ) : null}
            {state.currentEntries[0]?.roomNames.length ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-slate-500" aria-hidden="true" />
                {state.currentEntries[0].roomNames.join(', ')}
              </span>
            ) : null}
          </div>
        ) : state.nextPeriod && state.minutesUntilNext !== null ? (
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/[0.06] pt-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
              <Radio className="size-3 text-brand-400" aria-hidden="true" />
              Next class in
            </span>
            <span className="font-display flex items-center gap-1 text-xl font-semibold text-white">
              {formatMinutes(state.minutesUntilNext)}
              <ArrowUpRight className="size-3.5 text-brand-400" aria-hidden="true" />
            </span>
          </div>
        ) : null}
      </div>
    </section>
  )
}
