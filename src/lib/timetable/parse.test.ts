import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTimetableWorkbook } from './parse'

const workbookData = Uint8Array.from(
  readFileSync(resolve(process.cwd(), 'sample/timetable-fall-2026.xlsx')),
)

const snapshot = parseTimetableWorkbook(workbookData, 'timetable-fall-2026.xlsx')

function sectionByDisplay(fragment: string) {
  return snapshot.sections.find((section) => section.displayName.includes(fragment))
}

function periodFor(departmentCode: string, dayOfWeek: number, slotIndex: number) {
  return snapshot.periods.find(
    (period) =>
      period.departmentCode === departmentCode &&
      period.dayOfWeek === dayOfWeek &&
      period.slotIndex === slotIndex,
  )
}

describe('parseTimetableWorkbook', () => {
  it('extracts the term from the header', () => {
    expect(snapshot.term).toBe('Fall 2026')
  })

  it('matches the expected timetable counts', () => {
    expect(snapshot.stats).toEqual({
      departments: 3,
      sections: 22,
      slotCells: 220,
      occupiedCells: 177,
      freeCells: 43,
      entries: expect.any(Number),
    })
    expect(snapshot.stats.entries).toBeGreaterThanOrEqual(177)
    expect(snapshot.entries.length).toBe(snapshot.stats.entries)
  })

  it('builds 30 periods with department specific times', () => {
    expect(snapshot.periods).toHaveLength(30)
    expect(periodFor('BSCS', 1, 2)).toMatchObject({
      startTime: '12:10',
      endTime: '15:10',
    })
    expect(periodFor('BSIT', 1, 2)).toMatchObject({
      startTime: '12:00',
      endTime: '15:00',
    })
    expect(periodFor('BSAI', 1, 2)).toMatchObject({
      startTime: '12:00',
      endTime: '15:00',
    })
    expect(periodFor('BSCS', 5, 1)).toMatchObject({
      startTime: '09:00',
      endTime: '11:30',
    })
    expect(periodFor('BSCS', 5, 2)).toMatchObject({
      startTime: '11:30',
      endTime: '14:00',
    })
  })

  it('parses all departments and unique sections', () => {
    expect(snapshot.departments.map((department) => department.code)).toEqual([
      'BSAI',
      'BSCS',
      'BSIT',
    ])
    const keys = new Set(snapshot.sections.map((section) => section.key))
    const displays = new Set(snapshot.sections.map((section) => section.displayName))
    expect(keys.size).toBe(22)
    expect(displays.size).toBe(22)
  })

  it('marks empty BSCS semester 2 section A cells as occupied', () => {
    const section = sectionByDisplay('BSCS - Semester 2 - Section A (Batch 17)')
    expect(section).toBeDefined()
    const freeSlots = snapshot.freeSlots.filter(
      (slot) => slot.sectionKey === section?.key,
    )
    expect(freeSlots).toHaveLength(0)
  })

  it('finds five free slots for BSCS semester 8 section A', () => {
    const section = sectionByDisplay('BSCS - Semester 8 - Section A (Batch 14)')
    expect(section).toBeDefined()
    const freeSlots = snapshot.freeSlots.filter(
      (slot) => slot.sectionKey === section?.key,
    )
    expect(
      freeSlots.map((slot) => `${slot.dayOfWeek}:${slot.slotIndex}`),
    ).toEqual(['1:2', '2:1', '2:2', '3:1', '5:2'])
  })

  it('splits cells that contain two courses', () => {
    const section = sectionByDisplay('BSCS - Semester 2 - Section A (Batch 17)')
    expect(section).toBeDefined()
    const fridaySlotOne = snapshot.entries.filter(
      (entry) =>
        entry.sectionKey === section?.key &&
        entry.dayOfWeek === 5 &&
        entry.slotIndex === 1,
    )
    const codes = fridaySlotOne.map((entry) => entry.subjectCode)
    expect(codes).toContain('MTH-238')
    expect(codes).toContain('CSC-227')
    expect(fridaySlotOne.length).toBeGreaterThanOrEqual(2)
  })

  it('shares a room across courses in the same cell', () => {
    const section = sectionByDisplay('BSCS - Semester 2 - Section A (Batch 17)')
    const fridaySlotOne = snapshot.entries.filter(
      (entry) =>
        entry.sectionKey === section?.key &&
        entry.dayOfWeek === 5 &&
        entry.slotIndex === 1,
    )
    const rooms = fridaySlotOne.flatMap((entry) => entry.roomNames)
    expect(rooms).toContain('A3')
    expect(rooms).toContain('A8')
  })

  it('extracts course, teacher, and room from a normal cell', () => {
    const section = sectionByDisplay('BSCS - Semester 2 - Section A (Batch 17)')
    const entry = snapshot.entries.find(
      (item) =>
        item.sectionKey === section?.key &&
        item.dayOfWeek === 1 &&
        item.slotIndex === 1,
    )
    expect(entry).toMatchObject({
      subjectCode: 'CSC-211',
      subjectName: 'Data Structures Lab',
      teacherName: 'Mr. Abid Ali',
    })
    expect(entry?.roomNames).toContain('Lab 01')
  })

  it('keeps every entry inside a valid day and slot', () => {
    for (const entry of snapshot.entries) {
      expect(entry.dayOfWeek).toBeGreaterThanOrEqual(1)
      expect(entry.dayOfWeek).toBeLessThanOrEqual(5)
      expect([1, 2]).toContain(entry.slotIndex)
      expect(entry.rawText.length).toBeGreaterThan(0)
    }
  })
})
