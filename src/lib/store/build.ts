import {
  sectionSlotKey,
  type Department,
  type FreeSlot,
  type Period,
  type Section,
  type TimetableEntry,
  type TimetableSnapshot,
} from '../timetable/types'

export interface SnapshotParts {
  term: string
  sourceFileName: string
  parsedAt: string
  departments: Department[]
  sections: Section[]
  periods: Period[]
  entries: TimetableEntry[]
}

export function buildSnapshotFromParts(parts: SnapshotParts): TimetableSnapshot {
  const departments = [...parts.departments].sort((a, b) => a.code.localeCompare(b.code))
  const sections = [...parts.sections].sort((a, b) => {
    if (a.departmentCode !== b.departmentCode) {
      return a.departmentCode.localeCompare(b.departmentCode)
    }
    if (a.semester !== b.semester) return a.semester - b.semester
    if (a.sectionName !== b.sectionName) return a.sectionName.localeCompare(b.sectionName)
    return a.batchNumber - b.batchNumber
  })
  const periods = [...parts.periods].sort((a, b) => {
    if (a.departmentCode !== b.departmentCode) {
      return a.departmentCode.localeCompare(b.departmentCode)
    }
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.slotIndex - b.slotIndex
  })
  const entries = [...parts.entries].sort((a, b) => {
    if (a.sectionKey !== b.sectionKey) return a.sectionKey.localeCompare(b.sectionKey)
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex
    return a.cellIndex - b.cellIndex
  })

  const occupied = new Set(
    entries.map((entry) => sectionSlotKey(entry.sectionKey, entry.dayOfWeek, entry.slotIndex)),
  )
  const freeSlots: FreeSlot[] = []
  let slotCells = 0

  for (const section of sections) {
    for (const period of periods) {
      if (period.departmentCode !== section.departmentCode) continue
      slotCells += 1
      if (!occupied.has(sectionSlotKey(section.key, period.dayOfWeek, period.slotIndex))) {
        freeSlots.push({
          sectionKey: section.key,
          dayOfWeek: period.dayOfWeek,
          slotIndex: period.slotIndex,
        })
      }
    }
  }

  return {
    term: parts.term,
    sourceFileName: parts.sourceFileName,
    parsedAt: parts.parsedAt,
    departments,
    sections,
    periods,
    entries,
    freeSlots,
    stats: {
      departments: departments.length,
      sections: sections.length,
      slotCells,
      occupiedCells: occupied.size,
      freeCells: freeSlots.length,
      entries: entries.length,
    },
  }
}
