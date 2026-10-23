import { supabase } from './supabase'

export type FeedbackCategory = 'general' | 'timetable' | 'bug' | 'feature'
export type FeedbackStatus = 'new' | 'reviewed' | 'resolved'

export interface FeedbackInput {
  rating: number
  category: FeedbackCategory
  message: string
  sectionKey?: string | null
  departmentCode?: string | null
}

export interface FeedbackEntry {
  id: string
  rating: number
  category: FeedbackCategory
  message: string
  sectionKey: string | null
  departmentCode: string | null
  status: FeedbackStatus
  createdAt: string
}

interface FeedbackRow {
  id: string
  rating: number
  category: string
  message: string
  section_key: string | null
  department_code: string | null
  status: string
  created_at: string
}

export const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'timetable', label: 'Timetable' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Idea' },
]

export const FEEDBACK_STATUSES: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
]

function requireClient() {
  if (!supabase) throw new Error('Feedback requires a configured Supabase project.')
  return supabase
}

function categoryLabel(value: string): string {
  return FEEDBACK_CATEGORIES.find((item) => item.value === value)?.label ?? 'General'
}

function statusLabel(value: string): string {
  return FEEDBACK_STATUSES.find((item) => item.value === value)?.label ?? 'New'
}

export function feedbackCategoryLabel(value: string): string {
  return categoryLabel(value)
}

export function feedbackStatusLabel(value: string): string {
  return statusLabel(value)
}

function mapRow(row: FeedbackRow): FeedbackEntry {
  return {
    id: row.id,
    rating: row.rating,
    category: row.category as FeedbackCategory,
    message: row.message,
    sectionKey: row.section_key,
    departmentCode: row.department_code,
    status: row.status as FeedbackStatus,
    createdAt: row.created_at,
  }
}

export async function submitFeedback(input: FeedbackInput): Promise<void> {
  const client = requireClient()
  const message = input.message.trim()

  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error('Choose a rating from 1 to 5.')
  }
  if (message.length < 3) {
    throw new Error('Write at least 3 characters.')
  }
  if (message.length > 1200) {
    throw new Error('Keep feedback under 1200 characters.')
  }

  const { error } = await client.from('feedback').insert({
    rating: input.rating,
    category: input.category,
    message,
    section_key: input.sectionKey ?? null,
    department_code: input.departmentCode ?? null,
  })

  if (error) throw new Error(error.message)
}

export async function listFeedback(): Promise<FeedbackEntry[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)
  return ((data ?? []) as FeedbackRow[]).map(mapRow)
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('feedback').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}
