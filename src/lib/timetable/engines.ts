import { toZonedTime } from 'date-fns-tz'
import { normalizeRoomName, normalizeTeacherName } from './normalize'
import {
  DAY_NAMES,
  sectionSlotKey,
  type DayOfWeek,
  type FreeSlot,
  type Period,
  type Section,
  type SlotIndex,
  type TimetableEntry,
  type TimetableSnapshot,
} from './types'

export const TIME_ZONE = 'Asia/Karachi'

export interface SectionGridSlot {
  period: Period
  entries: TimetableEntry[]
  isFree: boolean
}

export interface FreeRoomsResult {
  dayOfWeek: DayOfWeek
  slotIndex: SlotIndex
  allRooms: string[]
  occupiedRooms: string[]
  freeRooms: string[]
  freeSections: Section[]
  occupiedSections: Section[]
  entries: TimetableEntry[]
}

export interface TeacherIndexEntry {
  key: string
  displayName: string
  entries: TimetableEntry[]
}

export interface ScheduleState {
  currentPeriod: Period | null
  currentEntries: TimetableEntry[]
  nextPeriod: Period | null
  nextDayOfWeek: DayOfWeek | null
  nextEntries: TimetableEntry[]
  minutesUntilNext: number | null
  isFreeNow: boolean
}

export interface DiffCell {
  sectionKey: string
  sectionName: string
  dayOfWeek: DayOfWeek
  slotIndex: SlotIndex
  before: string
  after: string
}

export interface SnapshotDiff {
  added: DiffCell[]
  removed: DiffCell[]
  modified: DiffCell[]
  changedCount: number
}

const TEACHER_ALIASES: Record<string, string> = {
  'SHER MOHAMMAD': 'SHER MUHAMMAD',
  'NADIA HASEEN UDDIN': 'NADIA HASSEN UDDIN',
  'SAAD AHMED MR': 'SAAD AHMED',
}

function roomSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function teacherDisplayScore(name: string): number {
  const hasTitle = /^(?:Mr|Mrs|Ms|Dr|Prof)\./i.test(name) ? 100 : 0
  return hasTitle + name.length
}

function resolveTeacherKey(key: string, allKeys: Set<string>): string {
  const aliased = TEACHER_ALIASES[key] ?? key
  if (aliased !== key && allKeys.has(aliased)) return aliased

  const candidates = [...allKeys]
    .filter((candidate) => candidate !== aliased && candidate.startsWith(`${aliased} `))
    .sort((a, b) => a.length - b.length)

  return candidates[0] ?? aliased
}

export function getAllRooms(snapshot: TimetableSnapshot): string[] {
  const rooms = new Map<string, string>()
  for (const entry of snapshot.entries) {
    for (const room of entry.roomNames) {
      const key = normalizeRoomName(room)
      if (!rooms.has(key)) rooms.set(key, room)
    }
  }
  return [...rooms.values()].sort(roomSort)
}

export function getSectionByKey(
  snapshot: TimetableSnapshot,
  sectionKey: string,
): Section | undefined {
  return snapshot.sections.find((section) => section.key === sectionKey)
}

export function getSectionEntries(
  snapshot: TimetableSnapshot,
  sectionKey: string,
): TimetableEntry[] {
  return snapshot.entries.filter((entry) => entry.sectionKey === sectionKey)
}

export function getSectionFreeSlots(
  snapshot: TimetableSnapshot,
  sectionKey: string,
): FreeSlot[] {
  return snapshot.freeSlots.filter((slot) => slot.sectionKey === sectionKey)
}

export function getSectionGrid(
  snapshot: TimetableSnapshot,
  sectionKey: string,
): SectionGridSlot[] {
  const section = getSectionByKey(snapshot, sectionKey)
  if (!section) return []

  const periods = snapshot.periods
    .filter((period) => period.departmentCode === section.departmentCode)
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      return a.slotIndex - b.slotIndex
    })

  return periods.map((period) => {
    const entries = snapshot.entries.filter(
      (entry) =>
        entry.sectionKey === sectionKey &&
        entry.dayOfWeek === period.dayOfWeek &&
        entry.slotIndex === period.slotIndex,
    )
    return { period, entries, isFree: entries.length === 0 }
  })
}

