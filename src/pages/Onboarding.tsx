import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, Check, RefreshCw } from 'lucide-react'
import { Reveal, Stagger, StaggerItem } from '../components/motion/Reveal'
import { PageShell } from '../components/PageShell'
import { LoadingPanel } from '../components/ui/LoadingState'
import { useProfile } from '../context/ProfileContext'
import { useTimetable } from '../context/TimetableContext'
import type { Section, TimetableSnapshot } from '../lib/timetable/types'

interface SectionPickerProps {
  snapshot: TimetableSnapshot
  initialSection: Section | null
  hasExistingProfile: boolean
  onConfirm: (departmentCode: string, sectionKey: string) => void
}

function SectionPicker({
  snapshot,
  initialSection,
  hasExistingProfile,
  onConfirm,
}: SectionPickerProps) {
  const [departmentCode, setDepartmentCode] = useState(
    initialSection?.departmentCode ?? '',
  )
  const [semester, setSemester] = useState<number | null>(
    initialSection?.semester ?? null,
  )
  const [sectionKey, setSectionKey] = useState(initialSection?.key ?? '')

  const departments = snapshot.departments
  const departmentSections = useMemo(
    () => snapshot.sections.filter((section) => section.departmentCode === departmentCode),
    [snapshot.sections, departmentCode],
  )
  const semesters = useMemo(
    () => [...new Set(departmentSections.map((section) => section.semester))].sort((a, b) => a - b),
    [departmentSections],
  )
  const visibleSections = useMemo(
    () => departmentSections.filter((section) => section.semester === semester),
    [departmentSections, semester],
  )
  const selectedSection = snapshot.sections.find((section) => section.key === sectionKey)
  const selectedDepartment = departments.find(
    (department) => department.code === departmentCode,
  )

  const chooseDepartment = (code: string) => {
    setDepartmentCode(code)
    setSemester(null)
    setSectionKey('')
  }

  const chooseSemester = (value: number) => {
    setSemester(value)
    setSectionKey('')
  }

  return (
    <div className="space-y-4">
      <Reveal>
        <section className="glass-panel rounded-3xl p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300/80">
                Step 1
              </p>
              <h2 className="font-display mt-1 text-lg font-semibold text-white">Department</h2>
            </div>
            <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-slate-500">
              {departments.length} available
            </span>
          </div>
          <Stagger className="grid gap-3 sm:grid-cols-3">
            {departments.map((department) => {
              const count = snapshot.sections.filter(
                (section) => section.departmentCode === department.code,
              ).length
              const active = departmentCode === department.code
              return (
                <StaggerItem key={department.code} className="h-full">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseDepartment(department.code)}
                    className={clsx(
                      'relative h-full w-full overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5',
                      active
                        ? 'border-brand-400/40 bg-brand-400/[0.08] shadow-[0_0_40px_-24px_rgba(56,189,248,0.9)]'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] hover:shadow-[0_16px_40px_-32px_rgba(15,23,42,0.8)]',
                    )}
                  >
                    {active ? (
                      <span
                        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span
                      className={clsx(
                        'font-display text-base font-semibold',
                        active ? 'text-brand-200' : 'text-white',
                      )}
                    >
                      {department.code}
                    </span>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-400">
                      {department.name}
                    </span>
                    <span className="mt-2 block text-[10px] text-slate-500">
                      {count} sections
                    </span>
                  </button>
                </StaggerItem>
              )
            })}
          </Stagger>
        </section>
      </Reveal>

      {departmentCode ? (
        <Reveal>
          <section className="glass-panel rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300/80">
                  Step 2
                </p>
                <h2 className="font-display mt-1 text-lg font-semibold text-white">Semester</h2>
              </div>
              <span className="text-[10px] text-slate-500">{semesters.length} semesters</span>
            </div>
            <Stagger className="flex flex-wrap gap-2" staggerChildren={0.035}>
              {semesters.map((value) => (
                <StaggerItem key={value}>
                  <button
                    type="button"
                    aria-pressed={semester === value}
                    onClick={() => chooseSemester(value)}
                    className={clsx(
                      'rounded-xl border px-4 py-2 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5',
                      semester === value
                        ? 'border-brand-400/40 bg-brand-400/10 text-brand-200'
                        : 'border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/[0.14] hover:text-white',
                    )}
                  >
                    Semester {value}
                  </button>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        </Reveal>
      ) : null}

      {semester !== null && departmentCode ? (
        <Reveal>
          <section className="glass-panel rounded-3xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-300/80">
                  Step 3
                </p>
                <h2 className="font-display mt-1 text-lg font-semibold text-white">Section</h2>
              </div>
              <span className="text-[10px] text-slate-500">
                {visibleSections.length} sections
              </span>
            </div>
            <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSections.map((section) => {
                const active = sectionKey === section.key
                return (
                  <StaggerItem key={section.key} className="h-full">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSectionKey(section.key)}
                      className={clsx(
                        'flex h-full w-full items-start justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5',
                        active
                          ? 'border-brand-400/40 bg-brand-400/[0.08]'
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] hover:shadow-[0_16px_40px_-32px_rgba(15,23,42,0.8)]',
                      )}
                    >
                      <span>
                        <span
                          className={clsx(
                            'block text-sm font-semibold',
                            active ? 'text-brand-200' : 'text-white',
                          )}
                        >
                          Section {section.sectionName}
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-400">
                          Semester {section.semester} - {section.batchLabel}
                        </span>
                      </span>
                      {active ? (
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-brand-300"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  </StaggerItem>
                )
              })}
            </Stagger>
          </section>
        </Reveal>
      ) : null}

      <Reveal delay={0.05}>
        <div className="glass-panel-strong flex flex-col gap-3 rounded-3xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Selected
            </p>
            <p className="mt-1 text-sm font-medium text-white">
              {selectedSection && selectedDepartment
                ? `${selectedDepartment.code} - Semester ${selectedSection.semester} - Section ${selectedSection.sectionName} (${selectedSection.batchLabel})`
                : 'Pick a department, semester, and section'}
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedSection}
            onClick={() => {
              if (!selectedSection) return
              onConfirm(selectedSection.departmentCode, selectedSection.key)
            }}
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-slate-600"
          >
            {hasExistingProfile ? 'Save section' : 'Open my timetable'}
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        </div>
      </Reveal>
    </div>
  )
}

export function Onboarding() {
  const navigate = useNavigate()
  const { profile, setProfile } = useProfile()
  const { snapshot, loading, error, reload } = useTimetable()

  if (loading) {
    return (
      <PageShell
        eyebrow="Get started"
        title="Select your section"
        subtitle="Loading the latest timetable."
      >
        <LoadingPanel
          label="Loading sections..."
          detail="Reading departments, semesters, and sections."
          rows={4}
        />
      </PageShell>
    )
  }

  if (!snapshot) {
    return (
      <PageShell
        eyebrow="Get started"
        title="Select your section"
        subtitle="The timetable is not available yet."
      >
        <div className="glass-panel rounded-2xl p-6">
          <p className="text-sm text-slate-400">{error ?? 'No timetable has been published yet.'}</p>
          <button
            type="button"
            onClick={() => {
              void reload()
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-400/30 hover:text-white"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      </PageShell>
    )
  }

  const initialSection =
    snapshot.sections.find((section) => section.key === profile?.sectionKey) ?? null

  return (
    <PageShell
      eyebrow="Get started"
      title="Pick your section"
      subtitle="Choose department, semester, and section once. The app remembers it on this device."
    >
      <SectionPicker
        snapshot={snapshot}
        initialSection={initialSection}
        hasExistingProfile={Boolean(profile)}
        onConfirm={(departmentCode, sectionKey) => {
          setProfile({ departmentCode, sectionKey })
          navigate('/', { replace: true })
        }}
      />
    </PageShell>
  )
}
