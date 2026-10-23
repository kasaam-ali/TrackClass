import clsx from 'clsx'
import { Clock3, MapPin, UserRound } from 'lucide-react'
import { getSectionGrid, type SectionGridSlot } from '../../lib/timetable/engines'
import {
  DAY_NAMES,
  type DayOfWeek,
  type TimetableSnapshot,
} from '../../lib/timetable/types'

interface WeeklyGridProps {
  snapshot: TimetableSnapshot
  sectionKey: string
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5]

function SlotCard({ slot, isFree }: { slot: SectionGridSlot; isFree: boolean }) {
  const { period, entries } = slot
  return (
    <div
      className={clsx(
        'group relative h-full overflow-hidden rounded-2xl border p-3 transition-all duration-300',
        isFree
          ? 'border-dashed border-accent-400/20 bg-accent-500/[0.035]'
          : 'border-white/[0.07] bg-gradient-to-br from-white/[0.045] to-white/[0.015] hover:-translate-y-0.5 hover:scale-[1.003] hover:border-brand-400/25 hover:shadow-[0_18px_50px_-30px_rgba(56,189,248,0.55)]',
      )}
    >
      {!isFree ? (
        <span
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-400/50 to-transparent opacity-60"
          aria-hidden="true"
        />
      ) : null}

      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        <Clock3 className="size-3" aria-hidden="true" />
        {period.startTime} - {period.endTime}
      </p>

      {isFree ? (
        <div className="mt-3 flex min-h-16 flex-col justify-center">
          <p className="text-[11px] font-semibold text-accent-300/80">FREE</p>
          <p className="mt-0.5 text-[10px] text-slate-600">No class scheduled</p>
        </div>
      ) : (
        <div className="mt-2.5 space-y-3">
          {entries.map((entry, index) => (
            <div
              key={`${entry.cellIndex}-${entry.rawText}`}
              className={clsx(
                'space-y-1.5',
                index > 0 ? 'border-t border-white/[0.06] pt-2.5' : '',
              )}
            >
              {entry.subjectCode ? (
                <span className="inline-flex rounded-md border border-brand-400/15 bg-brand-400/[0.08] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-300">
                  {entry.subjectCode}
                </span>
              ) : null}
              <p className="text-xs font-semibold leading-5 text-slate-100">
                {entry.subjectName ?? entry.rawText}
              </p>
              {entry.teacherName ? (
                <p className="flex items-start gap-1.5 text-[10px] leading-4 text-slate-400">
                  <UserRound
                    className="mt-0.5 size-3 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <span className="truncate">{entry.teacherName}</span>
                </p>
              ) : null}
              {entry.roomNames.length > 0 ? (
                <p className="flex items-start gap-1.5 text-[10px] leading-4 text-slate-400">
                  <MapPin className="mt-0.5 size-3 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="truncate">{entry.roomNames.join(', ')}</span>
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function WeeklyGrid({ snapshot, sectionKey }: WeeklyGridProps) {
  const grid = getSectionGrid(snapshot, sectionKey)
  const slotIndices = [...new Set(grid.map((slot) => slot.period.slotIndex))].sort(
    (a, b) => a - b,
  )

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[900px] grid-cols-5 gap-3">
        {DAYS.map((day) => {
          const slots = grid.filter((slot) => slot.period.dayOfWeek === day)
          const busy = slots.filter((slot) => !slot.isFree).length
          return (
            <div
              key={day}
              className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2"
            >
              <p className="text-xs font-semibold text-white">{DAY_NAMES[day]}</p>
              <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                {busy}/{slots.length}
              </span>
            </div>
          )
        })}

        {slotIndices.flatMap((slotIndex) =>
          DAYS.map((day) => {
            const slot = grid.find(
              (item) =>
                item.period.dayOfWeek === day && item.period.slotIndex === slotIndex,
            )
            if (!slot) {
              return (
                <div
                  key={`${day}-${slotIndex}`}
                  className="rounded-2xl border border-dashed border-white/[0.05]"
                />
              )
            }
            return (
              <SlotCard
                key={`${day}-${slotIndex}`}
                slot={slot}
                isFree={slot.isFree}
              />
            )
          }),
        )}
      </div>
    </div>
  )
}
