export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

export function toSingleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function cleanRoomDisplayName(name: string): string {
  return toSingleLine(
    name
      .replace(/^room\s*:?\s*/i, '')
      .replace(/[.,;]+$/g, ''),
  )
}

export function canonicalRoomName(name: string): string {
  const cleaned = cleanRoomDisplayName(name)
  const key = cleaned.toUpperCase().replace(/\s+/g, ' ')

  const labMatch = key.match(/^LAB\s*0*(\d{1,2})$/)
  if (labMatch) {
    return `Lab ${String(Number(labMatch[1])).padStart(2, '0')}`
  }
  if (key === 'DLD LAB') return 'DLD Lab'
  if (key === 'IOT LAB') return 'IoT Lab'
  if (key === 'SMART LAB') return 'Smart Lab'
  if (/^A\d{1,2}$/.test(key)) return key

  return cleaned
}

export function normalizeRoomName(name: string): string {
  return canonicalRoomName(name).toUpperCase().replace(/\s+/g, ' ').trim()
}

const ROOM_STOP_PATTERN = /\b(?:Class\s*Time|Room\s*:)/i
const ROOM_VALUE_PATTERN = /Room\s*:?\s*([A-Za-z0-9][^\n]*)/gi
const ROOM_TAIL_PATTERN =
  /\b(?:Smart|IoT|DLD|Dld)\s+Lab\b|\bLab\s*\d{1,2}\b|\b[A-Z]{1,2}\d{1,2}\b/g

function splitRoomValue(value: string): string[] {
  return value
    .split(/\s*(?:&|,|\/|\band\b)\s*/i)
    .map((part) => canonicalRoomName(part))
    .filter((part) => part.length > 0 && !/^\d+$/.test(part))
}

export function extractRoomNames(text: string): string[] {
  const names: string[] = []
  const matches = [...text.matchAll(ROOM_VALUE_PATTERN)]

  for (const match of matches) {
    const value = match[1].split(ROOM_STOP_PATTERN)[0] ?? ''
    names.push(...splitRoomValue(value))
  }

  if (names.length === 0) {
    const beforeRoom = text.split(/\bRoom\b/i)[0]
    const tailMatches = [...beforeRoom.matchAll(ROOM_TAIL_PATTERN)]
    const last = tailMatches.at(-1)
    if (last?.[0]) {
      names.push(canonicalRoomName(last[0]))
    }
  }

  const seen = new Set<string>()
  return names.filter((name) => {
    const key = normalizeRoomName(name)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const TEACHER_PATTERN =
  /\b((?:Mr|Mrs|Ms|Dr|Prof|Professor|MS)\.?\s*(?:(?:Dr|Prof|Mr|Mrs|Ms)\.?\s*)?[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})/

const TEACHER_STOP_PATTERN =
  /\b(?:Room|Class|Lab|Smart|IoT|DLD|Semester|Section|Batch|Time|Building)\b/i

const TITLE_CANONICAL: Record<string, string> = {
  mr: 'Mr',
  mrs: 'Mrs',
  ms: 'Ms',
  dr: 'Dr',
  prof: 'Prof',
  professor: 'Prof',
}

const COURSE_WORD_STOP =
  /^(?:lab|labs|computer|vision|data|mining|smart|iot|dld|object|oriented|programming|programmig|structures?|structure|systems?|networks?|network|security|accounting|economics|mathematics?|physics|english|islamic|studies|pakistan|ethics|religion|world|advance|advanced|analysis|algorithms?|software|engineering|database|databases|cloud|computing|mobile|application|development|final|year|project|administration|management|parallel|distributed|distibuted|artificial|intelligence|web|technologies|blockchain|cyber|financial|quantitative|reasoning|discrete|entrepreneurship|startup|social|services|constitution|ideology|quran|quran-i|understanding|machine|learning)$/i

export function normalizeTeacherDisplay(name: string): string {
  return toSingleLine(
    name
      .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Professor|MS)\.?\s*/gi, (_, title: string) => {
        const key = title.toLowerCase()
        const canonical = TITLE_CANONICAL[key] ?? title
        return `${canonical}. `
      })
      .replace(/\s+/g, ' '),
  )
}

function cleanTeacherCapture(capture: string): string {
  const stopIndex = capture.search(TEACHER_STOP_PATTERN)
  let value = stopIndex >= 0 ? capture.slice(0, stopIndex) : capture
  value = value
    .replace(/\s+(?:Mr|Mrs|Ms|Dr|Prof)\.?$/i, '')
    .replace(/\s+[A-Z]\d{1,2}$/g, '')
    .replace(/\s+[A-Z]$/g, '')
    .replace(/[.,;:]+$/g, '')
  return normalizeTeacherDisplay(value)
}

export function extractTeacherName(text: string): string | null {
  const match = text.match(TEACHER_PATTERN)
  if (match?.[1]) {
    const value = cleanTeacherCapture(match[1])
    if (value) return value
  }

  const beforeRoom = text.split(/\bRoom\b/i)[0]
  const withoutCode = beforeRoom.replace(/^[A-Z]{2,4}-\d{3}\s*/i, '')
  const withoutCredits = withoutCode.replace(/\d\s*\(\s*\d\s*[+-]\s*\d[^)]*\)?/g, ' ')
  const withoutCategory = withoutCredits.replace(/\([^()]*\)/g, ' ')
  const words = withoutCategory
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  const nameWords: string[] = []
  for (let i = words.length - 1; i >= 0 && nameWords.length < 4; i -= 1) {
    const word = words[i]
    if (!/^[A-Z][A-Za-z.'-]*$/.test(word)) break
    if (COURSE_WORD_STOP.test(word)) break
    nameWords.unshift(word)
  }

  if (nameWords.length >= 2) {
    return normalizeTeacherDisplay(nameWords.join(' '))
  }
  return null
}

export function normalizeTeacherName(name: string): string {
  return name
    .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Professor|MS|Sir|Madam)\.?\b/gi, ' ')
    .replace(/\s+[A-Z]$/g, '')
    .replace(/[^A-Za-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function extractCredits(text: string): string | null {
  const match = text.match(/(\d)\s*\(\s*(\d)\s*([+-])\s*(\d)/)
  if (!match) return null
  return `${match[1]}(${match[2]}${match[3]}${match[4]})`
}

export function extractCategory(text: string): string | null {
  const values = [...text.matchAll(/\(([^()]{2,80})\)/g)]
    .map((match) => toSingleLine(match[1]))
    .filter(
      (value) =>
        /[A-Za-z]/.test(value) &&
        !/^\d+\s*[+-]\s*\d+$/.test(value) &&
        !/class\s*time/i.test(value),
    )
  return values[0] ?? null
}
