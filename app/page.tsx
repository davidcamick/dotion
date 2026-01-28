'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CalendarView from './components/CalendarView'
import MarkdownText from './components/MarkdownText'
import LoginView from './components/LoginView'
import CalendarEventCard from './components/CalendarEventCard'
import SlotPicker from './components/SlotPicker'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolData?: {
    type: 'event' | 'slots'
    // Event data
    eventType?: string
    eventId?: string
    summary?: string
    start?: string
    end?: string
    location?: string
    originalEvent?: any
    // Slot data
    slots?: Array<{
        start: string
        end: string
        label?: string
    }>
  }
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
  const [hoveredSlot, setHoveredSlot] = useState<{ start: string, end: string, label?: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [promptIndex, setPromptIndex] = useState(0)
  const prompts = [
    "What's my schedule tomorrow?",
    "Where could I fit in an hour study break?",
    "When could I eat breakfast on Friday?",
    "Clear my afternoon for deep work.",
    "Move my 2pm meeting to tomorrow.",
    "Schedule a team sync for next Monday.",
    "Do I have any free time this weekend?",
    "Plan a lunch with Sarah next week.",
    "Reschedule everything today to tomorrow.",
    "Find time for a 30-minute nap.",
    "Block out Friday afternoon for learning.",
    "What's the first thing on my agenda?",
  ]

  const cyclePrompts = () => {
    setPromptIndex(prev => (prev + 3) % prompts.length)
  }

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
    window.location.reload()
  }

  const handleNewChat = () => {
    setMessages([])
    setInput('')
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

  const mockDevEvent = (type: 'create' | 'update' | 'delete') => {
    const mockData = {
      type: 'event' as const,
      eventType: type,
      eventId: 'mock-' + Date.now(),
      summary: type === 'delete' ? 'Deleted Mission' : type === 'update' ? 'Updated Mission Protocol' : 'Secret Space Mission',
      start: new Date(Date.now() + 86400000).toISOString(),
      end: new Date(Date.now() + 90000000).toISOString(),
      location: 'Lunar Base Alpha',
      originalEvent: type !== 'create' ? {
        summary: 'Original Mission',
        description: 'Test description',
        location: 'Lunar Base Beta',
        start: { dateTime: new Date(Date.now() + 86400000).toISOString() },
        end: { dateTime: new Date(Date.now() + 90000000).toISOString() }
      } : undefined
    }
    
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: `Initiating ${type} sequence protocol.`,
      toolData: mockData
    }])
  }

  const handleSlotSelection = (slot: { start: string, end: string, label?: string }) => {
    // Send a message to the AI that the user selected this slot
    const selectionMessage = `I'll take the slot: ${slot.label ? slot.label + ' ' : ''}${new Date(slot.start).toLocaleString()} - ${new Date(slot.end).toLocaleTimeString()}`
    setInput(selectionMessage)
    // We could auto-submit here, but letting the user confirm/edit is often better. 
    // If you want auto-submit, you'd move the handleSubmit logic to a reusable function and call it here with the message.
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Dev command check
    if (input.trim() === '/dev-ui') {
      mockDevEvent('create')
      setInput('')
      return
    }

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

            // Check for tool result data
            if (parsed.tool_result_data) {
                setMessages(prev => {
                    const updated = [...prev]
                    const lastIndex = updated.length - 1
                    if (updated[lastIndex].role === 'assistant') {
                        // Normalize tool data for events vs slots
                        let normalizedToolData = parsed.tool_result_data;
                        if (parsed.tool_result_data.type && parsed.tool_result_data.eventId) {
                            normalizedToolData = {
                                type: 'event',
                                eventType: parsed.tool_result_data.type,
                                ...parsed.tool_result_data
                            }
                        } else if (parsed.tool_result_data.type === 'slots') {
                             // already in correct format
                        }

                        updated[lastIndex] = {
                            ...updated[lastIndex],
                            toolData: normalizedToolData
                        }
                    }
                    return updated
                })
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

  if (isCalendarLoading) {
    return (
      <div className="min-h-screen bg-space-black flex items-center justify-center">
         <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="rounded-full h-12 w-12 border-t-2 border-b-2 border-space-accent"
         />
      </div>
    )
  }

  if (!isAuthed) {
    return <LoginView onSignIn={handleSignIn} />
  }

  return (
    <main className="min-h-screen">
      <div className="stars"></div>
      <div className="mx-auto flex h-screen w-full flex-col gap-6 px-4 py-6 lg:flex-row relative z-10">
        {/* Chat panel */}
        <motion.section 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex min-h-0 flex-1 flex-col rounded-2xl glass-panel shadow-lg lg:w-1/3 overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
            <div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                  <h1 className="text-2xl font-light text-white tracking-wide">DOTION <span className="font-bold text-space-accent">AI</span></h1>
                  <p className="text-gray-400 text-sm font-light">notion plus david and ai = dotion</p>
              </motion.div>
            </div>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="flex items-center gap-4"
            >
                <div className="flex bg-black/30 rounded-lg p-1 border border-white/10">
                    <button
                    onClick={() => mockDevEvent('create')}
                    className="text-[10px] uppercase tracking-widest text-space-accent/70 hover:text-space-accent hover:bg-space-accent/10 px-2 py-1 rounded transition-colors"
                    >
                    Add
                    </button>
                    <div className="w-px bg-white/10 mx-1"></div>
                    <button
                    onClick={() => mockDevEvent('update')}
                    className="text-[10px] uppercase tracking-widest text-orange-400/70 hover:text-orange-400 hover:bg-orange-400/10 px-2 py-1 rounded transition-colors"
                    >
                    Mod
                    </button>
                    <div className="w-px bg-white/10 mx-1"></div>
                    <button
                    onClick={() => mockDevEvent('delete')}
                    className="text-[10px] uppercase tracking-widest text-red-400/70 hover:text-red-400 hover:bg-red-400/10 px-2 py-1 rounded transition-colors"
                    >
                    Del
                    </button>
                </div>

                <div className="h-8 w-px bg-white/10"></div>

                <button
                    onClick={handleNewChat}
                    className="h-10 w-10 flex items-center justify-center rounded-full bg-space-accent/10 border border-space-accent/30 text-space-accent hover:bg-space-accent/20 hover:scale-105 transition-all shadow-[0_0_10px_rgba(0,240,255,0.1)] group"
                    title="New Conversation"
                >
                    <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
            </motion.div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500 mb-2">
                    System Online
                  </h2>
                  <p className="text-gray-400 font-light">
                    Initiate protocol...
                  </p>

                  <div className="mt-8 grid grid-cols-1 gap-2 max-w-sm mx-auto">
                    {prompts.slice(promptIndex, promptIndex + 3).map((prompt, i) => (
                      <motion.button
                        key={`${promptIndex}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => setInput(prompt)}
                        className="text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-space-accent/30 hover:shadow-[0_0_10px_rgba(0,240,255,0.1)] transition-all text-sm text-gray-300 hover:text-white group"
                      >
                         <span className="text-space-accent/50 group-hover:text-space-accent mr-2">›</span>
                         {prompt}
                      </motion.button>
                    ))}
                    
                    <button 
                        onClick={cyclePrompts}
                        className="flex items-center justify-center gap-2 mt-2 text-xs text-gray-500 hover:text-space-accent transition-colors"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Cycle Protocols
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                layout
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`rounded-2xl px-6 py-4 backdrop-blur-sm ${
                    message.role === 'user'
                      ? 'bg-space-accent/20 border border-space-accent/30 text-white shadow-[0_0_15px_rgba(0,240,255,0.1)] max-w-3xl'
                      : `bg-white/5 border border-white/10 text-gray-100 ${message.toolData ? 'w-full' : 'max-w-3xl'}`
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="flex flex-col gap-2">
                      <MarkdownText content={message.content} />
                      {message.toolData && message.toolData.type === 'event' && (
                        <CalendarEventCard 
                            type={message.toolData.eventType as any}
                            eventId={message.toolData.eventId!}
                            summary={message.toolData.summary!}
                            start={message.toolData.start!}
                            end={message.toolData.end}
                            location={message.toolData.location}
                            originalEvent={message.toolData.originalEvent}
                            onUndo={refreshCalendar}
                        />
                      )}
                      
                      {message.toolData && message.toolData.type === 'slots' && message.toolData.slots && (
                        <SlotPicker 
                            slots={message.toolData.slots}
                            onSelect={handleSlotSelection}
                            onHover={setHoveredSlot}
                        />
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t border-white/10 bg-white/5">
            <form onSubmit={handleSubmit} className="flex gap-4">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type command..."
                disabled={isLoading}
                className="flex-1 rounded-xl px-6 py-4 bg-black/20 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-space-accent/50 focus:bg-black/40 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-8 py-4 bg-space-accent/10 border border-space-accent/30 text-space-accent hover:bg-space-accent/20 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-space-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider text-sm shadow-[0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]"
              >
                {isLoading ? 'Processing...' : 'Send'}
              </button>
            </form>
          </div>
        </motion.section>

        {/* Calendar panel */}
        <motion.aside 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          className="flex min-h-0 flex-col rounded-2xl glass-panel shadow-lg lg:flex-1 overflow-hidden"
        >
          <div className="p-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-light text-white">Schedule</h2>
                <p className="text-sm text-gray-400">Time dilation logs</p>
              </div>
              <button
                onClick={handleSignOut}
                className="text-xs font-semibold text-gray-500 hover:text-red-400 transition-colors uppercase tracking-widest border border-transparent hover:border-red-400/30 px-3 py-1 rounded"
              >
                Disconnect
              </button>
            </div>
            
            <div className="flex gap-2 items-center">
              <div className="flex gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                {[1, 2, 3, 7].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as any)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      viewMode === mode
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {mode === 7 ? 'Week' : mode === 1 ? 'Day' : `${mode} Days`}
                  </button>
                ))}
              </div>
              
              <div className="h-6 w-px bg-white/10"></div>
              
              <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                  disabled={zoomLevel <= 0.5}
                  className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-white/5 transition-colors"
                  title="Zoom out"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <div className="px-2 w-12 text-center text-xs text-gray-400 font-mono">
                  {Math.round(zoomLevel * 100)}%
                </div>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 2))}
                  disabled={zoomLevel >= 2}
                  className="p-1.5 text-gray-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-white/5 transition-colors"
                  title="Zoom in"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            {isCalendarLoading && (
               <div className="absolute inset-0 flex items-center justify-center bg-space-black/50 backdrop-blur-sm z-50">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-space-accent"></div>
               </div>
            )}

            {!isCalendarLoading && calendarError && (
              <div className="p-4">
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {calendarError}
                </div>
              </div>
            )}

            {!isCalendarLoading && !calendarError && (
              <CalendarView 
                  days={getVisibleDays()} 
                  timeZone={calendarTimeZone} 
                  zoomLevel={zoomLevel} 
                  hoveredSlot={hoveredSlot}
              />
            )}
          </div>
        </motion.aside>
      </div>
    </main>
  )
}
