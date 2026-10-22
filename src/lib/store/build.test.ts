import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { snapshotContentHash } from '../hash'
import { parseTimetableWorkbook } from '../timetable/parse'
import { buildSnapshotFromParts } from './build'

const workbookData = Uint8Array.from(
  readFileSync(resolve(process.cwd(), 'sample/timetable-fall-2026.xlsx')),
)
const snapshot = parseTimetableWorkbook(workbookData, 'timetable-fall-2026.xlsx')

describe('buildSnapshotFromParts', () => {
  it('rebuilds the parser snapshot with identical stats and free slots', () => {
    const rebuilt = buildSnapshotFromParts({
      term: snapshot.term,
      sourceFileName: snapshot.sourceFileName,
      parsedAt: snapshot.parsedAt,
      departments: snapshot.departments,
      sections: snapshot.sections,
      periods: snapshot.periods,
      entries: snapshot.entries,
    })

    expect(rebuilt.stats).toEqual(snapshot.stats)
    expect(rebuilt.freeSlots).toEqual(snapshot.freeSlots)
    expect(rebuilt.sections.map((section) => section.key)).toEqual(
      snapshot.sections.map((section) => section.key),
    )
  })

  it('computes a stable content hash for unchanged entries', () => {
    expect(snapshotContentHash(snapshot)).toBe(snapshotContentHash(snapshot))

    const changed = {
      ...snapshot,
      entries: snapshot.entries.map((entry, index) =>
        index === 0 ? { ...entry, rawText: `${entry.rawText} updated` } : entry,
      ),
    }

    expect(snapshotContentHash(changed)).not.toBe(snapshotContentHash(snapshot))
  })
})
