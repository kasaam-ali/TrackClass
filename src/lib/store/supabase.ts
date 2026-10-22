import { snapshotContentHash } from '../hash'
import { supabase } from '../supabase'
import { normalizeRoomName, normalizeTeacherName } from '../timetable/normalize'
import type {
  DayOfWeek,
  Department,
  Period,
  Section,
  SlotIndex,
  TimetableEntry,
  TimetableSnapshot,
} from '../timetable/types'
import { buildSnapshotFromParts } from './build'
import type { SaveTimetableInput, TimetableMeta, TimetableStore } from './types'

const SNAPSHOT_CACHE_KEY = 'uni-timetable:remote-snapshot:v1'
const META_CACHE_KEY = 'uni-timetable:remote-meta:v1'
const HASH_CACHE_KEY = 'uni-timetable:remote-hash:v1'

interface MetaRow {
  id: string
  version_number: number
  term: string
  content_hash: string
  note: string | null
  changes_json: unknown
  excel_file_url: string | null
  source_file_name: string | null
  is_active: boolean
  updated_at: string
}

interface DepartmentRow {
  id: string
  code: string
  name: string
}

interface SectionRow {
  section_key: string
  department_id: string
  semester: number
  section_name: string
  batch_label: string
  display_name: string
}

interface PeriodRow {
  department_id: string
  day_of_week: number
  slot_index: number
  start_time: string
  end_time: string
  label: string
}

interface EntryRow {
  section_key: string
  day_of_week: number
  slot_index: number
  cell_index: number
  raw_text: string
  subject_code: string | null
  subject_name: string | null
  teacher_name: string | null
  room_names: string[] | null
  category: string | null
  credits: string | null
}

