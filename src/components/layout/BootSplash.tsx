import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarRange, Check } from 'lucide-react'

const DURATION = 1450
const STEPS = [
  'Reading the timetable',
  'Mapping sections and rooms',
  'Checking your next class',
  'Ready',
]
const CELLS = [0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0]
const CELL_TONES = [
  'bg-white/[0.055]',
  'bg-brand-500/25',
  'bg-accent-500/20',
]

export function BootSplash() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const next = Math.min(100, Math.round(((now - start) / DURATION) * 100))
      setProgress(next)
      if (next < 100) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const stepIndex = Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length))

  return (
    <motion.div
      key="boot-splash"
      role="status"
      aria-live="polite"
      aria-label="Loading TrackClass"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[120] grid place-items-center overflow-hidden bg-ink-950 px-5"
    >
      <div className="aurora-one pointer-events-none absolute -left-40 top-0 size-[34rem] rounded-full bg-brand-500/15 blur-[120px]" />
      <div className="aurora-two pointer-events-none absolute -right-44 bottom-0 size-[30rem] rounded-full bg-accent-500/15 blur-[120px]" />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="ambient-vignette pointer-events-none absolute inset-0" />

      <div className="relative w-full max-w-sm text-center">
        <div className="relative mx-auto grid size-20 place-items-center">
          <motion.span
            aria-hidden="true"
            className="absolute inset-0 rounded-[1.6rem] border border-brand-400/35"
            animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.span
            initial={{ opacity: 0, scale: 0.72, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative grid size-16 place-items-center rounded-[1.4rem] bg-gradient-to-br from-brand-300 via-brand-500 to-accent-500 p-[1.5px] shadow-glow"
          >
            <span className="grid size-full place-items-center rounded-[1.2rem] bg-ink-950">
              <CalendarRange className="size-7 text-brand-300" aria-hidden="true" />
            </span>
          </motion.span>
        </div>

        <h1 className="font-display mt-7 text-3xl font-semibold tracking-tight text-white">
          {Array.from('TrackClass').map((letter, index) => (
            <motion.span
              key={`${letter}-${index}`}
              className="inline-block"
              initial={{ opacity: 0, y: 12, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.34,
                delay: 0.16 + index * 0.035,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {letter}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="mt-2 text-sm text-slate-400"
        >
          Your timetable, ready in a moment.
        </motion.p>

        <div className="mt-8 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.04] p-[2px]">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-brand-400 via-brand-300 to-accent-400 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-6 grid grid-cols-5 gap-1.5" aria-hidden="true">
          {CELLS.map((tone, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, scaleY: 0.35 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{
                duration: 0.35,
                delay: 0.25 + (index % 5) * 0.045 + Math.floor(index / 5) * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`h-6 rounded-md ${CELL_TONES[tone]}`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 text-left">
          <motion.span
            key={stepIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"
          >
            {progress >= 100 ? (
              <Check className="size-3 text-accent-400" aria-hidden="true" />
            ) : (
              <span className="size-1.5 rounded-full bg-brand-400" aria-hidden="true" />
            )}
            {STEPS[stepIndex]}
          </motion.span>
          <span className="font-display text-[11px] font-semibold text-slate-400">
            {progress}%
          </span>
        </div>
      </div>

      <p className="absolute bottom-6 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-600">
        TrackClass - Fall 2026
      </p>
    </motion.div>
  )
}
