import { motion } from 'framer-motion'
import {
  CalendarDays,
  DoorOpen,
  LayoutDashboard,
  MessageSquareText,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type DashboardTabId =
  | 'overview'
  | 'timetable'
  | 'rooms'
  | 'teachers'
  | 'assistant'
  | 'feedback'

interface DashboardTab {
  id: DashboardTabId
  label: string
  shortLabel?: string
  icon: LucideIcon
}

const TABS: DashboardTab[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'timetable', label: 'Timetable', shortLabel: 'Week', icon: CalendarDays },
  { id: 'rooms', label: 'Free rooms', shortLabel: 'Rooms', icon: DoorOpen },
  { id: 'teachers', label: 'Teachers', icon: Users },
  { id: 'assistant', label: 'Assistant', shortLabel: 'Ask', icon: Sparkles },
  { id: 'feedback', label: 'Feedback', icon: MessageSquareText },
]

interface DashboardTabsProps {
  active: DashboardTabId
  onChange: (tab: DashboardTabId) => void
}

export function DashboardTabs({ active, onChange }: DashboardTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard sections"
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] scrollbar-none"
    >
      {TABS.map((tab) => {
        const selected = active === tab.id
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={`group relative inline-flex min-h-9 items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold transition-colors duration-200 ${
              selected
                ? 'text-white'
                : 'text-slate-400 hover:bg-white/[0.035] hover:text-slate-200'
            }`}
          >
            {selected ? (
              <motion.span
                layoutId="dashboard-tab-pill"
                className="absolute inset-0 rounded-xl border border-brand-400/25 bg-gradient-to-b from-brand-400/20 to-brand-500/10 shadow-[0_0_30px_-12px_rgba(56,189,248,0.8)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            <Icon
              className={`relative size-3.5 transition-transform duration-200 group-hover:scale-110 ${
                selected ? 'text-brand-300' : ''
              }`}
              aria-hidden="true"
            />
            <span className="relative">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function DashboardMobileNav({ active, onChange }: DashboardTabsProps) {
  return (
    <nav
      aria-label="Dashboard sections"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-ink-950/95 backdrop-blur-2xl lg:hidden"
    >
      <div className="mx-auto grid w-full max-w-lg grid-cols-6 gap-0.5 px-2 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map((tab) => {
          const selected = active === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[8px] font-semibold transition-colors duration-200 min-[360px]:text-[9px] ${
                selected
                  ? 'bg-brand-400/10 text-brand-200'
                  : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
              }`}
            >
              {selected ? (
                <span
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand-400"
                  aria-hidden="true"
                />
              ) : null}
              <Icon
                className={`size-4 ${selected ? 'text-brand-300' : ''}`}
                aria-hidden="true"
              />
              <span className="w-full truncate text-center">{tab.shortLabel ?? tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
