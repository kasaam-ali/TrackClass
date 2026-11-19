import { toZonedTime } from 'date-fns-tz'
import {
  TIME_ZONE,
  buildTeacherIndex,
  findFreeRooms,
  getAllRooms,
  getScheduleState,
  type SnapshotDiff,
  type TeacherIndexEntry,
} from '../timetable/engines'
import { normalizeRoomName } from '../timetable/normalize'
import {
  DAY_NAMES,
  type DayOfWeek,
  type Period,
  type Section,
  type SlotIndex,
  type TimetableEntry,
  type TimetableSnapshot,
} from '../timetable/types'
import type { ChatCard, ChatContext, ChatReply } from './types'

const DAY_PATTERNS: Array<[DayOfWeek, RegExp]> = [
  [1, /\b(mon|monday|peer|pir|somwar)\b/],
  [2, /\b(tue|tues|tuesday|mangal|mangalwar)\b/],
  [3, /\b(wed|wednesday|budh|budhwar)\b/],
  [4, /\b(thu|thur|thurs|thursday|jumerat|jumeraat)\b/],
  [5, /\b(fri|friday|jumma|juma)\b/],
]

const TEACHER_STOP_WORDS = new Set([
  'sir',
  'madam',
  'miss',
  'teacher',
  'prof',
  'professor',
  'class',
  'classes',
  'schedule',
  'timetable',
  'kahan',
  'where',
  'location',
  'timing',
  'time',
  'free',
  'abhi',
  'now',
])

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text)
}

function minutesOf(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function detectDay(text: string): DayOfWeek | null {
  for (const [day, pattern] of DAY_PATTERNS) {
    if (pattern.test(text)) return day
  }
  return null
}

function detectSlot(text: string): SlotIndex | null {
  if (/\b(slot\s*1|1st\s*slot|first\s*slot|pehla|pehli)\b/.test(text)) return 1
  if (/\b(slot\s*2|2nd\s*slot|second\s*slot|dusra|dusri)\b/.test(text)) return 2
  return null
}

function pktClock(now: Date): { jsDay: number; day: DayOfWeek | null; minutes: number } {
  const zoned = toZonedTime(now, TIME_ZONE)
  const jsDay = zoned.getDay()
  return {
    jsDay,
    day: jsDay >= 1 && jsDay <= 5 ? (jsDay as DayOfWeek) : null,
    minutes: zoned.getHours() * 60 + zoned.getMinutes(),
  }
}

function sectionOf(ctx: ChatContext): Section | undefined {
  return ctx.snapshot.sections.find((section) => section.key === ctx.sectionKey)
}

function findRequestedSection(text: string, ctx: ChatContext): Section | null {
  const own = sectionOf(ctx)
  const scored = ctx.snapshot.sections
    .filter((section) => hasWord(text, section.departmentCode.toLowerCase()))
    .map((section) => {
      let score = 1
      if (new RegExp(`\\bsemester\\s*${section.semester}\\b`).test(text)) score += 3
      if (new RegExp(`\\bsection\\s*${section.sectionName.toLowerCase()}\\b`).test(text)) score += 3
      if (new RegExp(`\\bbatch\\s*${section.batchNumber}\\b`).test(text)) score += 2
      return { section, score }
    })
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return null

  const top = scored[0].score
  const leaders = scored.filter((item) => item.score === top)
  if (leaders.length === 1) return leaders[0].section

  return leaders.find((item) => item.section.key === own?.key)?.section ?? null
}

function periodAt(
  snapshot: TimetableSnapshot,
  departmentCode: string,
  day: DayOfWeek,
  slot: SlotIndex,
): Period | undefined {
  return snapshot.periods.find(
    (period) =>
      period.departmentCode === departmentCode &&
      period.dayOfWeek === day &&
      period.slotIndex === slot,
  )
}

function periodLabel(period: Period | undefined): string {
  if (!period) return ''
  return ` (${period.startTime}-${period.endTime})`
}

function entriesFor(
  snapshot: TimetableSnapshot,
  sectionKey: string,
  day: DayOfWeek,
  slot: SlotIndex,
): TimetableEntry[] {
  return snapshot.entries.filter(
    (entry) =>
      entry.sectionKey === sectionKey &&
      entry.dayOfWeek === day &&
      entry.slotIndex === slot,
  )
}

function subjectLine(entry: TimetableEntry): string {
  return `${entry.subjectCode ? `${entry.subjectCode} ` : ''}${entry.subjectName ?? entry.rawText}`.trim()
}

function entryDetail(entry: TimetableEntry, section: Section | undefined): string {
  const parts = [subjectLine(entry)]
  if (entry.teacherName) parts.push(entry.teacherName)
  if (entry.roomNames.length) parts.push(entry.roomNames.join(', '))
  if (section) parts.push(section.displayName)
  return parts.join(' · ')
}

function defaultSlotForDay(
  snapshot: TimetableSnapshot,
  departmentCode: string,
  day: DayOfWeek,
  now: Date,
): SlotIndex {
  const clock = pktClock(now)
  const periods = snapshot.periods
    .filter((period) => period.departmentCode === departmentCode && period.dayOfWeek === day)
    .sort((a, b) => a.slotIndex - b.slotIndex)

  if (clock.day === day) {
    const active = periods.find(
      (period) =>
        clock.minutes >= minutesOf(period.startTime) &&
        clock.minutes < minutesOf(period.endTime),
    )
    if (active) return active.slotIndex
    const next = periods.find((period) => clock.minutes < minutesOf(period.startTime))
    if (next) return next.slotIndex
  }

  return 1
}

function isFreeRoomQuery(text: string): boolean {
  const mentionsRoom = /\b(room|rooms|kamra|kamray|lab|labs)\b/.test(text)
  const asksFree = /\b(free|khali|empty|available|kaunsa|konsa)\b/.test(text)
  return mentionsRoom && asksFree
}

function isFreeSlotQuery(text: string): boolean {
  const asksFree = /\b(free|khali|chutti|chhutti|off)\b/.test(text)
  const mentionsSlot =
    /\b(slot|slots|period|periods|class|classes|lecture|lectures|time|din|day)\b/.test(text)
  return asksFree && (mentionsSlot || detectDay(text) !== null)
}

function isNextClassQuery(text: string): boolean {
  return (
    /\b(next|agli|agla|upcoming|aane\s*wali)\b/.test(text) &&
    /\b(class|classes|lecture|period|slot)\b/.test(text)
  )
}

function isCurrentClassQuery(text: string): boolean {
  return (
    /\b(abhi|now|current|is\s*waqt|right\s*now)\b/.test(text) &&
    /\b(class|classes|lecture|period|slot|kya)\b/.test(text)
  )
}

function isChangeQuery(text: string): boolean {
  return /\b(change|changes|changed|diff|difference|update|updated|new|badla|badli)\b/.test(text)
}

function isGreeting(text: string): boolean {
  return /^(hi|hello|hey|salam|assalam|assalamualaikum|aoa|help|madad|kya kar sakte)\b/.test(
    text,
  )
}

function isScheduleQuery(text: string): boolean {
  return /\b(timetable|schedule|routine|classes|class|lectures|periods)\b/.test(text)
}

function isCountQuery(text: string): boolean {
  return /\b(how\s+many|kitne|kitni|kitna|total|count|number\s+of)\b/.test(text)
}

function findTeacherInMessage(text: string, snapshot: TimetableSnapshot): TeacherIndexEntry | null {
  const index = buildTeacherIndex(snapshot)
  let best: TeacherIndexEntry | null = null
  let bestScore = 0

  for (const teacher of index) {
    const tokens = teacher.key
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !TEACHER_STOP_WORDS.has(token))
    if (tokens.length === 0) continue

    const matches = tokens.filter((token) => hasWord(text, token)).length
    const score = matches / tokens.length
    if (matches > 0 && score >= 0.5 && score > bestScore) {
      best = teacher
      bestScore = score
    }
  }

  return best
}

