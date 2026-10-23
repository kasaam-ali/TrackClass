import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { PageShell } from '../PageShell'
import { LoadingPanel } from '../ui/LoadingState'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { hasSupabaseConfig, missingConfigKeys } from '../../lib/env'

export function AdminGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAdminAuth()

  if (!hasSupabaseConfig) {
    return (
      <PageShell
        title="Admin requires Supabase"
        subtitle="Connect the backend before using the upload portal."
      >
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-slate-400">
            Add the following environment values and run the SQL migration, then reload
            the app.
          </p>
          <p className="mt-2 font-mono text-xs text-amber-300">
            {missingConfigKeys.join(', ') || 'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY'}
          </p>
        </div>
      </PageShell>
    )
  }

  if (loading) {
    return (
      <PageShell title="Checking session" subtitle="Verifying your admin account.">
        <LoadingPanel
          label="Checking admin session..."
          detail="Verifying your publisher access."
          rows={2}
        />
      </PageShell>
    )
  }

  if (!session) return <Navigate to="/admin/login" replace />

  return <>{children}</>
}
