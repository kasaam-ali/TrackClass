import {
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Variants,
} from 'framer-motion'
import type { ReactNode } from 'react'

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  amount?: number
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 12,
  amount = 0.18,
}: RevealProps) {
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps {
  children: ReactNode
  className?: string
  delayChildren?: number
  staggerChildren?: number
  amount?: number
}

export function Stagger({
  children,
  className,
  delayChildren = 0.04,
  staggerChildren = 0.055,
  amount = 0.12,
}: StaggerProps) {
  const reduced = useReducedMotion()
  const variants: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren, delayChildren },
    },
  }

  return (
    <motion.div
      className={className}
      initial={reduced ? false : 'hidden'}
      whileInView={reduced ? undefined : 'show'}
      viewport={{ once: true, amount }}
      variants={reduced ? undefined : variants}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps {
  children: ReactNode
  className?: string
  whileHover?: TargetAndTransition
}

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: EASE },
  },
}

export function StaggerItem({ children, className, whileHover }: StaggerItemProps) {
  return (
    <motion.div className={className} variants={item} whileHover={whileHover}>
      {children}
    </motion.div>
  )
}
