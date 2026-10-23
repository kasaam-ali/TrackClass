import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { DoorOpen, Users } from 'lucide-react'
import { findFreeRooms } from '../../lib/timetable/engines'
import { CountUp } from '../motion/CountUp'
import {
  DAY_NAMES,
  type DayOfWeek,
  type SlotIndex,
  type TimetableSnapshot,
} from '../../lib/timetable/types'

interface FreeRoomsPanelProps {
  snapshot: TimetableSnapshot
  initialDay: DayOfWeek
  initialSlot: SlotIndex
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5]
const SLOTS: SlotIndex[] = [1, 2]
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export function FreeRoomsPanel({ snapshot, initialDay, initialSlot }: FreeRoomsPanelProps) {
  const [day, setDay] = useState<DayOfWeek>(initialDay)
  const [slot, setSlot] = useState<SlotIndex>(initialSlot)

  const result = useMemo(() => findFreeRooms(snapshot, day, slot), [snapshot, day, slot])
  const usage = Math.round((result.occupiedRooms.length / Math.max(1, result.allRooms.length)) * 100)

  return (
    <section className="glass-panel rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl border border-accent-400/20 bg-accent-500/10">
            <DoorOpen className="size-5 text-accent-300" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-300/80">
              Room intelligence
            </p>
            <h2 className="font-display mt-0.5 text-xl font-semibold text-white">Free rooms</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-display text-2xl font-semibold text-accent-300">
              <CountUp value={result.freeRooms.length} />
            </p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">available</p>
          </div>
          <div className="h-9 w-px bg-white/[0.07]" aria-hidden="true" />
          <div className="text-right">
            <p className="font-display text-2xl font-semibold text-white">
              <CountUp value={result.allRooms.length} />
            </p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">total rooms</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <select
          value={day}
          onChange={(event) => setDay(Number(event.target.value) as DayOfWeek)}
          className="rounded-xl border border-white/[0.08] bg-ink-900/80 px-3 py-2 text-xs font-medium text-slate-300 outline-none transition focus:border-brand-400/50"
          aria-label="Day"
        >
          {DAYS.map((value) => (
            <option key={value} value={value}>
              {DAY_NAMES[value]}
            </option>
          ))}
        </select>
        <div className="flex rounded-xl border border-white/[0.08] bg-ink-900/80 p-0.5">
          {SLOTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSlot(value)}
              aria-pressed={slot === value}
              className={clsx(
                'relative rounded-[10px] px-3.5 py-1.5 text-xs font-semibold transition-colors',
                slot === value ? 'text-white' : 'text-slate-500 hover:text-slate-300',
              )}
            >
              {slot === value ? (
                <motion.span
                  layoutId="rooms-slot-pill"
                  className="absolute inset-0 rounded-[10px] bg-brand-500/90 shadow-[0_0_24px_-10px_rgba(56,189,248,0.9)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
              <span className="relative">Slot {value}</span>
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-slate-500">
          <CountUp value={usage} suffix="%" /> rooms in use
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${day}-${slot}`}
          initial="hidden"
          animate="show"
          exit="exit"
          variants={{
            hidden: { opacity: 0, y: 6 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.24, ease: EASE, staggerChildren: 0.035 },
            },
            exit: { opacity: 0, y: -4, transition: { duration: 0.18, ease: EASE } },
          }}
          className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
        >
          {result.freeRooms.length > 0 ? (
            result.freeRooms.map((room) => (
              <motion.div
                key={room}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  show: { opacity: 1, y: 0 },
                }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.18, ease: EASE }}
                className="group flex items-center gap-2 rounded-xl border border-accent-400/15 bg-accent-500/[0.055] px-3 py-2.5 transition-colors duration-200 hover:border-accent-400/35 hover:bg-accent-500/[0.1] hover:shadow-[0_14px_34px_-24px_rgba(16,185,129,0.65)]"
              >
                <span className="size-1.5 rounded-full bg-accent-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] transition-transform duration-200 group-hover:scale-125" />
                <span className="truncate text-xs font-semibold text-accent-200">{room}</span>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
              <p className="text-xs text-slate-500">No free room in this slot.</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition-colors duration-200 hover:border-white/[0.1] hover:bg-white/[0.03]">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <DoorOpen className="size-3 text-accent-400" aria-hidden="true" />
            {result.freeSections.length} sections without class
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.freeSections.slice(0, 8).map((section) => (
              <span
                key={section.key}
                className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-400"
              >
                {section.displayName.replace(' - ', ' ')}
              </span>
            ))}
            {result.freeSections.length > 8 ? (
              <span className="px-1.5 py-0.5 text-[9px] text-slate-600">
                +{result.freeSections.length - 8} more
              </span>
            ) : null}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition-colors duration-200 hover:border-white/[0.1] hover:bg-white/[0.03]">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <Users className="size-3 text-brand-400" aria-hidden="true" />
            {result.occupiedSections.length} sections in class
          </p>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">
            {result.occupiedSections.slice(0, 6).map((section) => section.displayName).join(', ')}
            {result.occupiedSections.length > 6 ? ' and more' : ''}
          </p>
        </div>
      </div>
    </section>
  )
}
