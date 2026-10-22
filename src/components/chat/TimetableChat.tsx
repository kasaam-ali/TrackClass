import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageSquare, Send, Sparkles, Trash2 } from 'lucide-react'
import { useTimetable } from '../../context/TimetableContext'
import { askTimetableAi } from '../../lib/chat/ai'
import {
  clearChatHistory,
  loadChatHistory,
  saveChatHistory,
} from '../../lib/chat/history'
import { resolveChatQuery } from '../../lib/chat/resolver'
import type { ChatMessage, ChatReply } from '../../lib/chat/types'
import type { TimetableSnapshot } from '../../lib/timetable/types'
import { useNow } from '../../lib/useNow'

const SUGGESTIONS = [
  'Meri agli class konsi hai?',
  'Abhi kaunsa room free hai?',
  'Friday ke free slots?',
  'Sir Abid Ali kahan hain?',
]

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toMessage(reply: ChatReply, source: ChatMessage['source']): ChatMessage {
  return {
    id: createId(),
    role: 'assistant',
    text: reply.text,
    cards: reply.cards,
    source,
    createdAt: new Date().toISOString(),
  }
}

interface TimetableChatProps {
  snapshot: TimetableSnapshot
  sectionKey: string
}

export function TimetableChat({ snapshot, sectionKey }: TimetableChatProps) {
  const { meta } = useTimetable()
  const now = useNow()
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory(sectionKey))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    saveChatHistory(sectionKey, messages)
  }, [sectionKey, messages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, busy])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || busy) return

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    }

    setMessages((current) => [...current, userMessage])
    setInput('')
    setBusy(true)

    const localReply = resolveChatQuery(text, { snapshot, sectionKey, meta, now })
    if (localReply) {
      setMessages((current) => [...current, toMessage(localReply, 'local')])
      setBusy(false)
      return
    }

    const aiReply = await askTimetableAi(text, sectionKey, now)
    if (aiReply) {
      setMessages((current) => [...current, toMessage(aiReply, 'ai')])
    } else {
      setMessages((current) => [
        ...current,
        toMessage(
          {
            text: 'Main sirf timetable, rooms, teachers, aur sections ke sawalon ka jawab de sakta hoon. Free rooms, free slots, next class, ya teacher ka naam poochh kar dekhein.',
          },
          'fallback',
        ),
      ])
    }
    setBusy(false)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void send(input)
  }

  return (
    <section className="glass-panel flex flex-col overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-400/30 to-brand-500/20 ring-1 ring-white/[0.08]">
            <Sparkles className="size-4 text-violet-200" aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent-400 ring-2 ring-ink-950" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Timetable assistant
            </h2>
            <p className="text-[10px] text-slate-500">
              Instant local answers, AI fallback when needed
            </p>
          </div>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              clearChatHistory(sectionKey)
              setMessages([])
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-medium text-slate-400 transition hover:border-white/15 hover:text-white"
          >
            <Trash2 className="size-3" aria-hidden="true" />
            Clear chat
          </button>
        ) : null}
      </div>

      <div
        className="max-h-[min(62vh,560px)] min-h-[340px] space-y-3 overflow-y-auto px-4 py-4 sm:px-5"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-4 text-center">
            <span className="grid size-14 place-items-center rounded-3xl border border-violet-400/20 bg-violet-500/10">
              <MessageSquare className="size-6 text-violet-300" aria-hidden="true" />
            </span>
            <h3 className="font-display mt-4 text-lg font-semibold text-white">
              Poochh lein, kuch bhi timetable ka
            </h3>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-slate-500">
              Free rooms, free slots, next class, ya kisi teacher ki location. Jawab offline
              bhi milta hai.
            </p>
          </div>
        ) : null}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  message.role === 'user'
                    ? 'max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-2.5 text-sm text-white shadow-[0_16px_40px_-24px_rgba(14,165,233,0.9)]'
                    : 'max-w-[90%] rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-slate-200'
                }
              >
                <p className="whitespace-pre-line leading-6">{message.text}</p>
                {message.cards && message.cards.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {message.cards.map((card, index) => (
                      <div
                        key={`${message.id}-${index}`}
                        className="rounded-xl border border-white/[0.07] bg-ink-950/60 p-3"
                      >
                        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-brand-300">
                          {card.title}
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {card.lines.map((line, lineIndex) => (
                            <p key={lineIndex} className="text-xs leading-5 text-slate-400">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {message.source === 'ai' ? (
                  <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-slate-600">
                    AI answer
                  </p>
                ) : null}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {busy ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                Soch raha hoon
                <span className="flex items-center gap-0.5">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="size-1 rounded-full bg-brand-400"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        delay: dot * 0.14,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </span>
              </p>
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="border-t border-white/[0.06] px-4 py-4 sm:px-5">
        <div className="scrollbar-none mb-3 flex gap-2 overflow-x-auto pb-0.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={busy}
              onClick={() => {
                void send(suggestion)
              }}
              className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-[10px] text-slate-400 transition hover:border-brand-400/30 hover:bg-brand-400/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. Meri agli class konsi hai?"
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-ink-900/70 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 transition focus:border-brand-400/50 focus:outline-none disabled:opacity-60"
            aria-label="Timetable question"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-white/[0.05] disabled:text-slate-600"
          >
            <Send className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </section>
  )
}