function findTeachersInMessage(
  text: string,
  snapshot: TimetableSnapshot,
  allowMultiple: boolean,
): TeacherIndexEntry[] {
  const index = buildTeacherIndex(snapshot)
  const scored: Array<{ teacher: TeacherIndexEntry; score: number; full: boolean }> = []

  for (const teacher of index) {
    const tokens = teacher.key
      .toLowerCase()
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !TEACHER_STOP_WORDS.has(token))
    if (tokens.length === 0) continue

    const matches = tokens.filter((token) => hasWord(text, token)).length
    const score = matches / tokens.length
    if (matches === 0 || score < 0.5) continue

    const full = text.includes(teacher.key.toLowerCase())
    scored.push({ teacher, score, full })
  }

  if (scored.length === 0) return []
  scored.sort((a, b) => Number(b.full) - Number(a.full) || b.score - a.score)

  if (!allowMultiple) return [scored[0].teacher]

  const fullMatches = scored.filter((item) => item.full)
  if (fullMatches.length > 0) return fullMatches.map((item) => item.teacher)
  return scored.map((item) => item.teacher)
}

function mentionsMultipleTeachers(text: string): boolean {
  return (
    /,|\band\b|\baur\b|\bdono\b|\bboth\b|\b2\s+teachers?\b|\bdo\s+teachers?\b/.test(text) ||
    /\bdo\s+(?:sir|madam|miss|prof)/.test(text)
  )
}

function freeRoomsAfterRemoval(
  snapshot: TimetableSnapshot,
  day: DayOfWeek,
  slot: SlotIndex,
  removed: TimetableEntry[],
): string[] {
  const remaining = snapshot.entries.filter(
    (entry) =>
      entry.dayOfWeek === day && entry.slotIndex === slot && !removed.includes(entry),
  )
  const occupied = new Set(
    remaining.flatMap((entry) => entry.roomNames.map((room) => normalizeRoomName(room))),
  )
  return getAllRooms(snapshot).filter((room) => !occupied.has(normalizeRoomName(room)))
}

function preferredRoom(rooms: string[]): string | null {
  if (rooms.length === 0) return null
  const classroom = rooms.find((room) => /^a\d+/i.test(room.trim()))
  return classroom ?? rooms[0]
}

function entryIsActive(snapshot: TimetableSnapshot, entry: TimetableEntry, now: Date): boolean {
  const clock = pktClock(now)
  if (clock.day !== entry.dayOfWeek) return false

  const section = snapshot.sections.find((item) => item.key === entry.sectionKey)
  if (!section) return false

  const period = periodAt(snapshot, section.departmentCode, entry.dayOfWeek, entry.slotIndex)
  if (!period) return false

  return (
    clock.minutes >= minutesOf(period.startTime) &&
    clock.minutes < minutesOf(period.endTime)
  )
}

interface SlotTiming {
  day: DayOfWeek
  slot: SlotIndex
  period: Period
  minutesUntil: number
}

