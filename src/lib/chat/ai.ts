import { supabase } from '../supabase'
import { timetableStore } from '../store'
import type { ChatReply } from './types'

export async function askTimetableAi(
  message: string,
  sectionKey: string,
  localTime: Date,
): Promise<ChatReply | null> {
  if (!supabase || timetableStore.kind !== 'supabase') return null

  try {
    const { data, error } = await supabase.functions.invoke('timetable-chat', {
      body: {
        message,
        sectionKey,
        localTime: localTime.toISOString(),
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
