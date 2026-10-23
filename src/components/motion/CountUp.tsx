import { useEffect, useRef, useState } from 'react'
import { useInView, useReducedMotion } from 'framer-motion'

interface CountUpProps {
  value: number
  className?: string
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
}

export function CountUp({
  value,
  className,
  duration = 1250,
  decimals = 0,
  prefix = '',
  suffix = '',
}: CountUpProps) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement | null>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const current = useRef(reduced ? value : 0)
  const [display, setDisplay] = useState(reduced ? value : 0)

  useEffect(() => {
    if (!inView) return

    if (reduced) {
      current.current = value
      setDisplay(value)
      return
    }

    const from = current.current
    const to = value

    if (from === to) {
      setDisplay(to)
      return
    }

    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (to - from) * eased
      current.current = next
      setDisplay(next)

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        current.current = to
        setDisplay(to)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [duration, inView, reduced, value])

  const text = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString('en-US')

  return (
    <span ref={ref} className={className} data-countup-target={value}>
      {prefix}
      {text}
      {suffix}
    </span>
  )
}