export function findFreeRooms(
  snapshot: TimetableSnapshot,
  dayOfWeek: DayOfWeek,
  slotIndex: SlotIndex,
): FreeRoomsResult {
  const allRooms = getAllRooms(snapshot)
  const entries = snapshot.entries.filter(
    (entry) => entry.dayOfWeek === dayOfWeek && entry.slotIndex === slotIndex,
  )

  const occupiedByKey = new Map<string, string>()
  for (const entry of entries) {
    for (const room of entry.roomNames) {
      occupiedByKey.set(normalizeRoomName(room), room)
    }
  }

  const occupiedSections = snapshot.sections.filter((section) =>
    entries.some((entry) => entry.sectionKey === section.key),
  )
  const occupiedSectionKeys = new Set(occupiedSections.map((section) => section.key))
  const freeSections = snapshot.sections.filter(
    (section) => !occupiedSectionKeys.has(section.key),
  )

  return {
    dayOfWeek,
    slotIndex,
    allRooms,
    occupiedRooms: [...occupiedByKey.values()].sort(roomSort),
    freeRooms: allRooms.filter((room) => !occupiedByKey.has(normalizeRoomName(room))),
    freeSections,
    occupiedSections,
    entries,
  }
}

export function buildTeacherIndex(snapshot: TimetableSnapshot): TeacherIndexEntry[] {
  const raw = new Map<string, { displayName: string; entries: TimetableEntry[] }>()

  for (const entry of snapshot.entries) {
    if (!entry.teacherName) continue
    const key = normalizeTeacherName(entry.teacherName)
    if (!key) continue
    const current = raw.get(key)
    if (current) {
      current.entries.push(entry)
      if (teacherDisplayScore(entry.teacherName) > teacherDisplayScore(current.displayName)) {
        current.displayName = entry.teacherName
      }
    } else {
      raw.set(key, { displayName: entry.teacherName, entries: [entry] })
    }
  }

  const allKeys = new Set(raw.keys())
  const merged = new Map<string, TeacherIndexEntry>()

  for (const [key, value] of raw) {
    const canonicalKey = resolveTeacherKey(key, allKeys)
    const existing = merged.get(canonicalKey)
    if (existing) {
      existing.entries.push(...value.entries)
      if (teacherDisplayScore(value.displayName) > teacherDisplayScore(existing.displayName)) {
        existing.displayName = value.displayName
      }
    } else {
      merged.set(canonicalKey, {
        key: canonicalKey,
        displayName: value.displayName,
        entries: [...value.entries],
      })
    }
  }

  for (const teacher of merged.values()) {
    teacher.entries.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex
      return a.sectionKey.localeCompare(b.sectionKey)
    })
  }

  return [...merged.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function findTeachers(
  snapshot: TimetableSnapshot,
  query: string,
): TeacherIndexEntry[] {
  const normalizedQuery = normalizeTeacherName(query)
  if (!normalizedQuery) return []

  return buildTeacherIndex(snapshot).filter((teacher) => {
    return (
      teacher.key.includes(normalizedQuery) ||
      normalizedQuery.includes(teacher.key) ||
      teacher.displayName.toLowerCase().includes(query.toLowerCase())
    )
  })
}

export function getTeacherEntries(
  snapshot: TimetableSnapshot,
  teacherKey: string,
): TimetableEntry[] {
  return (
    buildTeacherIndex(snapshot).find((teacher) => teacher.key === teacherKey)?.entries ?? []
  )
}

function parseZonedMinutes(now: Date): {
  dayOfWeek: DayOfWeek | null
  jsDay: number
  minutes: number
} {
  const zoned = toZonedTime(now, TIME_ZONE)
  const jsDay = zoned.getDay()
  const dayOfWeek = jsDay >= 1 && jsDay <= 5 ? (jsDay as DayOfWeek) : null
  return { dayOfWeek, jsDay, minutes: zoned.getHours() * 60 + zoned.getMinutes() }
}

function periodMinutes(period: Period): { start: number; end: number } {
  const [startHour, startMinute] = period.startTime.split(':').map(Number)
  const [endHour, endMinute] = period.endTime.split(':').map(Number)
  return { start: startHour * 60 + startMinute, end: endHour * 60 + endMinute }
}

export function getScheduleState(
  snapshot: TimetableSnapshot,
  sectionKey: string,
  now = new Date(),
): ScheduleState {
  const section = getSectionByKey(snapshot, sectionKey)
  if (!section) {
    return {
      currentPeriod: null,
      currentEntries: [],
      nextPeriod: null,
      nextDayOfWeek: null,
      nextEntries: [],
      minutesUntilNext: null,
      isFreeNow: false,
    }
  }

  const periods = snapshot.periods
    .filter((period) => period.departmentCode === section.departmentCode)
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      return a.slotIndex - b.slotIndex
    })

  const { dayOfWeek, jsDay, minutes } = parseZonedMinutes(now)

  const entriesFor = (period: Period | null): TimetableEntry[] => {
    if (!period) return []
    return snapshot.entries.filter(
      (entry) =>
        entry.sectionKey === sectionKey &&
        entry.dayOfWeek === period.dayOfWeek &&
        entry.slotIndex === period.slotIndex,
    )
  }

  let currentPeriod: Period | null = null
  let nextPeriod: Period | null = null
  let nextDayOfWeek: DayOfWeek | null = null
  let minutesUntilNext: number | null = null

  if (dayOfWeek !== null) {
    for (const period of periods.filter((item) => item.dayOfWeek === dayOfWeek)) {
      const { start, end } = periodMinutes(period)
      if (minutes >= start && minutes < end) {
        currentPeriod = period
      }
      if (minutes < start) {
        nextPeriod = period
        nextDayOfWeek = dayOfWeek
        minutesUntilNext = start - minutes
        break
      }
    }
  }

  if (!nextPeriod) {
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidateDay = (jsDay + offset) % 7
      if (candidateDay < 1 || candidateDay > 5) continue
      const candidate = periods.find((period) => period.dayOfWeek === candidateDay)
      if (!candidate) continue
      const { start } = periodMinutes(candidate)
      nextPeriod = candidate
      nextDayOfWeek = candidate.dayOfWeek
      minutesUntilNext = (24 * 60 - minutes) + (offset - 1) * 24 * 60 + start
      break
    }
  }

  return {
    currentPeriod,
    currentEntries: entriesFor(currentPeriod),
    nextPeriod,
    nextDayOfWeek,
    nextEntries: entriesFor(nextPeriod),
    minutesUntilNext,
    isFreeNow: Boolean(currentPeriod) && entriesFor(currentPeriod).length === 0,
  }
}

