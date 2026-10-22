import * as XLSX from 'xlsx'
import { extractCellCourses } from './entities'
import { parseTimeRange, formatSlotLabel } from './time'
import {
  DAY_NAMES,
  sectionSlotKey,
  type DayOfWeek,
  type Department,
  type FreeSlot,
  type Period,
  type Section,
  type SlotIndex,
  type TimetableEntry,
  type TimetableSnapshot,
} from './types'

interface DayColumn {
  dayOfWeek: DayOfWeek
  startColumn: number
  span: number
}

interface ColumnSlot {
  dayOfWeek: DayOfWeek
  slotIndex: SlotIndex
  column: number
  startTime: string
  endTime: string
}

const DEPARTMENT_PATTERN = /^Semesters?\s+(BSCS|BSIT|BSAI)\b/i
const DEPARTMENT_NAMES: Record<string, string> = {
  BSCS: 'BS Computer Science',
  BSIT: 'BS Information Technology',
  BSAI: 'BS Artificial Intelligence',
}
const SECTION_PATTERN =
  /BATCH\s*[-\s]*(\d+)\s*(?:ST|ND|RD|TH)?\s+SEMESTER\s+(\d+)\s*(?:ST|ND|RD|TH)?\s*\(\s*SECTION\s*[-\s]*([A-Z])\s*\)/i
const DAY_LOOKUP: Record<string, DayOfWeek> = {
  MONDAY: 1,
  MON: 1,
  TUESDAY: 2,
  TUE: 2,
  TUES: 2,
  WEDNESDAY: 3,
  WED: 3,
  THURSDAY: 4,
  THU: 4,
  THUR: 4,
  FRIDAY: 5,
  FRI: 5,
}

function cellText(row: unknown[] | undefined, column: number): string {
  const value = row?.[column]
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function parseDepartment(value: string): Department | null {
  const match = value.match(DEPARTMENT_PATTERN)
  if (!match) return null
  const code = match[1].toUpperCase()
  return { code, name: DEPARTMENT_NAMES[code] ?? code }
}

function parseDay(value: string): DayOfWeek | null {
  const key = value.toUpperCase().replace(/[^A-Z]/g, '')
  return DAY_LOOKUP[key] ?? null
}

function parseSection(value: string, departmentCode: string): Section | null {
  const match = value.match(SECTION_PATTERN)
  if (!match) return null

  const batchNumber = Number(match[1])
  const semester = Number(match[2])
  const sectionName = match[3].toUpperCase()

  return {
    key: `${departmentCode}-S${semester}-${sectionName}-B${batchNumber}`,
    departmentCode,
    semester,
    sectionName,
    batchLabel: `Batch ${batchNumber}`,
    batchNumber,
    displayName: `${departmentCode} - Semester ${semester} - Section ${sectionName} (Batch ${batchNumber})`,
  }
}

function findDayHeaderIndex(
  rows: unknown[][],
  start: number,
  end: number,
): number | null {
  for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row) continue
    const dayCount = row.filter((value) => parseDay(String(value ?? '')) !== null).length
    if (dayCount >= 3) return rowIndex
  }
  return null
}

function parseDayColumns(
  row: unknown[],
  rowIndex: number,
  merges: XLSX.Range[],
): DayColumn[] {
  const starts: { dayOfWeek: DayOfWeek; startColumn: number; mergeSpan: number }[] = []

  for (let column = 0; column < row.length; column += 1) {
    const dayOfWeek = parseDay(String(row[column] ?? ''))
    if (!dayOfWeek) continue

    const merge = merges.find(
      (range) => range.s.r === rowIndex && range.s.c === column,
    )
    const mergeSpan = merge ? merge.e.c - merge.s.c + 1 : 0
    starts.push({ dayOfWeek, startColumn: column, mergeSpan })
  }

  return starts.map((entry, index) => {
    const nextStart = starts[index + 1]?.startColumn
    const derivedSpan =
      nextStart !== undefined ? nextStart - entry.startColumn : entry.mergeSpan
    return {
      dayOfWeek: entry.dayOfWeek,
      startColumn: entry.startColumn,
      span: Math.max(entry.mergeSpan, derivedSpan, 1),
    }
  })
}

function buildColumnSlots(
  timeRow: unknown[] | undefined,
  dayColumns: DayColumn[],
): ColumnSlot[] {
  const slots: ColumnSlot[] = []

  for (const dayColumn of dayColumns) {
    for (let offset = 0; offset < dayColumn.span; offset += 1) {
      const slotIndex = offset + 1
      if (slotIndex > 2) continue

      const column = dayColumn.startColumn + offset
      const range = parseTimeRange(cellText(timeRow, column))
      if (!range) continue

      slots.push({
        dayOfWeek: dayColumn.dayOfWeek,
        slotIndex: slotIndex as SlotIndex,
        column,
        startTime: range.startTime,
        endTime: range.endTime,
      })
    }
  }

  return slots
}

function extractTerm(rows: unknown[][]): string {
  for (const row of rows.slice(0, 12)) {
    for (const value of row) {
      const match = String(value ?? '').match(/(Fall|Spring|Summer)\s+(\d{4})/i)
      if (match) {
        const season = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()
        return `${season} ${match[2]}`
      }
    }
  }
  return 'Unknown term'
}

function selectSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: null,
      blankrows: true,
    }) as unknown[][]
    if (rows.some((row) => parseDepartment(cellText(row, 0)) !== null)) {
      return sheet
    }
  }
  return workbook.Sheets[workbook.SheetNames[0]]
}

