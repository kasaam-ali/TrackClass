import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import {
  clearProfile as clearStoredProfile,
  loadProfile,
  saveProfile,
  type StudentProfile,
} from '../lib/profile'

interface ProfileContextValue {
  profile: StudentProfile | null
  setProfile: (profile: StudentProfile) => void
  clearProfile: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<StudentProfile | null>(() => loadProfile())

  const setProfile = useCallback((next: StudentProfile) => {
    saveProfile(next)
    setProfileState(next)
  }, [])

  const clearProfile = useCallback(() => {
    clearStoredProfile()
    setProfileState(null)
  }, [])

  return (
    <ProfileContext.Provider value={{ profile, setProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile must be used inside ProfileProvider')
  return value
}
