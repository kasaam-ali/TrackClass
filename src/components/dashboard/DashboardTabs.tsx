import { motion } from 'framer-motion'
import {
  CalendarDays,
  DoorOpen,
  LayoutDashboard,
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

interface DashboardTab {
  id: DashboardTabId
  label: string
  icon: LucideIcon
}

const TABS: DashboardTab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'timetable', label: 'Timetable', icon: CalendarDays },
  { id: 'rooms', label: 'Free rooms', icon: DoorOpen },
  { id: 'teachers', label: 'Teachers', icon: Users },
  { id: 'assistant', label: 'Assistant', icon: Sparkles },
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
      className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
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
