import type { ReactNode } from 'react'
import { CalendarRange } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

interface SiteHeaderProps {
  center?: ReactNode
  actions?: ReactNode
  below?: ReactNode
}

export function SiteHeader({ center, actions, below }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-3">
          <span className="relative grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-brand-300 via-brand-500 to-accent-500 p-[1px] shadow-glow">
            <span className="grid size-full place-items-center rounded-[15px] bg-ink-950">
              <CalendarRange
                className="size-5 text-brand-300 transition-transform duration-300 group-hover:scale-110"
                aria-hidden="true"
              />
            </span>
          </span>
          <span className="leading-tight">
            <span className="font-display block text-sm font-semibold text-white">
              TrackClass
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              Fall 2026
            </span>
          </span>
        </Link>

        {center ? (
          <div className="scrollbar-none order-3 w-full overflow-x-auto pb-1 lg:order-none lg:w-auto lg:flex-1 lg:justify-center lg:overflow-visible lg:pb-0">
            <div className="flex min-w-max justify-center lg:min-w-0">{center}</div>
          </div>
        ) : (
          <div className="hidden flex-1 lg:block" />
        )}

        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          <ThemeToggle />
          {actions}
        </div>
      </div>
      {below}
    </header>
  )
}
