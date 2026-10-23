import { useEffect, useRef } from 'react'
import { Layers3 } from 'lucide-react'
import type { Section } from '../../lib/timetable/types'

interface SectionRailProps {
  sections: Section[]
  activeKey: string
  onSelect: (section: Section) => void
}

const DEPARTMENT_STYLES: Record<string, string> = {
  BSCS: 'bg-brand-400',
  BSIT: 'bg-violet-400',
  BSAI: 'bg-accent-400',
}

function shortLabel(section: Section): string {
  return `${section.departmentCode} S${section.semester}${section.sectionName}`
}

export function SectionRail({ sections, activeKey, onSelect }: SectionRailProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [activeKey])

  if (sections.length === 0) return null

  return (
    <div className="border-t border-white/[0.05] bg-ink-950/35">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          <Layers3 className="size-3.5 text-brand-400/80" aria-hidden="true" />
          Sections
        </span>
        <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5">
          {sections.map((section) => {
            const active = section.key === activeKey
            return (
              <button
                key={section.key}
                ref={active ? activeRef : undefined}
                type="button"
                aria-pressed={active}
                title={section.displayName}
                onClick={() => onSelect(section)}
                className={`group inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                  active
                    ? 'border-brand-400/40 bg-brand-400/10 text-brand-200 shadow-[0_0_24px_-10px_rgba(56,189,248,0.8)]'
                    : 'border-transparent bg-white/[0.03] text-slate-500 hover:border-white/10 hover:bg-white/[0.06] hover:text-slate-300'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full transition-transform duration-200 group-hover:scale-125 ${
                    DEPARTMENT_STYLES[section.departmentCode] ?? 'bg-slate-500'
                  } ${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
                  aria-hidden="true"
                />
                {shortLabel(section)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
