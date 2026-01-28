'use client'

import { useEffect, useRef, useState } from 'react'
import CalendarView from './components/CalendarView'
import MarkdownText from './components/MarkdownText'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string | null
  location: string
}

interface CalendarDay {
  label: string
  date: string
  isToday?: boolean
  events: CalendarEvent[]
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [isCalendarLoading, setIsCalendarLoading] = useState(true)
  const [calendarTimeZone, setCalendarTimeZone] = useState('UTC')
  const [isAuthed, setIsAuthed] = useState(false)
  const [viewMode, setViewMode] = useState<1 | 2 | 3 | 7>(3)
  const [zoomLevel, setZoomLevel] = useState(1)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const loadCalendar = async () => {
      setIsCalendarLoading(true)
      try {
        const response = await fetch('/api/calendar')
        if (response.status === 401) {
          setIsAuthed(false)
          setCalendarDays([])
          setCalendarError(null)
          return
        }
        if (!response.ok) {
          throw new Error('Failed to load calendar')
        }
        const data = await response.json()
        setIsAuthed(true)
        setCalendarDays(data.days || [])
        setCalendarTimeZone(data.timeZone || 'UTC')
        setCalendarError(null)
      } catch (error) {
        console.error('Calendar error:', error)
        setCalendarError('Unable to load calendar events.')
      } finally {
        setIsCalendarLoading(false)
      }
    }

    loadCalendar()
  }, [])

  const handleSignIn = () => {
    window.location.href = '/api/google/auth'
  }

  const handleSignOut = async () => {
    await fetch('/api/google/logout', { method: 'POST' })
    setIsAuthed(false)
    setCalendarDays([])
  }

  const refreshCalendar = async () => {
    try {
      const response = await fetch('/api/calendar')
      if (response.status === 401) {
        setIsAuthed(false)
        setCalendarDays([])
        return
      }
      if (!response.ok) {
        throw new Error('Failed to load calendar')
      }
      const data = await response.json()
      setIsAuthed(true)
      setCalendarDays(data.days || [])
      setCalendarTimeZone(data.timeZone || 'UTC')
      setCalendarError(null)
    } catch (error) {
      console.error('Calendar refresh error:', error)
    }
  }

  const getVisibleDays = () => {
    if (viewMode === 7) return calendarDays
    
    // Find today's index
    const todayIndex = calendarDays.findIndex(day => day.isToday)
    if (todayIndex === -1) return calendarDays.slice(0, viewMode)
    
    // Center around today
    const before = Math.floor((viewMode - 1) / 2)
    const after = Math.ceil((viewMode - 1) / 2)
    
    let start = todayIndex - before
    let end = todayIndex + after + 1
    
    // Adjust if we're at the edges
    if (start < 0) {
      end += Math.abs(start)
      start = 0
    }
    if (end > calendarDays.length) {
      start -= (end - calendarDays.length)
      end = calendarDays.length
      start = Math.max(0, start)
    }
    
    return calendarDays.slice(start, end)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          calendarEvents: calendarDays,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No reader available')
      }

      let assistantMessage = ''
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const data = trimmed.replace(/^data:\s*/, '')
          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            
            // Check if calendar needs refresh
            if (parsed.refresh_calendar) {
              refreshCalendar()
              continue
            }
            
            const delta = parsed?.choices?.[0]?.delta?.content
            if (delta) {
              assistantMessage += delta
              setMessages(prev => {
                if (prev.length === 0) {
                  return [{ role: 'assistant', content: assistantMessage }]
                }
                const updated = [...prev]
                const lastIndex = updated.length - 1
                if (updated[lastIndex].role === 'assistant') {
                  updated[lastIndex] = {
                    ...updated[lastIndex],
                    content: assistantMessage,
                  }
                } else {
                  updated.push({ role: 'assistant', content: assistantMessage })
                }
                return updated
              })
            }
          } catch (error) {
            console.error('Stream parse error:', error)
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="mx-auto flex h-screen w-full flex-col gap-6 px-4 py-6 lg:flex-row">
        {/* Chat panel */}
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-700 bg-gray-900/60 shadow-lg lg:w-1/3">
          {/* Header */}
          <div className="p-6 border-b border-gray-700">
            <h1 className="text-2xl font-bold text-white">Dotion Chat</h1>
            <p className="text-gray-400 text-sm">A minimal ChatGPT wrapper</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Start a conversation
                  </h2>
                  <p className="text-gray-400">
                    Type a message below to chat with ChatGPT
                  </p>
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-3xl rounded-2xl px-6 py-4 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownText content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t border-gray-700">
            <form onSubmit={handleSubmit} className="flex gap-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 rounded-full px-6 py-4 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-8 py-4 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </section>

        {/* Calendar panel */}
        <aside className="flex min-h-0 flex-col rounded-2xl border border-gray-700 bg-gray-900/60 shadow-lg lg:flex-1">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Calendar</h2>
                <p className="text-sm text-gray-400">This week's schedule</p>
              </div>
              {isAuthed ? (
                <button
                  onClick={handleSignOut}
                  className="text-xs font-semibold text-gray-300 hover:text-white"
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="text-xs font-semibold text-blue-300 hover:text-blue-200"
                >
                  Sign in
                </button>
              )}
            </div>
            
            {isAuthed && (
              <div className="flex gap-2 items-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode(1)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      viewMode === 1
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Day
                  </button>
                  <button
                    onClick={() => setViewMode(2)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      viewMode === 2
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    2 Days
                  </button>
                  <button
                    onClick={() => setViewMode(3)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      viewMode === 3
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    3 Days
                  </button>
                  <button
                    onClick={() => setViewMode(7)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      viewMode === 7
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Week
                  </button>
                </div>
                
                <div className="h-6 w-px bg-gray-600"></div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                    disabled={zoomLevel <= 0.5}
                    className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-gray-700"
                    title="Zoom out"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-white font-mono rounded hover:bg-gray-700"
                    title="Reset zoom"
                  >
                    {zoomLevel.toFixed(2)}x
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2))}
                    disabled={zoomLevel >= 2}
                    className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-gray-700"
                    title="Zoom in"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {!isAuthed && !isCalendarLoading && (
              <div className="p-4">
                <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
                  Sign in to view your calendar events.
                </div>
              </div>
            )}

            {isAuthed && isCalendarLoading && (
              <div className="p-4 text-gray-400">Loading events…</div>
            )}

            {isAuthed && !isCalendarLoading && calendarError && (
              <div className="p-4">
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {calendarError}
                </div>
              </div>
            )}

            {isAuthed && !isCalendarLoading && !calendarError && (
              <CalendarView days={getVisibleDays()} timeZone={calendarTimeZone} zoomLevel={zoomLevel} />
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
