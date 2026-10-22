import {
  extractCategory,
  extractCredits,
  extractRoomNames,
  extractTeacherName,
  normalizeWhitespace,
  toSingleLine,
} from './normalize'

export const COURSE_CODE_PATTERN = /[A-Z]{2,4}-\d{3}/g

export interface CellCourse {
  rawText: string
  subjectCode: string | null
  subjectName: string | null
  teacherName: string | null
  roomNames: string[]
  category: string | null
  credits: string | null
}

export function splitCellText(text: string): string[] {
  const normalized = normalizeWhitespace(text)
  const matches = [...normalized.matchAll(COURSE_CODE_PATTERN)]

  if (matches.length <= 1) {
    return [toSingleLine(normalized)]
  }

  const parts: string[] = []
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? normalized.length)
        : normalized.length
    const part = toSingleLine(normalized.slice(start, end))
    if (part) parts.push(part)
  }

  return parts.length > 0 ? parts : [toSingleLine(normalized)]
}

function extractSubjectName(segment: string, code: string | null): string | null {
  let text = segment

  if (code) {
    const codeIndex = text.indexOf(code)
    if (codeIndex >= 0) text = text.slice(codeIndex + code.length)
  }

  const teacher = extractTeacherName(segment)
  if (teacher) text = text.replace(teacher, ' ')

  text = text
    .replace(/\uFFFD/g, '-')
    .replace(/\d\s*\([^()]*\)/g, ' ')
    .replace(/\([^()]*\)/g, ' ')
    .split(/\bRoom\b/i)[0]
    .split(/\bClass\s*Time\b/i)[0]
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[/\-.,;:]+|[/\-.,;:]+$/g, '')
    .trim()

  if (!text) return null
  return text.length > 120 ? text.slice(0, 120).trim() : text
}

export function extractCellCourses(text: string): CellCourse[] {
  const courses = splitCellText(text).map((segment): CellCourse => {
    const code = segment.match(COURSE_CODE_PATTERN)?.[0] ?? null
    return {
      rawText: segment,
      subjectCode: code,
      subjectName: extractSubjectName(segment, code),
      teacherName: extractTeacherName(segment),
      roomNames: extractRoomNames(segment),
      category: extractCategory(segment),
      credits: extractCredits(segment),
    }
  })

  if (courses.length > 1) {
    const sharedRooms = [...new Set(courses.flatMap((course) => course.roomNames))]
    if (sharedRooms.length > 0) {
      for (const course of courses) {
        if (course.roomNames.length === 0) {
          course.roomNames = sharedRooms
        }
      }
    }

    const teachers = [
      ...new Set(
        courses
          .map((course) => course.teacherName)
          .filter((name): name is string => Boolean(name)),
      ),
    ]

    if (teachers.length === 1) {
      for (const course of courses) {
        if (!course.teacherName) course.teacherName = teachers[0]
      }
    }
  }

  return courses
}
