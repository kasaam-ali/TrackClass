import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from 'framer-motion'
import type { PointerEvent, ReactNode } from 'react'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  radius?: number
  color?: string
}

export function SpotlightCard({
  children,
  className = '',
  radius = 520,
  color = 'rgba(99, 102, 241, 0.26)',
}: SpotlightCardProps) {
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const background = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, ${color}, transparent 80%)`
  const staticBackground = `radial-gradient(${radius}px circle at 50% 0%, ${color}, transparent 80%)`

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (reduced) return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set(event.clientX - rect.left)
    y.set(event.clientY - rect.top)
  }

  return (
    <section data-spotlight className={`group ${className}`} onPointerMove={handlePointerMove}>
      <motion.div
        aria-hidden="true"
        data-spotlight-overlay
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={reduced ? { background: staticBackground } : { background }}
      />
      {children}
    </section>
  )
}
