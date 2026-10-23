import { Database, Download, KeyRound, Terminal } from 'lucide-react'
import { AmbientBackground } from './layout/AmbientBackground'
import { SiteFooter } from './layout/SiteFooter'
import { ThemeToggle } from './layout/ThemeToggle'
import { Stagger, StaggerItem } from './motion/Reveal'
import { missingConfigKeys } from '../lib/env'

interface SetupScreenProps {
  onContinue: () => void
}

const steps = [
  {
    icon: Database,
    title: 'Create a Supabase project',
    body: 'Open supabase.com, create a project, then copy the project URL and publishable anon key.',
  },
  {
    icon: KeyRound,
    title: 'Add environment values',
    body: 'Create a .env file in the project root and fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  },
  {
    icon: Terminal,
    title: 'Run the SQL migration',
    body: 'Paste the Supabase migration SQL into the SQL editor and run it once.',
  },
]

export function SetupScreen({ onContinue }: SetupScreenProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AmbientBackground />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-7 px-5 py-12">
        <div className="absolute right-5 top-5 z-10">
          <ThemeToggle />
        </div>
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300/80">
            TrackClass
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Backend setup required
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            The app needs a Supabase project before it can load the live timetable.
            You can still explore the local demo while the keys are missing.
          </p>
        </div>

        <Stagger className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <StaggerItem key={step.title} whileHover={{ y: -3, scale: 1.004 }} className="h-full">
              <section className="glass-panel card-lift h-full rounded-3xl p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl border border-brand-400/20 bg-brand-400/10">
                    <step.icon className="size-4 text-brand-300" aria-hidden="true" />
                  </span>
                  <span className="font-display text-xs font-semibold text-slate-600">
                    0{index + 1}
                  </span>
                </div>
                <h2 className="mb-2 text-sm font-semibold text-white">{step.title}</h2>
                <p className="text-xs leading-5 text-slate-400">{step.body}</p>
              </section>
            </StaggerItem>
          ))}
        </Stagger>

        {missingConfigKeys.length > 0 ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4">
            <p className="text-xs font-medium text-amber-300">Missing values</p>
            <p className="mt-1 font-mono text-xs text-amber-200">
              {missingConfigKeys.join(', ')}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-400"
          >
            Continue in demo mode
            <Download
              className="size-4 transition-transform duration-200 group-hover:translate-y-0.5"
              aria-hidden="true"
            />
          </button>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white"
          >
            Open Supabase dashboard
          </a>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
