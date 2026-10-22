export type DayOfWeek = 1 | 2 | 3 | 4 | 5
export type SlotIndex = 1 | 2

export interface Department {
  code: string
  name: string
}

export interface Section {
  key: string
  departmentCode: string
  semester: number
  sectionName: string
  batchLabel: string
  batchNumber: number
  displayName: string
}

export interface Period {
  departmentCode: string
  dayOfWeek: DayOfWeek
  slotIndex: SlotIndex
  startTime: string
  endTime: string
  label: string
}

export interface TimetableEntry {
  sectionKey: string
  dayOfWeek: DayOfWeek
  slotIndex: SlotIndex
  cellIndex: number
  rawText: string
  subjectCode: string | null
  subjectName: string | null
  teacherName: string | null
  roomNames: string[]
  category: string | null
  credits: string | null
}

export interface FreeSlot {
  sectionKey: string
  dayOfWeek: DayOfWeek
  slotIndex: SlotIndex
}

export interface TimetableStats {
  departments: number
  sections: number
  slotCells: number
  occupiedCells: number
  freeCells: number
  entries: number
}

export interface TimetableSnapshot {
  term: string
  sourceFileName: string
  parsedAt: string
  departments: Department[]
  sections: Section[]
  periods: Period[]
  entries: TimetableEntry[]
  freeSlots: FreeSlot[]
  stats: TimetableStats
}

export const DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
}

export function sectionSlotKey(
  sectionKey: string,
  dayOfWeek: number,
  slotIndex: number,
): string {
  return `${sectionKey}:${dayOfWeek}:${slotIndex}`
}
