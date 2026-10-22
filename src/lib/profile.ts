const PROFILE_KEY = 'uni-timetable:profile:v1'

export interface StudentProfile {
  departmentCode: string
  sectionKey: string
}

export function loadProfile(): StudentProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<StudentProfile>
    if (typeof value.departmentCode !== 'string') return null
    if (typeof value.sectionKey !== 'string') return null
    return { departmentCode: value.departmentCode, sectionKey: value.sectionKey }
  } catch {
    return null
  }
}

export function saveProfile(profile: StudentProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY)
}
