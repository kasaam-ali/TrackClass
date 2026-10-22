import demoSnapshotJson from '../../data/demo-snapshot.json'
import { snapshotContentHash } from '../hash'
import type {
  Department,
  Section,
  TimetableEntry,
  TimetableSnapshot,
} from '../timetable/types'
import type { SaveTimetableInput, TimetableMeta, TimetableStore } from './types'

const SNAPSHOT_KEY = 'uni-timetable:snapshot:v1'
const META_KEY = 'uni-timetable:meta:v1'

const demoSnapshot = demoSnapshotJson as TimetableSnapshot

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function demoMeta(): TimetableMeta {
  return {
    versionNumber: 1,
    term: demoSnapshot.term,
    contentHash: snapshotContentHash(demoSnapshot),
    note: 'Demo data built from the sample timetable',
    changes: null,
    excelFileUrl: null,
    sourceFileName: demoSnapshot.sourceFileName,
    updatedAt: demoSnapshot.parsedAt,
  }
}

export const localStore: TimetableStore = {
  kind: 'local',

  async getSnapshot() {
    const stored = readJson<TimetableSnapshot>(SNAPSHOT_KEY)
    if (stored?.sections?.length && stored?.entries) return stored
    return demoSnapshot
  },

  async getMeta() {
    return readJson<TimetableMeta>(META_KEY) ?? demoMeta()
  },

  async saveSnapshot(snapshot: TimetableSnapshot, input: SaveTimetableInput = {}) {
    const current = readJson<TimetableMeta>(META_KEY) ?? demoMeta()
    const meta: TimetableMeta = {
      versionNumber: current.versionNumber + 1,
      term: snapshot.term,
      contentHash: snapshotContentHash(snapshot),
      note: input.note?.trim() ? input.note.trim() : null,
      changes: input.changes ?? null,
      excelFileUrl: input.excelFileUrl ?? null,
      sourceFileName: input.sourceFileName ?? snapshot.sourceFileName,
      updatedAt: new Date().toISOString(),
    }
    writeJson(SNAPSHOT_KEY, snapshot)
    writeJson(META_KEY, meta)
    return meta
  },

  async checkVersion() {
    const meta = readJson<TimetableMeta>(META_KEY) ?? demoMeta()
    return meta.contentHash
  },
}

export function resetLocalTimetable(): void {
  localStorage.removeItem(SNAPSHOT_KEY)
  localStorage.removeItem(META_KEY)
}

export function getLocalSnapshot(): TimetableSnapshot {
  return readJson<TimetableSnapshot>(SNAPSHOT_KEY) ?? demoSnapshot
}

export function getLocalDepartments(): Department[] {
  return getLocalSnapshot().departments
}

export function getLocalSections(): Section[] {
  return getLocalSnapshot().sections
}

export function getLocalEntries(): TimetableEntry[] {
  return getLocalSnapshot().entries
}
