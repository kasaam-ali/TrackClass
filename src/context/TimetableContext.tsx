import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { snapshotContentHash } from '../lib/hash'
import { timetableStore, type TimetableMeta } from '../lib/store'
import type { TimetableSnapshot } from '../lib/timetable/types'

interface TimetableContextValue {
  snapshot: TimetableSnapshot | null
  meta: TimetableMeta | null
  loading: boolean
  error: string | null
  updateAvailable: boolean
  reload: () => Promise<void>
}

const TimetableContext = createContext<TimetableContextValue | null>(null)

export function TimetableProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<TimetableSnapshot | null>(null)
  const [meta, setMeta] = useState<TimetableMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const snapshotRef = useRef<TimetableSnapshot | null>(null)

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSnapshot, nextMeta] = await Promise.all([
        timetableStore.getSnapshot(),
        timetableStore.getMeta(),
      ])
      setSnapshot(nextSnapshot)
      setMeta(nextMeta)
      setError(nextSnapshot ? null : 'No timetable has been published yet.')
      setUpdateAvailable(false)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load the timetable.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const check = async () => {
      const current = snapshotRef.current
      if (!current) return
      const version = await timetableStore.checkVersion()
      if (version && version !== snapshotContentHash(current)) {
        setUpdateAvailable(true)
      }
    }

    const onFocus = () => {
      void check()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <TimetableContext.Provider
      value={{ snapshot, meta, loading, error, updateAvailable, reload: load }}
    >
      {children}
    </TimetableContext.Provider>
  )
}

export function useTimetable(): TimetableContextValue {
  const value = useContext(TimetableContext)
  if (!value) throw new Error('useTimetable must be used inside TimetableProvider')
  return value
}
