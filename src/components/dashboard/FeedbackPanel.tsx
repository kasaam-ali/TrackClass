import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  MessageSquareText,
  ShieldCheck,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { hasSupabaseConfig } from '../../lib/env'
import {
  FEEDBACK_CATEGORIES,
  feedbackCategoryLabel,
  submitFeedback,
  type FeedbackCategory,
} from '../../lib/feedback'
import type { Section } from '../../lib/timetable/types'

interface FeedbackPanelProps {
  section: Section
}

export function FeedbackPanel({ section }: FeedbackPanelProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [category, setCategory] = useState<FeedbackCategory>('general')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const sectionLabel = `${section.departmentCode} Semester ${section.semester} - Section ${section.sectionName}`
  const activeRating = hoverRating || rating
  const benefits: { label: string; icon: LucideIcon }[] = [
    { label: 'Report timetable mistakes', icon: CheckCircle2 },
    { label: 'Suggest a new feature', icon: Lightbulb },
    { label: 'No account needed', icon: ShieldCheck },
  ]
  const canSubmit =
    hasSupabaseConfig && rating > 0 && message.trim().length >= 3 && !busy

  const resetForm = () => {
    setRating(0)
    setHoverRating(0)
    setCategory('general')
    setMessage('')
    setError(null)
    setSubmitted(false)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await submitFeedback({
        rating,
        category,
        message,
        sectionKey: section.key,
        departmentCode: section.departmentCode,
      })
      setSubmitted(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send feedback.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="glass-panel rounded-3xl p-6">
        <span className="grid size-11 place-items-center rounded-2xl border border-brand-400/20 bg-brand-400/10">
          <MessageSquareText className="size-5 text-brand-300" aria-hidden="true" />
        </span>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300/80">
          Feedback
        </p>
        <h2 className="font-display mt-1 text-2xl font-semibold text-white">
          Help improve TrackClass
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Found a wrong slot, a missing room, or have an idea for the app? Send a
          quick note to the timetable team.
        </p>

        <div className="mt-6 space-y-3">
          {benefits.map(({ label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2.5 text-xs text-slate-400">
              <Icon className="size-4 text-accent-300" aria-hidden="true" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Sending from
          </p>
          <p className="mt-1 text-sm font-medium text-white">{sectionLabel}</p>
        </div>
      </section>

      <section className="glass-panel rounded-3xl p-6">
        <AnimatePresence mode="wait" initial={false}>
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex min-h-[420px] flex-col items-center justify-center text-center"
              aria-live="polite"
            >
              <span className="grid size-14 place-items-center rounded-full border border-accent-400/25 bg-accent-400/10">
                <CheckCircle2 className="size-7 text-accent-300" aria-hidden="true" />
              </span>
              <h2 className="font-display mt-5 text-2xl font-semibold text-white">
                Feedback sent
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                Thanks for helping improve TrackClass. The timetable team can now
                review your note.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500">
                <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1">
                  {feedbackCategoryLabel(category)}
                </span>
                <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1">
                  {rating}/5 rating
                </span>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-brand-400/30 hover:text-white"
              >
                Send another
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={onSubmit}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Step 1
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  How is your experience?
                </h2>
                <div
                  role="radiogroup"
                  aria-label="Rating"
                  className="mt-3 flex items-center gap-1.5"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={rating === value}
                      aria-label={`${value} star${value === 1 ? '' : 's'}`}
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHoverRating(value)}
                      onMouseLeave={() => setHoverRating(0)}
                      className={`rounded-xl p-1.5 transition ${
                        value <= activeRating
                          ? 'text-amber-400'
                          : 'text-slate-600 hover:text-amber-300'
                      }`}
                    >
                      <Star
                        className="size-7"
                        fill={value <= activeRating ? 'currentColor' : 'none'}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs text-slate-500">
                    {activeRating ? `${activeRating}/5` : 'Pick a rating'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Step 2
                </p>
                <p className="mt-1 text-sm font-medium text-white">What is this about?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FEEDBACK_CATEGORIES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={category === item.value}
                      onClick={() => setCategory(item.value)}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        category === item.value
                          ? 'border-brand-400/40 bg-brand-400/10 text-brand-200'
                          : 'border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.14] hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-end justify-between gap-3">
                  <label
                    htmlFor="feedback-message"
                    className="text-sm font-medium text-white"
                  >
                    Your feedback
                  </label>
                  <span className="text-[10px] text-slate-500">{message.length}/1200</span>
                </div>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1200}
                  rows={5}
                  placeholder="Tell us what happened or what would make TrackClass better..."
                  className="mt-2 w-full resize-y rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-600 transition focus:border-brand-400/50 focus:outline-none focus:ring-2 focus:ring-brand-400/15"
                />
              </div>

              {!hasSupabaseConfig ? (
                <p className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2 text-xs text-amber-200">
                  Feedback saving needs Supabase. Add the environment keys and run
                  the feedback migration to enable it.
                </p>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="animate-fade rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
                >
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">
                  Your note is shared with the timetable team.
                </p>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-slate-600"
                >
                  {busy ? 'Sending...' : 'Send feedback'}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}