function upcomingTiming(period: Period, now: Date): SlotTiming | null {
  const clock = pktClock(now)
  const start = minutesOf(period.startTime)

  let offsetDays: number
  if (clock.day !== null) {
    offsetDays = period.dayOfWeek - clock.day
    if (offsetDays < 0) offsetDays += 7
    if (offsetDays === 0 && start <= clock.minutes) offsetDays = 7
  } else {
    const daysToMonday = clock.jsDay === 6 ? 2 : 1
    offsetDays = daysToMonday + period.dayOfWeek - 1
  }

  const minutesUntil = offsetDays * 1440 + start - clock.minutes
  if (minutesUntil < 0) return null

  return {
    day: period.dayOfWeek,
    slot: period.slotIndex,
    period,
    minutesUntil,
  }
}

function nextSectionClass(
  snapshot: TimetableSnapshot,
  sectionKey: string,
  now: Date,
): { timing: SlotTiming; entries: TimetableEntry[] } | null {
  const section = snapshot.sections.find((item) => item.key === sectionKey)
  if (!section) return null

  const candidates: Array<{ timing: SlotTiming; entries: TimetableEntry[] }> = []
  for (const period of snapshot.periods) {
    if (period.departmentCode !== section.departmentCode) continue
    const entries = entriesFor(snapshot, sectionKey, period.dayOfWeek, period.slotIndex)
    if (entries.length === 0) continue
    const timing = upcomingTiming(period, now)
    if (timing) candidates.push({ timing, entries })
  }

  candidates.sort((a, b) => a.timing.minutesUntil - b.timing.minutesUntil)
  return candidates[0] ?? null
}

function nextTeacherEntry(
  snapshot: TimetableSnapshot,
  teacher: TeacherIndexEntry,
  now: Date,
): { entry: TimetableEntry; timing: SlotTiming } | null {
  const candidates: Array<{ entry: TimetableEntry; timing: SlotTiming }> = []

  for (const entry of teacher.entries) {
    const section = snapshot.sections.find((item) => item.key === entry.sectionKey)
    if (!section) continue
    const period = periodAt(snapshot, section.departmentCode, entry.dayOfWeek, entry.slotIndex)
    if (!period) continue
    const timing = upcomingTiming(period, now)
    if (timing) candidates.push({ entry, timing })
  }

  candidates.sort((a, b) => a.timing.minutesUntil - b.timing.minutesUntil)
  return candidates[0] ?? null
}

function answerFreeRooms(text: string, ctx: ChatContext): ChatReply {
  const { snapshot, now } = ctx
  const section = sectionOf(ctx)
  const departmentCode = section?.departmentCode ?? snapshot.departments[0]?.code ?? ''
  const explicitDay = detectDay(text)
  const explicitSlot = detectSlot(text)

  if (explicitDay === null && explicitSlot === null) {
    const priorTeachers = absenceTeachersFromHistory(ctx)
    const freed = slotsForTeachers(ctx, priorTeachers).filter((item) => item.fullyFree)

    if (freed.length > 0) {
      const lines: string[] = []
      const cards: ChatCard[] = []
      const picks: string[] = []

      for (const { day, slot, removed } of freed) {
        const rooms = freeRoomsAfterRemoval(snapshot, day, slot, removed)
        const label = `${DAY_NAMES[day]} Slot ${slot}`
        lines.push(
          rooms.length > 0
            ? `${label}: ${rooms.join(', ')} free hain.`
            : `${label}: koi room free nahin.`,
        )
        cards.push({
          title: label,
          lines: [rooms.length > 0 ? `Free rooms: ${rooms.join(', ')}` : 'No free rooms'],
        })
        const pick = preferredRoom(rooms)
        if (pick) picks.push(`${label}: ${pick}`)
      }

      const names = priorTeachers.map((teacher) => teacher.displayName).join(' aur ')
      return {
        text: `${names} ki absence ke baad ye slots free hain:\n${lines.join('\n')}${
          picks.length > 0
            ? `\nAap in rooms mein ja sakte hain:\n${picks
                .map((pick) => `- ${pick}`)
                .join('\n')}`
            : ''
        }`,
        cards,
      }
    }
  }

  const clock = pktClock(now)
  const day = explicitDay ?? clock.day ?? 1
  const slots: SlotIndex[] = explicitSlot
    ? [explicitSlot]
    : explicitDay
      ? [1, 2]
      : [defaultSlotForDay(snapshot, departmentCode, day, now)]

  const cards: ChatCard[] = []
  const lines: string[] = []

  for (const slot of slots) {
    const result = findFreeRooms(snapshot, day, slot)
    const period =
      periodAt(snapshot, departmentCode, day, slot) ??
      snapshot.periods.find((item) => item.dayOfWeek === day && item.slotIndex === slot)
    const title = `${DAY_NAMES[day]} Slot ${slot}${periodLabel(period)}`

    const freeText =
      result.freeRooms.length > 0
        ? `Free rooms: ${result.freeRooms.join(', ')}`
        : 'No free rooms'
    const sectionsText =
      result.freeSections.length > 0
        ? `Free sections: ${result.freeSections.length}`
        : 'Every section is in class'

    cards.push({
      title,
      lines: [
        freeText,
        sectionsText,
        ...result.freeSections.slice(0, 5).map((item) => item.displayName),
      ],
    })
    lines.push(
      result.freeRooms.length > 0
        ? `${title}: ${result.freeRooms.join(', ')} free hain.`
        : `${title}: koi room free nahin.`,
    )
  }

  if (explicitDay === null && clock.day === null) {
    lines.unshift('Weekend hai, is liye next working day dikha raha hoon.')
  }

  return { text: lines.join('\n'), cards }
}

