import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildTeacherIndex,
  diffSnapshots,
  findFreeRooms,
  findTeachers,
  getScheduleState,
  getSectionFreeSlots,
  getSectionGrid,
} from './engines'
import { parseTimetableWorkbook } from './parse'
import type { DayOfWeek, SlotIndex, TimetableSnapshot } from './types'

let snapshot: TimetableSnapshot

beforeAll(() => {
  const data = Uint8Array.from(
    readFileSync(resolve(process.cwd(), 'sample/timetable-fall-2026.xlsx')),
  )
  snapshot = parseTimetableWorkbook(data, 'timetable-fall-2026.xlsx')
})

function sectionKey(fragment: string): string {
  const section = snapshot.sections.find((item) =>
    item.displayName.includes(fragment),
  )
  if (!section) throw new Error(`Section not found: ${fragment}`)
  return section.key
}

describe('free room finder', () => {
  it('lists every canonical room once', () => {
    const result = findFreeRooms(snapshot, 1, 2)
    expect(result.allRooms).toHaveLength(17)
    expect(result.allRooms).toContain('Lab 01')
    expect(result.allRooms).toContain('Lab 02')
    expect(result.allRooms).toContain('DLD Lab')
    expect(result.allRooms).toContain('IoT Lab')
    expect(result.allRooms).toContain('Smart Lab')
  })

  it('computes free and occupied rooms without overlap', () => {
    const result = findFreeRooms(snapshot, 1, 2)
    expect(result.freeRooms).toEqual(['A6', 'A11'])
    expect(result.occupiedRooms).not.toContain('A6')
    expect(result.occupiedRooms).not.toContain('A11')
    expect(result.freeRooms.length + result.occupiedRooms.length).toBe(
      result.allRooms.length,
    )
  })

  it('can report a slot with no free rooms', () => {
    const result = findFreeRooms(snapshot, 1, 1)
    expect(result.freeRooms).toEqual([])
    expect(result.freeSections).toHaveLength(5)
  })

  it('reports free sections for a slot', () => {
    const result = findFreeRooms(snapshot, 1, 2)
    expect(result.freeSections.map((section) => section.displayName)).toContain(
      'BSCS - Semester 8 - Section A (Batch 14)',
    )
    expect(result.freeSections.length + result.occupiedSections.length).toBe(22)
  })
})

describe('teacher locator', () => {
  it('merges duplicate teacher spellings and titles', () => {
    const teachers = buildTeacherIndex(snapshot)
    expect(teachers).toHaveLength(42)
    const sher = teachers.find((teacher) => teacher.displayName.includes('Sher'))
    expect(sher?.displayName).toBe('Mr. Sher Muhammad')
    expect(teachers.filter((teacher) => teacher.displayName.includes('Nadia'))).toHaveLength(2)
    expect(teachers.some((teacher) => teacher.displayName === 'Ms. Tahreem Asif')).toBe(true)
  })

  it('finds a teacher by partial name', () => {
    const results = findTeachers(snapshot, 'abid')
    expect(results).toHaveLength(1)
    expect(results[0].displayName).toBe('Mr. Abid Ali')
    expect(
      results[0].entries.some(
        (entry) =>
          entry.sectionKey === sectionKey('BSCS - Semester 2 - Section A') &&
          entry.dayOfWeek === 1 &&
          entry.slotIndex === 1,
      ),
    ).toBe(true)
  })

  it('supports multi-word and title queries', () => {
    expect(findTeachers(snapshot, 'Mr. Abid')).toHaveLength(1)
    expect(findTeachers(snapshot, 'Sher Muhammad')).toHaveLength(1)
    expect(findTeachers(snapshot, 'unknown person')).toHaveLength(0)
  })
})

describe('section grid', () => {
  it('returns two slots for each working day', () => {
    const grid = getSectionGrid(snapshot, sectionKey('BSCS - Semester 2 - Section A'))
    expect(grid).toHaveLength(10)
    expect(grid.filter((slot) => slot.isFree)).toHaveLength(0)
  })

  it('marks empty cells as free', () => {
    const key = sectionKey('BSCS - Semester 8 - Section A')
    const grid = getSectionGrid(snapshot, key)
    expect(grid.filter((slot) => slot.isFree)).toHaveLength(5)
    expect(getSectionFreeSlots(snapshot, key)).toHaveLength(5)
  })
})

describe('schedule state', () => {
  const key = 'BSCS-S2-A-B17'

  it('detects the current and next slot', () => {
    const state = getScheduleState(snapshot, key, new Date('2026-10-19T04:30:00Z'))
    expect(state.currentPeriod?.slotIndex).toBe(1)
    expect(state.currentEntries).toHaveLength(1)
    expect(state.nextPeriod?.slotIndex).toBe(2)
    expect(state.minutesUntilNext).toBe(160)
    expect(state.isFreeNow).toBe(false)
  })

  it('handles the gap between slots', () => {
    const state = getScheduleState(snapshot, key, new Date('2026-10-19T07:05:00Z'))
    expect(state.currentPeriod).toBeNull()
    expect(state.nextPeriod?.slotIndex).toBe(2)
    expect(state.minutesUntilNext).toBe(5)
  })

  it('handles the end of the week', () => {
    const state = getScheduleState(snapshot, key, new Date('2026-10-23T10:00:00Z'))
    expect(state.currentPeriod).toBeNull()
    expect(state.nextPeriod?.dayOfWeek).toBe(1)
    expect(state.nextPeriod?.slotIndex).toBe(1)
    expect(state.minutesUntilNext).toBe(3960)
  })

  it('handles weekend queries', () => {
    const state = getScheduleState(snapshot, key, new Date('2026-10-24T05:00:00Z'))
    expect(state.nextPeriod?.dayOfWeek).toBe(1)
    expect(state.minutesUntilNext).toBe(2820)
  })
})

describe('diff engine', () => {
  it('reports all occupied cells when there is no previous snapshot', () => {
    const diff = diffSnapshots(null, snapshot)
    expect(diff.added).toHaveLength(177)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
    expect(diff.changedCount).toBe(177)
  })

  it('reports no changes for identical snapshots', () => {
    const diff = diffSnapshots(snapshot, snapshot)
    expect(diff.changedCount).toBe(0)
  })

  it('detects modified cells', () => {
    const next = structuredClone(snapshot)
    const target = next.entries.find(
      (entry) => entry.sectionKey === 'BSCS-S2-A-B17' && entry.dayOfWeek === 1,
    )
    expect(target).toBeDefined()
    if (target) target.rawText = `${target.rawText} changed`

    const diff = diffSnapshots(snapshot, next)
    expect(diff.modified).toHaveLength(1)
    expect(diff.modified[0].sectionKey).toBe('BSCS-S2-A-B17')
    expect(diff.modified[0].before).not.toBe(diff.modified[0].after)
  })

  it('detects added cells in previously free slots', () => {
    const next = structuredClone(snapshot)
    const key = 'BSCS-S8-A-B14'
    next.entries.push({
      sectionKey: key,
      dayOfWeek: 1 as DayOfWeek,
      slotIndex: 2 as SlotIndex,
      cellIndex: 0,
      rawText: 'TST-101 Test Course',
      subjectCode: 'TST-101',
      subjectName: 'Test Course',
      teacherName: 'Mr. Test Teacher',
      roomNames: ['A1'],
      category: null,
      credits: null,
    })

    const diff = diffSnapshots(snapshot, next)
    expect(diff.added).toHaveLength(1)
    expect(diff.added[0].sectionKey).toBe(key)
  })
})
