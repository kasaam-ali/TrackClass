import { hasSupabaseConfig } from '../env'
import { localStore } from './local'
import { supabaseStore } from './supabase'
import type { TimetableStore } from './types'

export const timetableStore: TimetableStore = hasSupabaseConfig
  ? supabaseStore
  : localStore

export { localStore, supabaseStore }
export type { SaveTimetableInput, TimetableMeta, TimetableStore } from './types'