function answerFreeSlots(text: string, ctx: ChatContext): ChatReply {
  const { snapshot, sectionKey } = ctx
  const section = sectionOf(ctx)
  if (!section) return { text: 'Section nahin mila. Dobara section select karein.' }

  const day = detectDay(text)
  const free = snapshot.freeSlots
    .filter((slot) => slot.sectionKey === sectionKey)
    .filter((slot) => (day ? slot.dayOfWeek === day : true))
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      return a.slotIndex - b.slotIndex
    })

  if (free.length === 0) {
    return {
      text: day
        ? `${DAY_NAMES[day]} ko aap ke section ka koi slot free nahin.`
        : 'Aap ke section ka is week koi slot free nahin.',
    }
  }

  const cards: ChatCard[] = []
  const grouped = new Map<DayOfWeek, SlotIndex[]>()

  for (const slot of free) {
    const list = grouped.get(slot.dayOfWeek)
    if (list) list.push(slot.slotIndex)
    else grouped.set(slot.dayOfWeek, [slot.slotIndex])
  }

  for (const [dayOfWeek, slots] of grouped) {
    cards.push({
      title: DAY_NAMES[dayOfWeek],
      lines: slots.map((slot) => {
        const period = periodAt(snapshot, section.departmentCode, dayOfWeek, slot)
        return `Slot ${slot}${periodLabel(period)} free`
      }),
    })
  }

  const summary = [...grouped.entries()]
    .map(([dayOfWeek, slots]) => `${DAY_NAMES[dayOfWeek]}: Slot ${slots.join(', ')}`)
    .join('\n')

  return {
    text: `Aap ke section ke free slots:\n${summary}`,
    cards,
  }
}

function answerNextClass(ctx: ChatContext): ChatReply {
  const { snapshot, sectionKey, now } = ctx
  const state = getScheduleState(snapshot, sectionKey, now)
  const next = nextSectionClass(snapshot, sectionKey, now)
  const section = sectionOf(ctx)

  if (state.currentPeriod && state.currentEntries.length > 0) {
    const currentText = state.currentEntries
      .map((entry) => entryDetail(entry, section))
      .join('\n')
    const nextText = next
      ? `\nAgli class: ${DAY_NAMES[next.timing.day]} Slot ${next.timing.slot}${periodLabel(next.timing.period)} (${formatMinutes(next.timing.minutesUntil)} baad).`
      : '\nIs week koi agli class nahin.'

    return {
      text: `Abhi aap ki class chal rahi hai:\n${currentText}${nextText}`,
      cards: [
        {
          title: `Now · Slot ${state.currentPeriod.slotIndex}`,
          lines: state.currentEntries.map((entry) => entryDetail(entry, section)),
        },
        ...(next
          ? [
              {
                title: `${DAY_NAMES[next.timing.day]} Slot ${next.timing.slot}${periodLabel(next.timing.period)}`,
                lines: next.entries.map((entry) => entryDetail(entry, section)),
              },
            ]
          : []),
      ],
    }
  }

  if (!next) {
    return { text: 'Is week aap ke section ki koi class nahin.' }
  }

  const summary = next.entries.map((entry) => entryDetail(entry, section)).join('\n')
  return {
    text: `Aap ki agli class ${DAY_NAMES[next.timing.day]} Slot ${next.timing.slot}${periodLabel(next.timing.period)} mein hai, ${formatMinutes(next.timing.minutesUntil)} baad.\n${summary}`,
    cards: [
      {
        title: `${DAY_NAMES[next.timing.day]} Slot ${next.timing.slot}${periodLabel(next.timing.period)}`,
        lines: next.entries.map((entry) => entryDetail(entry, section)),
      },
    ],
  }
}

function answerCurrentClass(ctx: ChatContext): ChatReply {
  const { snapshot, sectionKey, now } = ctx
  const state = getScheduleState(snapshot, sectionKey, now)
  const section = sectionOf(ctx)

  if (state.currentPeriod && state.currentEntries.length > 0) {
    return {
      text: 'Abhi aap ki class chal rahi hai.',
      cards: [
        {
          title: `Now · ${state.currentPeriod.label}`,
          lines: state.currentEntries.map((entry) => entryDetail(entry, section)),
        },
      ],
    }
  }

  if (state.currentPeriod) {
    return {
      text: `Abhi aap ka slot free hai (${state.currentPeriod.label}).`,
    }
  }

  return answerNextClass(ctx)
}

