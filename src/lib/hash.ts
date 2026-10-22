import type { TimetableSnapshot } from './timetable/types'

export function hashString(input: string): string {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function snapshotContentHash(snapshot: TimetableSnapshot): string {
  const entries = snapshot.entries
    .map(
      (entry) =>
        `${entry.sectionKey}|${entry.dayOfWeek}|${entry.slotIndex}|${entry.cellIndex}|${entry.rawText}`,
    )
    .sort()
    .join('\n')
  return hashString(`${snapshot.term}\n${entries}`)
}
