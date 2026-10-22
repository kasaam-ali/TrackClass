import type { TimetableMeta } from '../store'
import type { TimetableSnapshot } from '../timetable/types'

export interface ChatCard {
  title: string
  lines: string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
  cards?: ChatCard[]
  source?: 'local' | 'ai' | 'fallback'
}

export interface ChatReply {
  text: string
  cards?: ChatCard[]
}

export interface ChatContext {
  snapshot: TimetableSnapshot
  sectionKey: string
  meta: TimetableMeta | null
  now: Date
}