function answerTeacher(text: string, ctx: ChatContext): ChatReply | null {
  const { snapshot, now } = ctx
  const teacher = findTeacherInMessage(text, snapshot)

  if (!teacher) {
    if (/\b(teacher|sir|madam|miss|prof)\b/.test(text)) {
      return {
        text: 'Teacher ka poora naam likhein, jaise "Sir Abid Ali kahan hain?".',
      }
    }
    return null
  }

  const active = teacher.entries.find((entry) => entryIsActive(snapshot, entry, now))
  const next = nextTeacherEntry(snapshot, teacher, now)
  const cards = new Map<DayOfWeek, string[]>()

  for (const entry of teacher.entries) {
    const section = snapshot.sections.find((item) => item.key === entry.sectionKey)
    const period = section
      ? periodAt(snapshot, section.departmentCode, entry.dayOfWeek, entry.slotIndex)
      : undefined
    const line = `Slot ${entry.slotIndex}${periodLabel(period)} · ${entryDetail(entry, section)}`
    const list = cards.get(entry.dayOfWeek)
    if (list) list.push(line)
    else cards.set(entry.dayOfWeek, [line])
  }

  const scheduleCards: ChatCard[] = [...cards.entries()].map(([day, lines]) => ({
    title: DAY_NAMES[day],
    lines,
  }))

  const section = active
    ? snapshot.sections.find((item) => item.key === active.sectionKey)
    : undefined

  if (active) {
    return {
      text: `${teacher.displayName} abhi ${active.roomNames.length ? `Room ${active.roomNames.join(', ')}` : 'campus'} mein hain, ${section?.displayName ?? active.sectionKey} ki ${subjectLine(active)} class.`,
      cards: scheduleCards,
    }
  }

  if (next) {
    const nextSection = snapshot.sections.find((item) => item.key === next.entry.sectionKey)
    return {
      text: `${teacher.displayName} abhi free hain. Agli class ${DAY_NAMES[next.timing.day]} Slot ${next.timing.slot}${periodLabel(next.timing.period)} (${formatMinutes(next.timing.minutesUntil)} baad), ${nextSection?.displayName ?? next.entry.sectionKey}${next.entry.roomNames.length ? `, Room ${next.entry.roomNames.join(', ')}` : ''}.`,
      cards: scheduleCards,
    }
  }

  return {
    text: `${teacher.displayName} ki is week koi class nahin.`,
    cards: scheduleCards,
  }
}

function matchingSubjectEntries(text: string, ctx: ChatContext): TimetableEntry[] {
  const codeMatch = text.match(/\b[a-z]{2,4}-\d{3}\b/i)
  const code = codeMatch?.[0]?.toLowerCase()
  const tokens = text.split(/\s+/).filter((token) => token.length >= 3)

  return ctx.snapshot.entries.filter((entry) => {
    if (code) return entry.subjectCode?.toLowerCase() === code
    const name = (entry.subjectName ?? '').toLowerCase()
    if (!name) return false
    const matched = name.split(/\s+/).filter((token) => tokens.includes(token)).length
    return matched >= 2
  })
}

function answerSubject(text: string, ctx: ChatContext): ChatReply | null {
  const entries = matchingSubjectEntries(text, ctx)
  if (entries.length === 0) return null

  const asksTeacher = /\b(who|kaun|teacher|sir|madam|miss|prof|faculty)\b/.test(text)
  const asksLocation = /\b(where|kahan|room|location|lab)\b/.test(text)
  const asksTiming =
    /\b(time|timing|kis\s*waqt|kab|baje|slot|day|din)\b/.test(text) ||
    /\b[a-z]{2,4}-\d{3}\b/i.test(text)

  if (!asksTeacher && !asksLocation && !asksTiming) return null

  const cards: ChatCard[] = entries.slice(0, 8).map((entry) => {
    const section = ctx.snapshot.sections.find((item) => item.key === entry.sectionKey)
    const period = section
      ? periodAt(ctx.snapshot, section.departmentCode, entry.dayOfWeek, entry.slotIndex)
      : undefined
    return {
      title: `${DAY_NAMES[entry.dayOfWeek]} Slot ${entry.slotIndex}${periodLabel(period)}`,
      lines: [
        subjectLine(entry),
        entry.teacherName ? `Teacher: ${entry.teacherName}` : '',
        entry.roomNames.length ? `Room: ${entry.roomNames.join(', ')}` : '',
        section ? `Section: ${section.displayName}` : '',
      ].filter(Boolean),
    }
  })

  const subject = subjectLine(entries[0])

  if (asksTeacher) {
    const teachers = [
      ...new Set(entries.map((entry) => entry.teacherName).filter(Boolean) as string[]),
    ]
    return {
      text: teachers.length
        ? `${subject} ${teachers.join(', ')} padhate hain.`
        : `${subject} ka teacher record nahin mila.`,
      cards,
    }
  }

  if (asksLocation) {
    const rooms = [...new Set(entries.flatMap((entry) => entry.roomNames))]
    return {
      text: rooms.length
        ? `${subject} ${rooms.join(', ')} mein hoti hai.`
        : `${subject} ka room record nahin mila.`,
      cards,
    }
  }

  return {
    text: `${subject} ke ${entries.length} session mile.`,
    cards,
  }
}

function answerSchedule(text: string, ctx: ChatContext, target?: Section): ChatReply {
  const { snapshot } = ctx
  const section = target ?? sectionOf(ctx)
  const sectionKey = section?.key ?? ctx.sectionKey
  const isOwn = !target || target.key === ctx.sectionKey
  const day = detectDay(text)
  const entries = snapshot.entries
    .filter((entry) => entry.sectionKey === sectionKey)
    .filter((entry) => (day ? entry.dayOfWeek === day : true))
    .sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      return a.slotIndex - b.slotIndex
    })

  if (entries.length === 0) {
    return {
      text: day
        ? `${section?.displayName ?? sectionKey} ki ${DAY_NAMES[day]} ko koi class nahin.`
        : `${section?.displayName ?? sectionKey} ki is week koi class nahin.`,
    }
  }

  const grouped = new Map<DayOfWeek, string[]>()
  for (const entry of entries) {
    const period = section
      ? periodAt(snapshot, section.departmentCode, entry.dayOfWeek, entry.slotIndex)
      : undefined
    const line = `Slot ${entry.slotIndex}${periodLabel(period)} · ${entryDetail(entry, section)}`
    const list = grouped.get(entry.dayOfWeek)
    if (list) list.push(line)
    else grouped.set(entry.dayOfWeek, [line])
  }

  const label = section?.displayName ?? sectionKey
  return {
    text: day
      ? isOwn
        ? `${DAY_NAMES[day]} ka timetable:`
        : `${label} · ${DAY_NAMES[day]}:`
      : isOwn
        ? 'Aap ke section ka weekly timetable:'
        : `${label} ka weekly timetable:`,
    cards: [...grouped.entries()].map(([value, lines]) => ({
      title: DAY_NAMES[value],
      lines,
    })),
  }
}

