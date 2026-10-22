export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950"
    >
      <div className="aurora-one absolute -left-40 -top-52 size-[42rem] rounded-full bg-brand-500/10 blur-[130px]" />
      <div className="aurora-two absolute -right-52 top-24 size-[38rem] rounded-full bg-violet-500/10 blur-[140px]" />
      <div className="aurora-three absolute bottom-[-22rem] left-1/2 size-[50rem] rounded-full bg-accent-500/10 blur-[150px]" />
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="ambient-vignette absolute inset-0" />
    </div>
  )
}
