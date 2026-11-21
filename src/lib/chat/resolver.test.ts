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

  it('answers schedule questions for another section', () => {
    const reply = resolveChatQuery(
      'BSCS Semester 4 Section A ki Monday classes konsi hain?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Semester 4')
    expect(reply?.cards?.length).toBeGreaterThan(0)
    expect(reply?.cards?.[0].lines.join(' ')).toContain('Semester 4')
  })

  it('answers a day only schedule question', () => {
    const reply = resolveChatQuery(
      'What is on Wednesday?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Wednesday')
    expect(reply?.cards?.length).toBeGreaterThan(0)
  })

  it('answers who teaches a subject', () => {
    const reply = resolveChatQuery(
      'Who teaches CSC-211?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('CSC-211')
    expect(reply?.text).toContain('padhate hain')
  })

  it('answers where a subject is taught', () => {
    const reply = resolveChatQuery(
      'Where is CSC-211 taught?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('CSC-211')
    expect(reply?.text).toContain('mein hoti hai')
  })

  it('answers how many sections there are', () => {
    const reply = resolveChatQuery(
      'How many sections are there?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain(String(snapshot.stats.sections))
    expect(reply?.text).toContain('sections')
    expect(reply?.cards?.[0].title).toBe('Sections by department')
  })

  it('answers how many teachers there are', () => {
    const reply = resolveChatQuery(
      'how many teachers are there',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toMatch(/\d+ teachers/)
    expect(reply?.cards?.[0].title).toBe('Teachers')
  })

  it('answers how many classes there are on a day', () => {
    const reply = resolveChatQuery(
      'How many classes are there on Monday?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Monday')
    expect(reply?.text).toMatch(/\d+ class entries/)
  })

  it('answers the busiest day', () => {
    const reply = resolveChatQuery(
      'What is the busiest day of the week?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('busy din')
    expect(reply?.cards?.[0].title).toBe('Classes by day')
  })

  it('answers the most used room', () => {
    const reply = resolveChatQuery(
      'Which room is used the most?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('room')
    expect(reply?.cards?.[0].title).toBe('Room usage')
  })

  it('answers which section has the most classes', () => {
    const reply = resolveChatQuery(
      'Which section has the most classes?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Sab se zyada classes')
    expect(reply?.cards?.[0].title).toBe('Classes by section')
  })

  it('answers which teacher has the most classes', () => {
    const reply = resolveChatQuery(
      'Which teacher has the most classes?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Sab se zyada classes')
    expect(reply?.cards?.[0].title).toBe('Classes by teacher')
  })

  it('answers who the busiest teacher is', () => {
    const reply = resolveChatQuery(
      'Who is the busiest teacher?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Sab se zyada classes')
    expect(reply?.cards?.[0].title).toBe('Classes by teacher')
  })

  it('answers how many slots free if a named teacher is absent', () => {
    const reply = resolveChatQuery(
      'Agar Sir Abid Ali nahi aaye to kitne slots free honge?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Abid Ali')
    expect(reply?.text).toContain('total')
    expect(reply?.cards?.[0].title).toBe('Affected classes')
  })

  it('infers this teacher for an absence question', () => {
    const reply = resolveChatQuery(
      'Agar ye teacher nahi aya to kitne slots free honge?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Agar')
    expect(reply?.text).toContain('total')
  })

  it('understands nhi aia spelling in an absence question', () => {
    const reply = resolveChatQuery(
      'agar ya wala teacher nhi aia to ab total kitna slots free ho gai hai',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('total')
    expect(reply?.cards?.[0].title).toBe('Affected classes')
  })

  it('handles two absent teachers together', () => {
    const reply = resolveChatQuery(
      'Agar Mr. Abid Ali aur Mr. Ali Salman nahi aaye to kitne slots free honge?',
      context('BSCS-S2-A-B17', mondayMorning),
    )

    expect(reply?.text).toContain('Abid Ali')
    expect(reply?.text).toContain('Ali Salman')
    expect(reply?.text).toContain('3 classes cancel')
    expect(reply?.text).toContain('total 3 slots free')
    expect(reply?.cards?.[1].title).toBe('Free rooms after absence')
  })

  it('suggests a free room after an absence follow-up', () => {
    const history = [
      {
        id: '1',
        role: 'user' as const,
        text: 'Agar Mr. Abid Ali aur Mr. Ali Salman nahi aaye to kitne slots free honge?',
        createdAt: '2026-10-19T03:00:00.000Z',
      },
      {
        id: '2',
        role: 'assistant' as const,
        text: 'Do classes cancel hongi.',
        createdAt: '2026-10-19T03:00:01.000Z',
      },
    ]

    const reply = resolveChatQuery('ab batao kon sa room khali hai ya main kon sa room jaon', {
      ...context('BSCS-S2-A-B17', mondayMorning),
      history,
    })

    expect(reply?.text).toContain('Abid Ali')
    expect(reply?.text).toContain('free hain')
    expect(reply?.text).toContain('ja sakte hain')
  })

  it('answers a short room follow-up after an absence question', () => {
    const history = [
      {
        id: '1',
        role: 'user' as const,
        text: 'Agar Ms. Maria aur Mr. Saad Ahmed nahi aaye to kitne slots free honge?',
        createdAt: '2026-10-19T03:00:00.000Z',
      },
    ]

    const reply = resolveChatQuery('room batao', {
      ...context('BSAI-S2-A-B3', mondayMorning),
      history,
    })

    expect(reply?.text).toContain('Maria')
    expect(reply?.text).toContain('ja sakte hain')
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
