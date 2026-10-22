export interface TimeRange {
  startTime: string
  endTime: string
}

const TIME_RANGE_PATTERN =
  /(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*(?:to|till|until|-)\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?/i

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toMinutesInternal(hours: number, minutes: number): number {
  return hours * 60 + minutes
}

export function toMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return Number.NaN
  return toMinutesInternal(Number(match[1]), Number(match[2]))
}

export function parseTimeRange(input: string): TimeRange | null {
  const match = input.match(TIME_RANGE_PATTERN)
  if (!match) return null

  const startMarker = match[3]?.toLowerCase()
  const endMarker = match[6]?.toLowerCase()

  let startHour = Number(match[1])
  let startMinute = Number(match[2])
  let endHour = Number(match[4])
  let endMinute = Number(match[5])

  if (startMarker === 'pm' && startHour < 12) startHour += 12
  if (startMarker === 'am' && startHour === 12) startHour = 0

  if (endMarker === 'pm' && endHour < 12) endHour += 12
  if (endMarker === 'am' && endHour === 12) endHour = 0

  if (!endMarker) {
    const startTotal = toMinutesInternal(startHour, startMinute)
    let endTotal = toMinutesInternal(endHour, endMinute)
    while (endTotal <= startTotal) {
      endHour += 12
      endTotal = toMinutesInternal(endHour, endMinute)
    }
  }

  if (startHour > 23 || endHour > 23) return null
  if (startMinute > 59 || endMinute > 59) return null
  if (toMinutesInternal(endHour, endMinute) <= toMinutesInternal(startHour, startMinute)) {
    return null
  }

  return {
    startTime: `${pad(startHour)}:${pad(startMinute)}`,
    endTime: `${pad(endHour)}:${pad(endMinute)}`,
  }
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime}-${endTime}`
}

export function formatSlotLabel(slotIndex: number, startTime: string, endTime: string): string {
  return `Slot ${slotIndex} (${startTime}-${endTime})`
}
