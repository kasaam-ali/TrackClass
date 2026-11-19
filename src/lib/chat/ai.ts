import { supabase } from '../supabase'
import { timetableStore } from '../store'
import type { ChatMessage, ChatReply } from './types'

export async function askTimetableAi(
  message: string,
  sectionKey: string,
  localTime: Date,
  history: ChatMessage[] = [],
): Promise<ChatReply | null> {
  if (!supabase || timetableStore.kind !== 'supabase') return null

  const recent = history
    .slice(-6)
    .map((item) => ({ role: item.role, text: item.text.slice(0, 400) }))

  try {
    const { data, error } = await supabase.functions.invoke('timetable-chat', {
      body: {
        message,
        sectionKey,
        localTime: localTime.toISOString(),
        history: recent,
      },
    })

    if (error) return null

    const answer =
      data && typeof data === 'object' && 'answer' in data
        ? String((data as { answer: unknown }).answer ?? '').trim()
        : ''

    return answer ? { text: answer } : null
  } catch {
    return null
  }
}