export function parseTimetableWorkbook(
  data: ArrayBuffer | Uint8Array,
  sourceFileName = 'timetable.xlsx',
): TimetableSnapshot {
  const workbook = XLSX.read(data, { type: 'array' })
  const sheet = selectSheet(workbook)
  const merges = (sheet['!merges'] ?? []) as XLSX.Range[]
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: true,
  }) as unknown[][]

  const departmentMap = new Map<string, Department>()
  const sectionMap = new Map<string, Section>()
  const periodMap = new Map<string, Period>()
  const entries: TimetableEntry[] = []
  const occupiedCells = new Set<string>()

  let currentDepartment: Department | null = null
  let rowIndex = 0

  while (rowIndex < rows.length) {
    const department = parseDepartment(cellText(rows[rowIndex], 0))

    if (!department) {
      rowIndex += 1
      continue
    }

    currentDepartment = department
    if (!departmentMap.has(department.code)) {
      departmentMap.set(department.code, department)
    }

    const dayHeaderIndex = findDayHeaderIndex(
      rows,
      rowIndex,
      Math.min(rowIndex + 3, rows.length - 1),
    )

    if (dayHeaderIndex === null) {
      rowIndex += 1
      continue
    }

    const dayColumns = parseDayColumns(rows[dayHeaderIndex], dayHeaderIndex, merges)
    const timeRowIndex = dayHeaderIndex + 1
    const columnSlots = buildColumnSlots(rows[timeRowIndex], dayColumns)

    for (const slot of columnSlots) {
      const key = `${currentDepartment.code}:${slot.dayOfWeek}:${slot.slotIndex}`
      if (!periodMap.has(key)) {
        periodMap.set(key, {
          departmentCode: currentDepartment.code,
          dayOfWeek: slot.dayOfWeek,
          slotIndex: slot.slotIndex,
          startTime: slot.startTime,
          endTime: slot.endTime,
          label: formatSlotLabel(slot.slotIndex, slot.startTime, slot.endTime),
        })
      }
    }

    if (columnSlots.length === 0) {
      rowIndex += 1
      continue
    }

    let sectionRowIndex = timeRowIndex + 1

    while (sectionRowIndex < rows.length) {
      const label = cellText(rows[sectionRowIndex], 0)
      if (parseDepartment(label)) break

      const section = parseSection(label, currentDepartment.code)
      if (section) {
        if (!sectionMap.has(section.key)) {
          sectionMap.set(section.key, section)
        }

        for (const slot of columnSlots) {
          const rawCell = cellText(rows[sectionRowIndex], slot.column)
          if (!rawCell) continue

          const courses = extractCellCourses(rawCell)
          courses.forEach((course, cellIndex) => {
            entries.push({
              sectionKey: section.key,
              dayOfWeek: slot.dayOfWeek,
              slotIndex: slot.slotIndex,
              cellIndex,
              rawText: course.rawText,
              subjectCode: course.subjectCode,
              subjectName: course.subjectName,
              teacherName: course.teacherName,
              roomNames: course.roomNames,
              category: course.category,
              credits: course.credits,
            })
          })

          occupiedCells.add(
            sectionSlotKey(section.key, slot.dayOfWeek, slot.slotIndex),
          )
        }
      }

      sectionRowIndex += 1
    }

    rowIndex = sectionRowIndex
  }

  const departments = [...departmentMap.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  )
  const sections = [...sectionMap.values()].sort((a, b) => {
    if (a.departmentCode !== b.departmentCode) {
      return a.departmentCode.localeCompare(b.departmentCode)
    }
    if (a.semester !== b.semester) return a.semester - b.semester
    if (a.sectionName !== b.sectionName) return a.sectionName.localeCompare(b.sectionName)
    return a.batchNumber - b.batchNumber
  })
  const periods = [...periodMap.values()].sort((a, b) => {
    if (a.departmentCode !== b.departmentCode) {
      return a.departmentCode.localeCompare(b.departmentCode)
    }
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.slotIndex - b.slotIndex
  })

  if (departments.length === 0) {
    throw new Error('No department blocks found in the timetable workbook.')
  }
  if (sections.length === 0) {
    throw new Error('No section rows found in the timetable workbook.')
  }
  if (periods.length === 0) {
    throw new Error('No period rows found in the timetable workbook.')
  }

  entries.sort((a, b) => {
    if (a.sectionKey !== b.sectionKey) return a.sectionKey.localeCompare(b.sectionKey)
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    if (a.slotIndex !== b.slotIndex) return a.slotIndex - b.slotIndex
    return a.cellIndex - b.cellIndex
  })

  const freeSlots: FreeSlot[] = []
  let slotCells = 0

  for (const section of sections) {
    const departmentPeriods = periods.filter(
      (period) => period.departmentCode === section.departmentCode,
    )
    for (const period of departmentPeriods) {
      slotCells += 1
      const key = sectionSlotKey(section.key, period.dayOfWeek, period.slotIndex)
      if (!occupiedCells.has(key)) {
        freeSlots.push({
          sectionKey: section.key,
          dayOfWeek: period.dayOfWeek,
          slotIndex: period.slotIndex,
        })
      }
    }
  }

  freeSlots.sort((a, b) => {
    if (a.sectionKey !== b.sectionKey) return a.sectionKey.localeCompare(b.sectionKey)
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
    return a.slotIndex - b.slotIndex
  })

  return {
    term: extractTerm(rows),
    sourceFileName,
    parsedAt: new Date().toISOString(),
    departments,
    sections,
    periods,
    entries,
    freeSlots,
    stats: {
      departments: departments.length,
      sections: sections.length,
      slotCells,
      occupiedCells: occupiedCells.size,
      freeCells: freeSlots.length,
      entries: entries.length,
    },
  }
}

export function dayName(dayOfWeek: DayOfWeek): string {
  return DAY_NAMES[dayOfWeek]
}
