import clsx from 'clsx'
import { CalendarRange, Loader2 } from 'lucide-react'
import { AmbientBackground } from '../layout/AmbientBackground'

const WIDTHS = [86, 70, 54, 42]

interface LoadingPanelProps {
  label: string
  detail?: string
  rows?: number
  className?: string
}

export function LoadingPanel({
  label,
  detail = 'Fetching the latest published version.',
  rows = 3,
  className,
}: LoadingPanelProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx('glass-panel overflow-hidden rounded-3xl p-5 sm:p-6', className)}
    >
      <div className="flex items-center gap-3">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-2xl border border-brand-400/20 bg-brand-400/10">
          <Loader2 className="size-4 animate-spin text-brand-300" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>
        </div>
      </div>

      {rows > 0 ? (
        <div className="mt-5 space-y-2.5" aria-hidden="true">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="skeleton h-3 rounded-full"
              style={{ width: `${WIDTHS[index % WIDTHS.length]}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function FullPageLoader({ label = 'Preparing TrackClass' }: { label?: string }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-5">
      <AmbientBackground />
      <div className="animate-fade w-full max-w-xs text-center">
        <span className="relative mx-auto grid size-14 place-items-center rounded-[1.15rem] bg-gradient-to-br from-brand-300 via-brand-500 to-accent-500 p-px shadow-glow">
          <span className="grid size-full place-items-center rounded-[1.1rem] bg-ink-950">
            <CalendarRange className="size-6 text-brand-300" aria-hidden="true" />
          </span>
        </span>
        <p className="font-display mt-5 text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-[11px] text-slate-500">Loading the latest timetable</p>
        <div className="skeleton mx-auto mt-4 h-1.5 w-44 rounded-full" aria-hidden="true" />
      </div>
    </div>
  )
}