function isSnapshotDiff(value: unknown): value is SnapshotDiff {
  if (!value || typeof value !== 'object') return false
  const diff = value as Partial<SnapshotDiff>
  return Array.isArray(diff.added) && Array.isArray(diff.removed) && Array.isArray(diff.modified)
}

function answerChanges(ctx: ChatContext): ChatReply {
  const changes = ctx.meta?.changes
  if (!isSnapshotDiff(changes)) {
    return { text: 'Abhi koi change record available nahin.' }
  }

  const filterSection = <T extends { sectionKey: string }>(cells: T[]) =>
    cells.filter((cell) => cell.sectionKey === ctx.sectionKey)

  const added = filterSection(changes.added)
  const removed = filterSection(changes.removed)
  const modified = filterSection(changes.modified)
  const total = added.length + removed.length + modified.length

  if (total === 0) {
    return { text: 'Is section ke liye koi change nahin.' }
  }

  const cards: ChatCard[] = []
  const addCard = (title: string, cells: typeof changes.added) => {
    if (cells.length === 0) return
    cards.push({
      title,
      lines: cells.map(
        (cell) =>
          `${DAY_NAMES[cell.dayOfWeek]} Slot ${cell.slotIndex}: ${cell.before || 'Free'} -> ${cell.after || 'Free'}`,
      ),
    })
  }

  addCard('Added', added)
  addCard('Removed', removed)
  addCard('Modified', modified)

  return { text: `Is section mein ${total} change hue hain.`, cards }
}

function answerCount(text: string, ctx: ChatContext): ChatReply | null {
  const { snapshot } = ctx
  const teachers = new Set(
    snapshot.entries
      .map((entry) => entry.teacherName)
      .filter((name): name is string => Boolean(name)),
  )
  const rooms = new Set(snapshot.entries.flatMap((entry) => entry.roomNames))

  if (/\b(sections?)\b/.test(text)) {
    const byDepartment = new Map<string, number>()
    for (const section of snapshot.sections) {
      byDepartment.set(
        section.departmentCode,
        (byDepartment.get(section.departmentCode) ?? 0) + 1,
      )
    }
    const lines = [...byDepartment.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, count]) => `${code}: ${count} sections`)

    return {
      text: `Is timetable mein total ${snapshot.sections.length} active sections hain.\n${lines.join('\n')}`,
      cards: [{ title: 'Sections by department', lines }],
    }
  }

  if (/\b(departments?)\b/.test(text)) {
    return {
      text: `Is timetable mein ${snapshot.departments.length} departments hain: ${snapshot.departments.map((department) => department.code).join(', ')}.`,
    }
  }

  if (/\b(teachers?|faculty)\b/.test(text)) {
    const list = [...teachers].sort()
    return {
      text: `Is timetable mein ${list.length} teachers hain.`,
      cards: [{ title: 'Teachers', lines: list }],
    }
  }

  if (/\b(rooms?|labs?)\b/.test(text)) {
    const list = [...rooms].sort()
    return {
      text: `Is timetable mein ${list.length} rooms use ho rahe hain.`,
      cards: [{ title: 'Rooms', lines: list }],
    }
  }

  if (/\b(classes|class|lectures?|periods?|entries)\b/.test(text)) {
    const day = detectDay(text)
    const count = day
      ? snapshot.entries.filter((entry) => entry.dayOfWeek === day).length
      : snapshot.entries.length
    return {
      text: day
        ? `${DAY_NAMES[day]} ko total ${count} class entries hain.`
        : `Is timetable mein ${snapshot.entries.length} class entries hain, ${snapshot.stats.occupiedCells} occupied slots mein.`,
    }
  }

  return null
}

function isBusiestDayQuery(text: string): boolean {
  return /\b(day|din)\b/.test(text) && /\b(busiest|busy|most|zyada|heaviest)\b/.test(text)
}

