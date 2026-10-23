import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, readTheme, type Theme } from '../../lib/theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(nextTheme)
        setTheme(nextTheme)
      }}
      title={`Switch to ${nextTheme} mode`}
      aria-label={`Switch to ${nextTheme} mode`}
      className="group inline-flex size-9 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-400 transition duration-200 hover:-translate-y-0.5 hover:border-brand-400/30 hover:bg-brand-400/10 hover:text-white hover:shadow-[0_12px_30px_-18px_rgba(56,189,248,0.8)]"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -35, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 35, scale: 0.7 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="grid place-items-center"
        >
          {theme === 'dark' ? (
            <Sun className="size-4" aria-hidden="true" />
          ) : (
            <Moon className="size-4" aria-hidden="true" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
