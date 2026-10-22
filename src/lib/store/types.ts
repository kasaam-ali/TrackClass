import type { TimetableSnapshot } from '../timetable/types'

export interface TimetableMeta {
  versionNumber: number
  term: string
  contentHash: string
  note: string | null
  changes: unknown
  excelFileUrl: string | null
  sourceFileName: string | null
  updatedAt: string
}

export interface SaveTimetableInput {
  note?: string
  changes?: unknown
  excelFileUrl?: string | null
  sourceFileName?: string | null
}

export interface TimetableStore {
  kind: 'supabase' | 'local'
  getSnapshot(): Promise<TimetableSnapshot | null>
  getMeta(): Promise<TimetableMeta | null>
  saveSnapshot(
    snapshot: TimetableSnapshot,
    input?: SaveTimetableInput,
  ): Promise<TimetableMeta>
  checkVersion(): Promise<string | null>
}
