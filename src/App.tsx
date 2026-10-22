import { lazy, Suspense, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { SetupScreen } from './components/SetupScreen'
import { AdminAuthProvider } from './context/AdminAuthContext'
import { ProfileProvider } from './context/ProfileContext'
import { TimetableProvider } from './context/TimetableContext'
import { hasSupabaseConfig } from './lib/env'
import { Onboarding } from './pages/Onboarding'
import { StudentDashboard } from './pages/StudentDashboard'

const AdminLogin = lazy(async () => ({
  default: (await import('./pages/admin/AdminLogin')).AdminLogin,
}))
const AdminUpload = lazy(async () => ({
  default: (await import('./pages/admin/AdminUpload')).AdminUpload,
}))
const AdminTimetable = lazy(async () => ({
  default: (await import('./pages/admin/AdminTimetable')).AdminTimetable,
}))

const DEMO_KEY = 'uni-timetable:demo-mode'

function RouteLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 text-sm text-slate-400">
      Loading...
    </div>
  )
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<StudentDashboard />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/upload" element={<AdminUpload />} />
        <Route path="/admin/timetable" element={<AdminTimetable />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function ConfigGate() {
  const navigate = useNavigate()
  const [demoMode, setDemoMode] = useState(
    () => localStorage.getItem(DEMO_KEY) === '1',
  )

  if (!hasSupabaseConfig && !demoMode) {
    return (
      <SetupScreen
        onContinue={() => {
          localStorage.setItem(DEMO_KEY, '1')
          setDemoMode(true)
          navigate('/', { replace: true })
        }}
      />
    )
  }

  return <AppRoutes />
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AdminAuthProvider>
          <ProfileProvider>
            <TimetableProvider>
              <ConfigGate />
            </TimetableProvider>
          </ProfileProvider>
        </AdminAuthProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}
