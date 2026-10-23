import { motion } from 'framer-motion'
import { toZonedTime } from 'date-fns-tz'
import {
  ArrowRight,
  CalendarCheck2,
  Clock3,
  DoorOpen,
  MapPin,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import {
  TIME_ZONE,
  findFreeRooms,
  getScheduleState,
} from '../../lib/timetable/engines'
import {
  DAY_NAMES,
  type DayOfWeek,
  type Section,
  type SlotIndex,
  type TimetableEntry,
  type TimetableSnapshot,
} from '../../lib/timetable/types'
import type { TimetableMeta } from '../../lib/store'
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal'
import { SectionStatus } from '../timetable/SectionStatus'
import type { DashboardTabId } from './DashboardTabs'

interface OverviewPanelProps {
  snapshot: TimetableSnapshot
  section: Section
  meta: TimetableMeta | null
  now: Date
  onTab: (tab: DashboardTabId) => void
}

function minutesOf(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function focusDay(now: Date): { day: DayOfWeek; today: boolean } {
  const zoned = toZonedTime(now, TIME_ZONE)
  const jsDay = zoned.getDay()
  return {
    day: jsDay >= 1 && jsDay <= 5 ? (jsDay as DayOfWeek) : 1,
    today: jsDay >= 1 && jsDay <= 5,
  }
}

function focusSlot(snapshot: TimetableSnapshot, departmentCode: string, day: DayOfWeek, now: Date): SlotIndex {
  const zoned = toZonedTime(now, TIME_ZONE)
  if (!(zoned.getDay() >= 1 && zoned.getDay() <= 5)) return 1
  const minutes = zoned.getHours() * 60 + zoned.getMinutes()
  const periods = snapshot.periods
    .filter((period) => period.departmentCode === departmentCode && period.dayOfWeek === day)
    .sort((a, b) => a.slotIndex - b.slotIndex)
  const current = periods.find(
    (period) => minutes >= minutesOf(period.startTime) && minutes < minutesOf(period.endTime),
  )
  if (current) return current.slotIndex
  return periods.find((period) => minutes < minutesOf(period.startTime))?.slotIndex ?? 1
}

function shortMinutes(minutes: number | null): string {
  if (minutes === null) return 'Now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function updatedLabel(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function entryLine(entry: TimetableEntry): string {
  return entry.subjectCode ? `${entry.subjectCode} ${entry.subjectName ?? ''}`.trim() : entry.rawText
}

export function OverviewPanel({ snapshot, section, meta, now, onTab }: OverviewPanelProps) {
  const focus = focusDay(now)
  const slot = focusSlot(snapshot, section.departmentCode, focus.day, now)
  const department = snapshot.departments.find((item) => item.code === section.departmentCode)
  const sectionEntries = snapshot.entries.filter((entry) => entry.sectionKey === section.key)
  const periods = snapshot.periods
    .filter(
      (period) =>
        period.departmentCode === section.departmentCode && period.dayOfWeek === focus.day,
    )
    .sort((a, b) => a.slotIndex - b.slotIndex)
  const dayEntries = new Map<number, TimetableEntry[]>()
  sectionEntries
    .filter((entry) => entry.dayOfWeek === focus.day)
    .forEach((entry) => {
      const current = dayEntries.get(entry.slotIndex) ?? []
      dayEntries.set(entry.slotIndex, [...current, entry])
    })
  const classSlots = periods.filter((period) => (dayEntries.get(period.slotIndex) ?? []).length > 0)
  const rooms = findFreeRooms(snapshot, focus.day, slot)
  const teachers = new Set(
    sectionEntries.map((entry) => entry.teacherName).filter((name): name is string => Boolean(name)),
  )
  const state = getScheduleState(snapshot, section.key, now)
  const updated = updatedLabel(meta?.updatedAt)

  const stats = [
    {
      label: focus.today ? 'Classes today' : `Classes ${DAY_NAMES[focus.day]}`,
      value: String(classSlots.length),
      hint: `${periods.length} slots scheduled`,
      icon: CalendarCheck2,
      tone: 'text-brand-300',
    },
    {
      label: 'Free rooms now',
      value: String(rooms.freeRooms.length),
      hint: `${DAY_NAMES[focus.day]} - slot ${slot}`,
      icon: DoorOpen,
      tone: 'text-accent-300',
    },
    {
      label: state.currentPeriod ? 'Class in progress' : 'Next class',
      value: state.currentPeriod
        ? 'Now'
        : state.nextPeriod
          ? shortMinutes(state.minutesUntilNext)
          : 'None',
      hint: state.currentPeriod?.label ?? state.nextPeriod?.label ?? 'No upcoming slot',
      icon: Clock3,
      tone: 'text-amber-300',
    },
    {
      label: 'Teachers',
      value: String(teachers.size),
      hint: 'Across your section',
      icon: Users,
      tone: 'text-violet-300',
    },
  ]

  return (
    <div className="space-y-5">
      <Reveal>
        <section className="glass-panel-strong relative overflow-hidden rounded-[2rem] p-5 sm:p-7">
        <div
          className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-brand-500/15 blur-[90px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute bottom-[-8rem] left-1/3 size-64 rounded-full bg-accent-500/10 blur-[90px]"
          aria-hidden="true"
        />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.9fr] lg:items-stretch">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-300/80">
                <span className="size-1.5 rounded-full bg-brand-400" aria-hidden="true" />
                Your section
              </p>
              <h1 className="font-display mt-3 text-3xl font-semibold leading-tight text-white sm:text-4xl">
                {section.displayName.replace(' - ', ' ')}
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                {department?.name ?? section.departmentCode} - {meta?.term ?? snapshot.term}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium">
              <span className="rounded-full border border-brand-400/20 bg-brand-400/10 px-2.5 py-1 text-brand-200">
                {section.batchLabel}
              </span>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-slate-400">
                Version {meta?.versionNumber ?? 1}
              </span>
              {updated ? (
                <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-slate-400">
                  Updated {updated}
                </span>
              ) : null}
            </div>
          </div>
          <SectionStatus snapshot={snapshot} sectionKey={section.key} now={now} />
        </div>
        </section>
      </Reveal>

      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <StaggerItem
              key={stat.label}
              whileHover={{ y: -3, scale: 1.004 }}
              className="glass-panel card-lift rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {stat.label}
                </p>
                <Icon className={`size-4 ${stat.tone}`} aria-hidden="true" />
              </div>
              <p className="font-display mt-3 text-2xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-[10px] text-slate-500">{stat.hint}</p>
            </StaggerItem>
          )
        })}
      </Stagger>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
        <Reveal className="min-w-0">
          <section className="glass-panel h-full rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {focus.today ? 'Today' : DAY_NAMES[focus.day]}
              </p>
              <h2 className="font-display mt-1 text-lg font-semibold text-white">Your flow</h2>
            </div>
            <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-400">
              {classSlots.length} of {periods.length} slots busy
            </span>
          </div>

          <div className="mt-5 space-y-2">
            {periods.length > 0 ? (
              periods.map((period, index) => {
                const entries = dayEntries.get(period.slotIndex) ?? []
                const isNow =
                  focus.today &&
                  state.currentPeriod?.slotIndex === period.slotIndex &&
                  state.currentPeriod?.dayOfWeek === focus.day
                return (
                  <motion.div
                    key={period.slotIndex}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.35,
                      delay: 0.12 + index * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`grid grid-cols-[74px_1fr] gap-3 rounded-2xl border p-3 ${
                      isNow
                        ? 'border-accent-400/25 bg-accent-500/[0.07]'
                        : 'border-white/[0.05] bg-white/[0.02]'
                    }`}
                  >
                    <div className="border-r border-white/[0.06] pr-3">
                      <p className="font-display text-sm font-semibold text-white">
                        {period.startTime}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{period.endTime}</p>
                      {isNow ? (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent-300">
                          Now
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      {entries.length > 0 ? (
                        entries.map((entry) => (
                          <div key={`${entry.cellIndex}-${entry.rawText}`} className="space-y-1">
                            <p className="truncate text-xs font-semibold text-slate-100">
                              {entryLine(entry)}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                              {entry.teacherName ? (
                                <span className="inline-flex items-center gap-1">
                                  <UserRound className="size-3" aria-hidden="true" />
                                  {entry.teacherName}
                                </span>
                              ) : null}
                              {entry.roomNames.length > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3" aria-hidden="true" />
                                  {entry.roomNames.join(', ')}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex h-full items-center">
                          <p className="text-xs text-slate-500">Free slot - use it to catch up.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })
            ) : (
              <p className="rounded-2xl border border-dashed border-white/[0.08] p-4 text-xs text-slate-500">
                No periods are scheduled for this day.
              </p>
            )}
            </div>
          </section>
        </Reveal>

        <div className="space-y-4">
          <Reveal delay={0.06}>
            <section className="glass-panel card-lift relative overflow-hidden rounded-3xl p-5">
            <div
              className="pointer-events-none absolute -right-16 -top-20 size-44 rounded-full bg-accent-500/10 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-300/80">
                    Free right now
                  </p>
                  <h2 className="font-display mt-1 text-lg font-semibold text-white">Rooms</h2>
                </div>
                <DoorOpen className="size-5 text-accent-400" aria-hidden="true" />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {rooms.freeRooms.length} of {rooms.allRooms.length} rooms are free in{' '}
                {DAY_NAMES[focus.day]} slot {slot}.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {rooms.freeRooms.slice(0, 8).map((room) => (
                  <span
                    key={room}
                    className="rounded-lg border border-accent-400/20 bg-accent-500/10 px-2 py-1 text-[10px] font-semibold text-accent-300"
                  >
                    {room}
                  </span>
                ))}
                {rooms.freeRooms.length === 0 ? (
                  <span className="text-[11px] text-slate-500">No free room in this slot.</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onTab('rooms')}
                className="group mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-300 transition hover:text-brand-200"
              >
                Explore all rooms
                <ArrowRight
                  className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </div>
            </section>
          </Reveal>

          <Reveal delay={0.12}>
            <section className="glass-panel card-lift relative overflow-hidden rounded-3xl p-5">
            <div
              className="pointer-events-none absolute -bottom-20 -right-10 size-44 rounded-full bg-violet-500/15 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <span className="grid size-9 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10">
                <Sparkles className="size-4 text-violet-300" aria-hidden="true" />
              </span>
              <h2 className="font-display mt-3 text-lg font-semibold text-white">
                Ask the timetable
              </h2>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Free rooms, next class, ya teacher ki location Roman Urdu mein pooch lein.
              </p>
              <button
                type="button"
                onClick={() => onTab('assistant')}
                className="group mt-4 inline-flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[11px] font-semibold text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-500/15"
              >
                Open assistant
                <ArrowRight
                  className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </div>
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
