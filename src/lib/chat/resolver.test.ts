import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { TimetableMeta } from '../store'
import { parseTimetableWorkbook } from '../timetable/parse'
import { resolveChatQuery } from './resolver'
import type { ChatContext } from './types'

const workbookData = Uint8Array.from(
  readFileSync(resolve(process.cwd(), 'sample/timetable-fall-2026.xlsx')),
)
const snapshot = parseTimetableWorkbook(workbookData, 'timetable-fall-2026.xlsx')

function context(
  sectionKey: string,
  now: Date,
  meta: TimetableMeta | null = null,
): ChatContext {
  return { snapshot, sectionKey, meta, now }
}

const mondayMorning = new Date('2026-10-19T03:00:00Z')
const mondayMidSlot = new Date('2026-10-19T05:00:00Z')

describe('resolveChatQuery', () => {
  it('answers the next class before the first slot', () => {
    const reply = resolveChatQuery(
      'Meri agli class konsi hai?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('agli class')
    expect(reply?.text).toContain('Data Structures Lab')
    expect(reply?.text).toContain('Lab 01')
  })

  it('reports the current class and the class after it', () => {
    const reply = resolveChatQuery(
      'Meri agli class konsi hai?',
      context('BSCS-S2-A-B17', mondayMidSlot),
    )

    expect(reply?.text).toContain('Abhi aap ki class')
    expect(reply?.text).toContain('Data Structures Lab')
    expect(reply?.text).toContain('Slot 2')
  })

  it('lists free rooms for a requested slot', () => {
    const reply = resolveChatQuery(
      'Monday slot 2 kaunsa room free hai?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('A6')
    expect(reply?.text).toContain('A11')
    expect(reply?.cards?.[0].title).toContain('Monday Slot 2')
  })

  it('lists free slots for a section with free periods', () => {
    const reply = resolveChatQuery(
      'Friday ke free slots?',
      context('BSCS-S8-A-B14', mondayMorning),
    )

    expect(reply?.text).toContain('Friday')
    expect(reply?.text).toContain('Slot 2')
  })

  it('reports no free slots when the section is fully booked', () => {
    const reply = resolveChatQuery(
      'Friday ke free slots?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('koi slot free nahin')
  })

  it('locates a teacher in their current class', () => {
    const reply = resolveChatQuery(
      'Sir Abid Ali kahan hain?',
      context('BSCS-S2-A-B17', mondayMidSlot),
    )

    expect(reply?.text).toContain('Abid Ali')
    expect(reply?.text).toContain('Lab 01')
    expect(reply?.cards?.some((card) => card.title === 'Monday')).toBe(true)
  })

  it('answers subject timing questions with sessions', () => {
    const reply = resolveChatQuery(
      'CSC-211 timing kya hai?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('CSC-211')
    expect(reply?.cards?.length).toBeGreaterThan(1)
    expect(reply?.cards?.[0].title).toContain('Monday Slot 1')
  })

  it('answers section schedule questions', () => {
    const reply = resolveChatQuery(
      'Monday ki classes batao',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Monday')
    expect(reply?.cards?.[0].lines.length).toBe(2)
  })

  it('summarizes section changes from metadata', () => {
    const meta: TimetableMeta = {
      versionNumber: 2,
      term: 'Fall 2026',
      contentHash: 'hash',
      note: null,
      changes: {
        added: [
          {
            sectionKey: 'BSCS-S2-A-B17',
            sectionName: 'BSCS - Semester 2 - Section A (Batch 17)',
            dayOfWeek: 1,
            slotIndex: 1,
            before: '',
            after: 'CSC-211 Data Structures',
          },
        ],
        removed: [],
        modified: [],
        changedCount: 1,
      },
      excelFileUrl: null,
      sourceFileName: 'timetable-fall-2026.xlsx',
      updatedAt: '2026-10-19T03:00:00Z',
    }

    const reply = resolveChatQuery('kya change hua?', context('BSCS-S2-A-B17', mondayMorning, meta))

    expect(reply?.text).toContain('1 change')
    expect(reply?.cards?.[0].title).toBe('Added')
  })

  it('returns null for off-topic questions', () => {
    expect(
      resolveChatQuery('What is the weather tomorrow?', context('BSCS-S2-A-B17', mondayMorning)),
    ).toBeNull()
  })
})
