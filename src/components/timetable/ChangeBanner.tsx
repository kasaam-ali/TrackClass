import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import type { SnapshotDiff } from '../../lib/timetable/engines'
import { DAY_NAMES } from '../../lib/timetable/types'
import type { TimetableMeta } from '../../lib/store'

interface ChangeBannerProps {
  meta: TimetableMeta
  sectionKey: string
}

function isDiff(value: unknown): value is SnapshotDiff {
  if (!value || typeof value !== 'object') return false
  const diff = value as Partial<SnapshotDiff>
  return Array.isArray(diff.added) && Array.isArray(diff.removed) && Array.isArray(diff.modified)
}

export function ChangeBanner({ meta, sectionKey }: ChangeBannerProps) {
  const dismissKey = `uni-timetable:changes-dismissed:${sectionKey}:${meta.versionNumber}`
  const [dismissedKey, setDismissedKey] = useState(
    () => (localStorage.getItem(dismissKey) === '1' ? dismissKey : ''),
  )
  const dismissed = dismissedKey === dismissKey

  if (dismissed || !isDiff(meta.changes)) return null

  const cells = [
    ...meta.changes.added.map((cell) => ({ ...cell, kind: 'Added' })),
    ...meta.changes.removed.map((cell) => ({ ...cell, kind: 'Removed' })),
    ...meta.changes.modified.map((cell) => ({ ...cell, kind: 'Changed' })),
  ].filter((cell) => cell.sectionKey === sectionKey)

  if (cells.length === 0) return null

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1')
    setDismissedKey(dismissKey)
  }

  return (
    <div className="animate-rise mb-4 rounded-2xl border border-brand-400/20 bg-brand-500/[0.07] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl border border-brand-400/20 bg-brand-400/10">
            <Bell className="size-4 text-brand-300" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {cells.length} timetable change{cells.length === 1 ? '' : 's'} in your section
            </p>
            <ul className="mt-2 space-y-1.5">
              {cells.slice(0, 4).map((cell, index) => (
                <li
                  key={`${cell.kind}-${index}`}
                  className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300"
                >
                  <span className="rounded-md bg-brand-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-300">
                    {cell.kind}
                  </span>
                  <span>
                    {DAY_NAMES[cell.dayOfWeek]} - Slot {cell.slotIndex}
                  </span>
                  <span className="text-slate-500">
                    {cell.before || 'Free'} -&gt; {cell.after || 'Free'}
                  </span>
                </li>
              ))}
              {cells.length > 4 ? (
                <li className="text-[10px] text-slate-500">+{cells.length - 4} more changes</li>
              ) : null}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss changes"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
