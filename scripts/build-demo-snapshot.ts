import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseTimetableWorkbook } from '../src/lib/timetable/parse'

const workbook = Uint8Array.from(
  readFileSync(resolve(process.cwd(), 'sample/timetable-fall-2026.xlsx')),
)
const snapshot = parseTimetableWorkbook(workbook, 'timetable-fall-2026.xlsx')

mkdirSync(resolve(process.cwd(), 'src/data'), { recursive: true })
writeFileSync(
  resolve(process.cwd(), 'src/data/demo-snapshot.json'),
  `${JSON.stringify(snapshot, null, 2)}\n`,
)

console.log(
  `Demo snapshot written: ${snapshot.stats.sections} sections, ${snapshot.stats.slotCells} slots, ${snapshot.stats.freeCells} free`,
)
