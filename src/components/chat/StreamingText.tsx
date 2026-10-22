import { useEffect, useRef, useState } from 'react'

interface StreamingTextProps {
  text: string
  animate: boolean
  onDone?: () => void
}

export function StreamingText({ text, animate, onDone }: StreamingTextProps) {
  const [visible, setVisible] = useState(animate ? 0 : text.length)
  const doneRef = useRef(onDone)

  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!animate) {
      setVisible(text.length)
      return
    }

    setVisible(0)
    let cursor = 0
    const step = Math.max(1, Math.ceil(text.length / 58))

    const timer = window.setInterval(() => {
      cursor = Math.min(text.length, cursor + step)
      setVisible(cursor)
      if (cursor >= text.length) {
        window.clearInterval(timer)
        doneRef.current?.()
      }
    }, 18)

    return () => window.clearInterval(timer)
  }, [animate, text])

  if (!animate) {
    return <>{text}</>
  }

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, visible)}
        {visible < text.length ? <span className="stream-caret" /> : null}
      </span>
    </>
  )
}
