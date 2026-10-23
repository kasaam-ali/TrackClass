import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toZonedTime } from 'date-fns-tz'
import { CalendarDays, GraduationCap, MapPin, Search, UserRound, X } from 'lucide-react'
import {
  TIME_ZONE,
  buildTeacherIndex,
  findTeachers,
} from '../../lib/timetable/engines'
import {
  DAY_NAMES,
  type TimetableEntry,
  type TimetableSnapshot,
} from '../../lib/timetable/types'
import { Stagger, StaggerItem } from '../motion/Reveal'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface TeacherLocatorProps {
  snapshot: TimetableSnapshot
  now: Date
}

function minutesOf(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function entryIsActive(
  snapshot: TimetableSnapshot,
  entry: TimetableEntry,
  now: Date,
): boolean {
  const zoned = toZonedTime(now, TIME_ZONE)
  if (zoned.getDay() !== entry.dayOfWeek) return false

  const section = snapshot.sections.find((item) => item.key === entry.sectionKey)
  if (!section) return false

  const period = snapshot.periods.find(
    (item) =>
      item.departmentCode === section.departmentCode &&
      item.dayOfWeek === entry.dayOfWeek &&
      item.slotIndex === entry.slotIndex,
  )
  if (!period) return false

  const minutes = zoned.getHours() * 60 + zoned.getMinutes()
  return minutes >= minutesOf(period.startTime) && minutes < minutesOf(period.endTime)
}

export function TeacherLocator({ snapshot, now }: TeacherLocatorProps) {
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const index = useMemo(() => buildTeacherIndex(snapshot), [snapshot])
  const selected = index.find((teacher) => teacher.key === selectedKey) ?? null
  const matches = useMemo(
    () => (query.trim() ? findTeachers(snapshot, query).slice(0, 8) : []),
    [snapshot, query],
  )
  const showResults = query.trim().length > 0 && !selected
  const sectionNames = useMemo(
    () => new Map(snapshot.sections.map((section) => [section.key, section.displayName])),
    [snapshot.sections],
  )

  const choose = (key: string, displayName: string) => {
    setSelectedKey(key)
    setQuery(displayName)
  }

  const clear = () => {
    setSelectedKey('')
    setQuery('')
  }

  return (
    <section className="glass-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl border border-violet-400/20 bg-violet-500/10">
            <GraduationCap className="size-5 text-violet-300" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/80">
              Faculty finder
            </p>
            <h2 className="font-display mt-0.5 text-xl font-semibold text-white">
              Teacher locator
            </h2>
          </div>
        </div>
        {selected ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-slate-400 transition hover:border-white/15 hover:text-white"
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear
          </button>
        ) : (
          <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[10px] text-slate-500">
            {index.length} teachers indexed
          </span>
        )}
      </div>

      <div className="relative mt-5 max-w-xl">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelectedKey('')
          }}
          placeholder="Search a teacher by name"
          className="w-full rounded-xl border border-white/[0.08] bg-ink-900/70 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 transition focus:border-violet-400/50 focus:outline-none"
        />
        <AnimatePresence initial={false}>
          {showResults ? (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/[0.1] bg-ink-900/95 shadow-2xl backdrop-blur-xl"
            >
              {matches.length > 0 ? (
                matches.map((teacher) => (
                  <button
                    key={teacher.key}
                    type="button"
                    onClick={() => choose(teacher.key, teacher.displayName)}
                    className="flex w-full items-center justify-between gap-3 border-b border-white/[0.04] px-3.5 py-2.5 text-left text-xs text-slate-300 transition last:border-0 hover:bg-violet-500/10 hover:text-white"
                  >
                    <span className="truncate">{teacher.displayName}</span>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {teacher.entries.length} classes
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3.5 py-3 text-xs text-slate-500">No teacher found.</p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {selected ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="mt-5"
        >
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-400/15 bg-violet-500/[0.055] px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full border border-violet-400/25 bg-violet-500/15">
              <UserRound className="size-4 text-violet-300" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{selected.displayName}</p>
              <p className="text-[10px] text-slate-500">
                {selected.entries.length} classes across the week
              </p>
            </div>
            {selected.entries.some((entry) => entryIsActive(snapshot, entry, now)) ? (
              <span className="ml-auto rounded-full border border-accent-400/25 bg-accent-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-accent-300">
                In class now
              </span>
            ) : null}
          </div>

          <Stagger className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {selected.entries.map((entry) => {
              const active = entryIsActive(snapshot, entry, now)
              const sectionName = sectionNames.get(entry.sectionKey) ?? entry.sectionKey
              return (
                <StaggerItem
                  key={`${entry.sectionKey}-${entry.dayOfWeek}-${entry.slotIndex}-${entry.cellIndex}`}
                  whileHover={active ? undefined : { y: -2 }}
                  className={
                    active
                      ? 'relative overflow-hidden rounded-2xl border border-accent-400/30 bg-accent-500/[0.08] p-3.5'
                      : 'rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition-colors hover:border-white/[0.12] hover:bg-white/[0.035] hover:shadow-[0_16px_38px_-30px_rgba(15,23,42,0.7)]'
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      <CalendarDays className="size-3" aria-hidden="true" />
                      {DAY_NAMES[entry.dayOfWeek]} - Slot {entry.slotIndex}
                    </p>
                    {active ? (
                      <span className="rounded-full bg-accent-500/20 px-2 py-0.5 text-[9px] font-semibold text-accent-300">
                        NOW
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-100">
                    {entry.subjectCode ? `${entry.subjectCode} ` : ''}
                    {entry.subjectName ?? entry.rawText}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">{sectionName}</p>
                  {entry.roomNames.length > 0 ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-300">
                      <MapPin className="size-3 text-brand-400" aria-hidden="true" />
                      {entry.roomNames.join(', ')}
                    </p>
                  ) : null}
                </StaggerItem>
              )
            })}
          </Stagger>
        </motion.div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-300">Find any teacher's weekly route</p>
          <p className="mt-1 text-xs text-slate-500">
            Search a name to see sections, slots, rooms, and who is in class right now.
          </p>
        </div>
      )}
    </section>
  )
}