function answerBusiestDay(ctx: ChatContext): ChatReply {
  const counts = new Map<DayOfWeek, number>()
  for (const entry of ctx.snapshot.entries) {
    counts.set(entry.dayOfWeek, (counts.get(entry.dayOfWeek) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) {
    return { text: 'Day data available nahin hai.' }
  }
  const [day, count] = sorted[0]
  return {
    text: `Sab se busy din ${DAY_NAMES[day]} hai, ${count} class entries ke saath.`,
    cards: [
      {
        title: 'Classes by day',
        lines: sorted.map(
          ([value, total]) => `${DAY_NAMES[value]}: ${total} class entries`,
        ),
      },
    ],
  }
}

function isMostUsedRoomQuery(text: string): boolean {
  return /\b(rooms?|labs?)\b/.test(text) && /\b(most|busiest|used|use|zyada)\b/.test(text)
}

function answerMostUsedRoom(ctx: ChatContext): ChatReply {
  const counts = new Map<string, number>()
  for (const entry of ctx.snapshot.entries) {
    for (const room of entry.roomNames) {
      counts.set(room, (counts.get(room) ?? 0) + 1)
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) {
    return { text: 'Room data available nahin hai.' }
  }
  const [room, count] = sorted[0]
  return {
    text: `Sab se zyada use hone wala room ${room} hai, ${count} class entries mein.`,
    cards: [
      {
        title: 'Room usage',
        lines: sorted.slice(0, 8).map(([value, total]) => `${value}: ${total} classes`),
      },
    ],
  }
}

function isMostClassesSectionQuery(text: string): boolean {
  return (
    /\b(sections?)\b/.test(text) &&
    /\b(most|busiest|zyada|maximum)\b/.test(text) &&
    /\b(classes|class|entries)\b/.test(text)
  )
}

function answerMostClassesSection(ctx: ChatContext): ChatReply {
  const counts = new Map<string, number>()
  for (const entry of ctx.snapshot.entries) {
    counts.set(entry.sectionKey, (counts.get(entry.sectionKey) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) {
    return { text: 'Section data available nahin hai.' }
  }
  const [key, count] = sorted[0]
  const section = ctx.snapshot.sections.find((item) => item.key === key)
  return {
    text: `Sab se zyada classes ${section?.displayName ?? key} ki hain, ${count} entries ke saath.`,
    cards: [
      {
        title: 'Classes by section',
        lines: sorted.slice(0, 8).map(([value, total]) => {
          const item = ctx.snapshot.sections.find((entry) => entry.key === value)
          return `${item?.displayName ?? value}: ${total}`
        }),
      },
    ],
  }
}

function isMostClassesTeacherQuery(text: string): boolean {
  return (
    /\b(teachers?|faculty|sir|madam)\b/.test(text) &&
    /\b(most|busiest|zyada|maximum)\b/.test(text)
  )
}

function answerMostClassesTeacher(ctx: ChatContext): ChatReply {
  const counts = new Map<string, number>()
  for (const entry of ctx.snapshot.entries) {
    if (!entry.teacherName) continue
    counts.set(entry.teacherName, (counts.get(entry.teacherName) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) {
    return { text: 'Teacher data available nahin hai.' }
  }
  const [name, count] = sorted[0]
  return {
    text: `Sab se zyada classes ${name} ki hain, ${count} entries ke saath.`,
    cards: [
      {
        title: 'Classes by teacher',
        lines: sorted.slice(0, 8).map(([value, total]) => `${value}: ${total}`),
      },
    ],
  }
}

function isAbsenceQuery(text: string): boolean {
  const mentionsTeacher = /\b(teachers?|sir|madam|miss|prof|professor|faculty)\b/.test(text)
  const mentionsAbsence =
    /\b(absent|absence|(nahi|nhi|nai|na)\s+(aaya|aya|aaye|aye|aia|aiya|ai|a)|chutti|chhutti|leave|off|not\s+coming|won'?t\s+come)\b/.test(
      text,
    )
  const hypothetical = /\b(agar|if|suppose|what\s+if)\b/.test(text)
  return mentionsAbsence && (mentionsTeacher || hypothetical)
}

function inferTeacherForAbsence(ctx: ChatContext): TeacherIndexEntry | null {
  const state = getScheduleState(ctx.snapshot, ctx.sectionKey, ctx.now)
  const entry =
    state.currentEntries[0] ??
    nextSectionClass(ctx.snapshot, ctx.sectionKey, ctx.now)?.entries[0] ??
    state.nextEntries[0]

  if (!entry?.teacherName) return null

  return (
    buildTeacherIndex(ctx.snapshot).find(
      (teacher) => teacher.displayName === entry.teacherName,
    ) ?? null
  )
}

interface FreedSlot {
  day: DayOfWeek
  slot: SlotIndex
  removed: TimetableEntry[]
  fullyFree: boolean
}

function slotsForTeachers(ctx: ChatContext, teachers: TeacherIndexEntry[]): FreedSlot[] {
  const { snapshot, sectionKey } = ctx
  const names = new Set(teachers.map((teacher) => teacher.displayName))
  const sectionSlots = new Map<string, TimetableEntry[]>()
  for (const entry of snapshot.entries) {
    if (entry.sectionKey !== sectionKey) continue
    const key = `${entry.dayOfWeek}:${entry.slotIndex}`
    const list = sectionSlots.get(key)
    if (list) list.push(entry)
    else sectionSlots.set(key, [entry])
  }

  const result: FreedSlot[] = []
  for (const [key, slotEntries] of sectionSlots) {
    const removed = slotEntries.filter(
      (entry) => entry.teacherName !== null && names.has(entry.teacherName),
    )
    if (removed.length === 0) continue
    const [day, slot] = key.split(':').map(Number)
    result.push({
      day: day as DayOfWeek,
      slot: slot as SlotIndex,
      removed,
      fullyFree: removed.length === slotEntries.length,
    })
  }

  return result.sort((a, b) => a.day - b.day || a.slot - b.slot)
}

function absenceTeachersFromHistory(ctx: ChatContext): TeacherIndexEntry[] {
  const history = ctx.history ?? []
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index]
    if (message.role !== 'user') continue
    const text = normalizeText(message.text)
    if (!isAbsenceQuery(text)) continue
    const teachers = findTeachersInMessage(text, ctx.snapshot, true)
    if (teachers.length > 0) return teachers
  }
  return []
}

function answerTeacherAbsence(text: string, ctx: ChatContext): ChatReply {
  const { snapshot, sectionKey } = ctx
  const section = sectionOf(ctx)
  const found = findTeachersInMessage(text, snapshot, mentionsMultipleTeachers(text))
  const teachers =
    found.length > 0
      ? found
      : [inferTeacherForAbsence(ctx)].filter(
          (teacher): teacher is TeacherIndexEntry => teacher !== null,
        )

  if (teachers.length === 0) {
    return {
      text: 'Teacher ka naam likhein, jaise "Agar Sir Abid Ali nahi aaye to kitne slots free honge?".',
    }
  }

  const names = teachers.map((teacher) => teacher.displayName)
  const slots = slotsForTeachers(ctx, teachers)

  if (slots.length === 0) {
    return {
      text: `${names.join(' aur ')} ki aap ke section mein koi class nahi, is liye koi slot free nahi hoga.`,
    }
  }

  const cancelled = slots.reduce((total, item) => total + item.removed.length, 0)
  const freed = slots.filter((item) => item.fullyFree)
  const existingFree = snapshot.freeSlots.filter(
    (slot) => slot.sectionKey === sectionKey,
  )
  const totalFree = existingFree.length + freed.length

  const lines = slots.map(({ day, slot, removed }) => {
    const period = section
      ? periodAt(snapshot, section.departmentCode, day, slot)
      : undefined
    return `${DAY_NAMES[day]} Slot ${slot}${periodLabel(period)}: ${removed
      .map((entry) => subjectLine(entry))
      .join(', ')}`
  })

  const roomLines: string[] = []
  const picks: string[] = []
  for (const { day, slot, removed } of freed) {
    const rooms = freeRoomsAfterRemoval(snapshot, day, slot, removed)
    const label = `${DAY_NAMES[day]} Slot ${slot}`
    roomLines.push(
      rooms.length > 0
        ? `${label}: ${rooms.join(', ')}`
        : `${label}: koi room free nahin`,
    )
    const pick = preferredRoom(rooms)
    if (pick) picks.push(`${label}: ${pick}`)
  }

  const freedText =
    freed.length > 0
      ? `In mein se ${freed.length} slots poore free ho jayenge.`
      : 'In slots mein doosri class bhi hai, is liye slot poora free nahi hoga.'

  const freeLines = [
    ...existingFree
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.slotIndex - b.slotIndex)
      .map((slot) => `${DAY_NAMES[slot.dayOfWeek]} Slot ${slot.slotIndex}`),
    ...freed.map(({ day, slot }) => `${DAY_NAMES[day]} Slot ${slot} (new)`),
  ]

  const roomText =
    picks.length > 0
      ? `\nAap in rooms mein ja sakte hain:\n${picks.map((pick) => `- ${pick}`).join('\n')}`
      : freed.length > 0
        ? '\nUs slot mein koi room free nahin hai.'
        : ''

  return {
    text: `Agar ${names.join(' aur ')} nahi aaye, to aap ke section ki ${cancelled} classes cancel hongi.\n${freedText}\nIs ke baad aap ke section ke total ${totalFree} slots free honge.${roomText}`,
    cards: [
      { title: 'Affected classes', lines },
      ...(roomLines.length > 0
        ? [{ title: 'Free rooms after absence', lines: roomLines }]
        : []),
      { title: 'Free slots after absence', lines: freeLines },
    ],
  }
}

export function resolveChatQuery(input: string, ctx: ChatContext): ChatReply | null {
  const text = normalizeText(input)
  if (!text) return null

  if (isGreeting(text)) {
    return {
      text: 'Salam! Main timetable ke baare mein madad kar sakta hoon: free rooms, free slots, next class, teacher location, aur class timing.',
    }
  }

  if (isAbsenceQuery(text)) return answerTeacherAbsence(text, ctx)
  if (isChangeQuery(text)) return answerChanges(ctx)
  if (isFreeRoomQuery(text)) return answerFreeRooms(text, ctx)
  if (isMostClassesTeacherQuery(text)) return answerMostClassesTeacher(ctx)

  const teacherAnswer = answerTeacher(text, ctx)
  if (teacherAnswer) return teacherAnswer

  if (isFreeSlotQuery(text)) return answerFreeSlots(text, ctx)
  if (isNextClassQuery(text)) return answerNextClass(ctx)
  if (isCurrentClassQuery(text)) return answerCurrentClass(ctx)

  const subjectAnswer = answerSubject(text, ctx)
  if (subjectAnswer) return subjectAnswer

  if (isCountQuery(text)) {
    const countAnswer = answerCount(text, ctx)
    if (countAnswer) return countAnswer
  }

  if (isBusiestDayQuery(text)) return answerBusiestDay(ctx)
  if (isMostUsedRoomQuery(text)) return answerMostUsedRoom(ctx)
  if (isMostClassesSectionQuery(text)) return answerMostClassesSection(ctx)

  if (detectDay(text) !== null) {
    const requested = findRequestedSection(text, ctx)
    return answerSchedule(text, ctx, requested ?? undefined)
  }

  if (isScheduleQuery(text)) {
    const requested = findRequestedSection(text, ctx)
    if (requested && requested.key !== ctx.sectionKey) {
      return answerSchedule(text, ctx, requested)
    }
    return answerSchedule(text, ctx)
  }

  return null
}
