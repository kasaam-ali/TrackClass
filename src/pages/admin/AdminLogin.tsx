import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, LogIn, ShieldCheck } from 'lucide-react'
import { PageShell } from '../../components/PageShell'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { hasSupabaseConfig } from '../../lib/env'

export function AdminLogin() {
  const navigate = useNavigate()
  const { session, signIn, signOut } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      navigate('/admin/upload', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!hasSupabaseConfig) {
    return (
      <PageShell
        eyebrow="Admin"
        title="Admin login"
        subtitle="Supabase email and password access."
      >
        <div className="glass-panel mx-auto max-w-md rounded-3xl p-6">
          <p className="text-sm text-slate-400">
            Admin authentication needs Supabase keys and the SQL migration.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Back to dashboard
          </Link>
        </div>
      </PageShell>
    )
  }

  if (session) {
    return (
      <PageShell
        eyebrow="Admin"
        title="Admin session"
        subtitle={`Signed in as ${session.user.email ?? 'admin'}.`}
      >
        <div className="glass-panel mx-auto max-w-md rounded-3xl p-6">
          <div className="flex items-center gap-2 text-sm text-accent-300">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Session active
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/admin/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-400"
            >
              Upload timetable
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={() => {
                void signOut()
              }}
              className="rounded-xl border border-white/[0.1] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell
      eyebrow="Admin"
      title="Admin login"
      subtitle="Only the university timetable admin can publish a new version."
    >
      <form onSubmit={onSubmit} className="glass-panel mx-auto max-w-md space-y-4 rounded-3xl p-6">
        <div className="mb-2 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl border border-brand-400/20 bg-brand-400/10">
            <ShieldCheck className="size-5 text-brand-300" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Restricted access</p>
            <p className="text-[10px] text-slate-500">Publisher tools require an admin account</p>
          </div>
        </div>
        <div>
          <label htmlFor="admin-email" className="text-xs font-medium text-slate-300">
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-ink-900/70 px-3 py-2.5 text-sm text-white transition focus:border-brand-400/50 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="text-xs font-medium text-slate-300">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-ink-900/70 px-3 py-2.5 text-sm text-white transition focus:border-brand-400/50 focus:outline-none"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-slate-600"
        >
          <LogIn className="size-4" aria-hidden="true" />
          {busy ? 'Signing in...' : 'Sign in'}
        </button>

        <Link
          to="/"
          className="block text-center text-xs text-slate-500 transition hover:text-slate-300"
        >
          Back to student dashboard
        </Link>
      </form>
    </PageShell>
  )
}
