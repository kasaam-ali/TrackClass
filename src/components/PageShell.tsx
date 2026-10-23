import type { ReactNode } from 'react'
import { AmbientBackground } from './layout/AmbientBackground'
import { SiteFooter } from './layout/SiteFooter'
import { SiteHeader } from './layout/SiteHeader'

interface PageShellProps {
  title?: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  center?: ReactNode
  below?: ReactNode
  children: ReactNode
}

export function PageShell({
  title,
  subtitle,
  eyebrow = 'TrackClass',
  actions,
  center,
  below,
  children,
}: PageShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <AmbientBackground />
      <SiteHeader center={center} actions={actions} below={below} />
      <main
        className={`mx-auto w-full max-w-7xl flex-1 px-4 pb-20 sm:px-6 ${
          title ? 'pt-8 sm:pt-10' : 'pt-5 sm:pt-7'
        }`}
      >
        {title ? (
          <div className="animate-rise mb-8 max-w-3xl space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300/80">
              {eyebrow}
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="max-w-2xl text-sm leading-6 text-slate-400">{subtitle}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