function cellSignatures(snapshot: TimetableSnapshot): Map<string, string> {
  const grouped = new Map<string, TimetableEntry[]>()

  for (const entry of snapshot.entries) {
    const key = sectionSlotKey(entry.sectionKey, entry.dayOfWeek, entry.slotIndex)
    const list = grouped.get(key)
    if (list) list.push(entry)
    else grouped.set(key, [entry])
  }

  const signatures = new Map<string, string>()
  for (const [key, entries] of grouped) {
    const signature = entries
      .sort((a, b) => a.cellIndex - b.cellIndex)
      .map((entry) => entry.rawText)
      .join(' || ')
    signatures.set(key, signature)
  }
  return signatures
}

function cellsBySectionDaySlot(
  snapshot: TimetableSnapshot,
): Map<string, { dayOfWeek: DayOfWeek; slotIndex: SlotIndex; sectionKey: string }> {
  const cells = new Map<string, { dayOfWeek: DayOfWeek; slotIndex: SlotIndex; sectionKey: string }>()
  for (const entry of snapshot.entries) {
    const key = sectionSlotKey(entry.sectionKey, entry.dayOfWeek, entry.slotIndex)
    if (!cells.has(key)) {
      cells.set(key, {
        dayOfWeek: entry.dayOfWeek,
        slotIndex: entry.slotIndex,
        sectionKey: entry.sectionKey,
      })
    }
  }
  return cells
}

export function diffSnapshots(
  previous: TimetableSnapshot | null,
  next: TimetableSnapshot,
): SnapshotDiff {
  const added: DiffCell[] = []
  const removed: DiffCell[] = []
  const modified: DiffCell[] = []

  const previousSignatures = previous ? cellSignatures(previous) : new Map<string, string>()
  const nextSignatures = cellSignatures(next)
  const cells = cellsBySectionDaySlot(next)
  if (previous) {
    for (const [key, value] of cellsBySectionDaySlot(previous)) {
      if (!cells.has(key)) cells.set(key, value)
    }
  }

  const sectionNames = new Map<string, string>()
  for (const section of [...(previous?.sections ?? []), ...next.sections]) {
    sectionNames.set(section.key, section.displayName)
  }

  for (const [key, cell] of cells) {
    const before = previousSignatures.get(key) ?? ''
    const after = nextSignatures.get(key) ?? ''
    if (before === after) continue

    const diffCell: DiffCell = {
      sectionKey: cell.sectionKey,
      sectionName: sectionNames.get(cell.sectionKey) ?? cell.sectionKey,
      dayOfWeek: cell.dayOfWeek,
      slotIndex: cell.slotIndex,
      before,
      after,
    }

    if (!before && after) added.push(diffCell)
    else if (before && !after) removed.push(diffCell)
    else modified.push(diffCell)
  }

  const sortCells = (a: DiffCell, b: DiffCell): number => {
    if (a.sectionKey !== b.sectionKey) return a.sectionKey.localeCompare(b.sectionKey)
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.slotIndex - b.slotIndex
  }

  added.sort(sortCells)
  removed.sort(sortCells)
  modified.sort(sortCells)

  return {
    added,
    removed,
    modified,
    changedCount: added.length + removed.length + modified.length,
  }
}

export function describeCell(dayOfWeek: DayOfWeek, slotIndex: SlotIndex): string {
  return `${DAY_NAMES[dayOfWeek]} Slot ${slotIndex}`
}