interface SnapshotPayloadEntry {
  section_key: string
  day_of_week: number
  slot_index: number
  cell_index: number
  raw_text: string
  subject_code: string | null
  subject_name: string | null
  teacher_name: string | null
  teacher_key: string | null
  room_names: string[]
  room_keys: string[]
  category: string | null
  credits: string | null
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function readCache<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeCache(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function mapMeta(row: MetaRow): TimetableMeta {
  return {
    versionNumber: row.version_number,
    term: row.term,
    contentHash: row.content_hash,
    note: row.note,
    changes: row.changes_json,
    excelFileUrl: row.excel_file_url,
    sourceFileName: row.source_file_name,
    updatedAt: row.updated_at,
  }
}

function batchNumberFromLabel(batchLabel: string): number {
  const match = batchLabel.match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

async function getActiveMetaRow(): Promise<MetaRow | null> {
  const client = requireClient()
  const { data, error } = await client
    .from('timetable_meta')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as MetaRow | null) ?? null
}

function mapSnapshot(
  meta: MetaRow,
  departments: DepartmentRow[],
  sections: SectionRow[],
  periods: PeriodRow[],
  entries: EntryRow[],
): TimetableSnapshot {
  const departmentById = new Map(departments.map((row) => [row.id, row]))
  const departmentModels: Department[] = departments.map((row) => ({
    code: row.code,
    name: row.name,
  }))

  const sectionModels: Section[] = sections.map((row) => {
    const department = departmentById.get(row.department_id)
    return {
      key: row.section_key,
      departmentCode: department?.code ?? '',
      semester: row.semester,
      sectionName: row.section_name,
      batchLabel: row.batch_label,
      batchNumber: batchNumberFromLabel(row.batch_label),
      displayName: row.display_name,
    }
  })

  const periodModels: Period[] = periods.map((row) => {
    const department = departmentById.get(row.department_id)
    return {
      departmentCode: department?.code ?? '',
      dayOfWeek: row.day_of_week as DayOfWeek,
      slotIndex: row.slot_index as SlotIndex,
      startTime: row.start_time,
      endTime: row.end_time,
      label: row.label,
    }
  })

  const entryModels: TimetableEntry[] = entries.map((row) => ({
    sectionKey: row.section_key,
    dayOfWeek: row.day_of_week as DayOfWeek,
    slotIndex: row.slot_index as SlotIndex,
    cellIndex: row.cell_index,
    rawText: row.raw_text,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    teacherName: row.teacher_name,
    roomNames: row.room_names ?? [],
    category: row.category,
    credits: row.credits,
  }))

  return buildSnapshotFromParts({
    term: meta.term,
    sourceFileName: meta.source_file_name ?? 'timetable.xlsx',
    parsedAt: meta.updated_at,
    departments: departmentModels,
    sections: sectionModels,
    periods: periodModels,
    entries: entryModels,
  })
}

export const supabaseStore: TimetableStore = {
  kind: 'supabase',

  async getSnapshot() {
    try {
      const meta = await getActiveMetaRow()
      if (!meta) return readCache<TimetableSnapshot>(SNAPSHOT_CACHE_KEY)

      const client = requireClient()
      const [departments, sections, periods, entries] = await Promise.all([
        client.from('departments').select('id, code, name'),
        client
          .from('sections')
          .select(
            'section_key, department_id, semester, section_name, batch_label, display_name',
          )
          .eq('is_active', true),
        client
          .from('periods')
          .select('department_id, day_of_week, slot_index, start_time, end_time, label'),
        client
          .from('active_timetable_entries')
          .select(
            'section_key, day_of_week, slot_index, cell_index, raw_text, subject_code, subject_name, teacher_name, room_names, category, credits',
          ),
      ])

      for (const result of [departments, sections, periods, entries]) {
        if (result.error) throw new Error(result.error.message)
      }

      const snapshot = mapSnapshot(
        meta,
        (departments.data ?? []) as DepartmentRow[],
        (sections.data ?? []) as SectionRow[],
        (periods.data ?? []) as PeriodRow[],
        (entries.data ?? []) as EntryRow[],
      )

      writeCache(SNAPSHOT_CACHE_KEY, snapshot)
      writeCache(META_CACHE_KEY, mapMeta(meta))
      writeCache(HASH_CACHE_KEY, meta.content_hash)
      return snapshot
    } catch (error) {
      const cached = readCache<TimetableSnapshot>(SNAPSHOT_CACHE_KEY)
      if (cached) return cached
      throw error
    }
  },

  async getMeta() {
    try {
      const meta = await getActiveMetaRow()
      if (!meta) return readCache<TimetableMeta>(META_CACHE_KEY)
      const model = mapMeta(meta)
      writeCache(META_CACHE_KEY, model)
      writeCache(HASH_CACHE_KEY, meta.content_hash)
      return model
    } catch (error) {
      const cached = readCache<TimetableMeta>(META_CACHE_KEY)
      if (cached) return cached
      throw error
    }
  },

  async saveSnapshot(snapshot: TimetableSnapshot, input: SaveTimetableInput = {}) {
    const client = requireClient()
    const teachers = new Map<string, string>()
    const rooms = new Map<string, string>()

    const entries: SnapshotPayloadEntry[] = snapshot.entries.map((entry) => {
      const teacherKey = entry.teacherName
        ? normalizeTeacherName(entry.teacherName)
        : null
      if (entry.teacherName && teacherKey) teachers.set(teacherKey, entry.teacherName)

      const roomKeys = entry.roomNames.map((room) => normalizeRoomName(room))
      entry.roomNames.forEach((room, index) => {
        rooms.set(roomKeys[index], room)
      })

      return {
        section_key: entry.sectionKey,
        day_of_week: entry.dayOfWeek,
        slot_index: entry.slotIndex,
        cell_index: entry.cellIndex,
        raw_text: entry.rawText,
        subject_code: entry.subjectCode,
        subject_name: entry.subjectName,
        teacher_name: entry.teacherName,
        teacher_key: teacherKey,
        room_names: entry.roomNames,
        room_keys: roomKeys,
        category: entry.category,
        credits: entry.credits,
      }
    })

    const payload = {
      term: snapshot.term,
      content_hash: snapshotContentHash(snapshot),
      note: input.note ?? null,
      changes: input.changes ?? {},
      excel_file_url: input.excelFileUrl ?? null,
      source_file_name: input.sourceFileName ?? snapshot.sourceFileName,
      departments: snapshot.departments.map((department) => ({
        code: department.code,
        name: department.name,
      })),
      sections: snapshot.sections.map((section) => ({
        section_key: section.key,
        department_code: section.departmentCode,
        semester: section.semester,
        section_name: section.sectionName,
        batch_label: section.batchLabel,
        display_name: section.displayName,
      })),
      periods: snapshot.periods.map((period) => ({
        department_code: period.departmentCode,
        day_of_week: period.dayOfWeek,
        slot_index: period.slotIndex,
        start_time: period.startTime,
        end_time: period.endTime,
        label: period.label,
      })),
      teachers: [...teachers.entries()].map(([normalized_name, name]) => ({
        name,
        normalized_name,
      })),
      rooms: [...rooms.entries()].map(([normalized_name, name]) => ({
        name,
        normalized_name,
      })),
      entries,
    }

    const { error } = await client.rpc('replace_timetable', { payload })
    if (error) throw new Error(error.message)

    const meta = await getActiveMetaRow()
    if (!meta) throw new Error('Timetable published but active version was not found')

    const model = mapMeta(meta)
    writeCache(SNAPSHOT_CACHE_KEY, snapshot)
    writeCache(META_CACHE_KEY, model)
    writeCache(HASH_CACHE_KEY, meta.content_hash)
    return model
  },

  async checkVersion() {
    try {
      const meta = await getActiveMetaRow()
      if (!meta) return readCache<string>(HASH_CACHE_KEY)
      writeCache(HASH_CACHE_KEY, meta.content_hash)
      return meta.content_hash
    } catch {
      return readCache<string>(HASH_CACHE_KEY)
    }
  },
}
