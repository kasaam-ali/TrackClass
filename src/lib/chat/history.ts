import type { ChatMessage } from './types'

const MAX_MESSAGES = 40

function historyKey(sectionKey: string): string {
  return `uni-timetable:chat:${sectionKey}`
}

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<ChatMessage>
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.text === 'string' &&
    typeof message.createdAt === 'string'
  )
}

export function loadChatHistory(sectionKey: string): ChatMessage[] {
  const raw = localStorage.getItem(historyKey(sectionKey))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMessage).slice(-MAX_MESSAGES)
  } catch {
    return []
  }
}

export function saveChatHistory(sectionKey: string, messages: ChatMessage[]): void {
  localStorage.setItem(
    historyKey(sectionKey),
    JSON.stringify(messages.slice(-MAX_MESSAGES)),
  )
}

export function clearChatHistory(sectionKey: string): void {
  localStorage.removeItem(historyKey(sectionKey))
}
