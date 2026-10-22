import { toZonedTime } from 'date-fns-tz'
import {
  TIME_ZONE,
  buildTeacherIndex,
  findFreeRooms,
  getScheduleState,
  type SnapshotDiff,
  type TeacherIndexEntry,
} from '../timetable/engines'
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

  const hasTimingIntent =
    /\b(time|timing|kis\s*waqt|kab|baje|slot|day|din)\b/.test(text) ||
    /\b[a-z]{2,4}-\d{3}\b/i.test(text)

  if (!hasTimingIntent) return null

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

  return {
    text: `${subjectLine(entries[0])} ke ${entries.length} session mile.`,
    cards,
  }
}

function answerSchedule(text: string, ctx: ChatContext): ChatReply {
  const { snapshot, sectionKey } = ctx
  const section = sectionOf(ctx)
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
        ? `${DAY_NAMES[day]} ko aap ke section ki koi class nahin.`
        : 'Aap ke section ki is week koi class nahin.',
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

  return {
    text: day ? `${DAY_NAMES[day]} ka timetable:` : 'Aap ke section ka weekly timetable:',
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

export function resolveChatQuery(input: string, ctx: ChatContext): ChatReply | null {
  const text = normalizeText(input)
  if (!text) return null

  if (isGreeting(text)) {
    return {
      text: 'Salam! Main timetable ke baare mein madad kar sakta hoon: free rooms, free slots, next class, teacher location, aur class timing.',
    }
  }

  if (isChangeQuery(text)) return answerChanges(ctx)
  if (isFreeRoomQuery(text)) return answerFreeRooms(text, ctx)

  const teacherAnswer = answerTeacher(text, ctx)
  if (teacherAnswer) return teacherAnswer

  if (isFreeSlotQuery(text)) return answerFreeSlots(text, ctx)
  if (isNextClassQuery(text)) return answerNextClass(ctx)
  if (isCurrentClassQuery(text)) return answerCurrentClass(ctx)

  const subjectAnswer = answerSubject(text, ctx)
  if (subjectAnswer) return subjectAnswer

  if (isScheduleQuery(text)) return answerSchedule(text, ctx)

  return null
}
