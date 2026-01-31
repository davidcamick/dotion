'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CalendarView from './components/CalendarView'
import MarkdownText from './components/MarkdownText'
import LoginView from './components/LoginView'
import CalendarEventCard from './components/CalendarEventCard'
import SlotPicker from './components/SlotPicker'
import RecentAppsView from './components/RecentAppsView'
import AppControlCard from './components/AppControlCard'

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolData?: {
    type: 'event' | 'slots' | 'launch_app' | 'manage_app' | 'list_apps'
    // Event data
    eventType?: string
    eventId?: string
    summary?: string
    start?: string
    end?: string
    location?: string
    // App data
    appName?: string
    action?: 'launch' | 'quit' | 'minimize' | 'focus'
    apps?: string[]
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
  
  // UI States for App Mode
  const [appMode, setAppMode] = useState<'bar' | 'chat' | 'calendar' | 'launcher'>('bar')
  const [showCalendar, setShowCalendar] = useState(false)
  const [launchedApps, setLaunchedApps] = useState<string[]>([])

  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [focusedDate, setFocusedDate] = useState(new Date()) // Target date for view
  
  // Resize Effect based on Mode
  useEffect(() => {
    // Check if running in Electron 
    if ((window as any).electron) {
        if (appMode === 'bar') {
            (window as any).electron.resizeWindow(750, 80)
        } else if (appMode === 'chat') {
            (window as any).electron.resizeWindow(750, 600)
        } else if (appMode === 'calendar') {
            (window as any).electron.resizeWindow(1150, 600)
        } else if (appMode === 'launcher') {
            (window as any).electron.resizeWindow(950, 600)
        }
    }
  }, [appMode])

  // Automatically switch to chat mode if there are messages
  useEffect(() => {
    if (messages.length > 0 && appMode === 'bar') {
        setAppMode('chat')
    }
  }, [messages])
  
  // Detect context to switch views
  useEffect(() => {
    // Check the most recent tool usage to decide view
    const lastToolMsg = [...messages].reverse().find(m => m.toolData)
    
    if (lastToolMsg?.toolData) {
        if (lastToolMsg.toolData.type === 'manage_app') {
             if (lastToolMsg.toolData.action === 'launch' && appMode !== 'launcher') {
                  setAppMode('launcher')
             }
        } else if (lastToolMsg.toolData.type === 'launch_app' || lastToolMsg.toolData.type === 'list_apps') {
             if (appMode !== 'launcher') setAppMode('launcher')
        } else {
             // events or slots
             if (appMode !== 'calendar') {
                 setAppMode('calendar')
                 setShowCalendar(true)
             }
        }
    }
  }, [messages])

  // Poll for running apps always if Electron
  useEffect(() => {
     let interval: NodeJS.Timeout;
     if ((window as any).electron) {
        const fetchApps = async () => {
            const apps = await (window as any).electron.getRunningApps();
            if (Array.isArray(apps)) {
                setLaunchedApps(apps);
            }
        };
        fetchApps();
        interval = setInterval(fetchApps, 5000); // Poll every 5s
     }
     return () => clearInterval(interval);
  }, [])

  const [isFetchingMore, setIsFetchingMore] = useState(false)

  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [isCalendarLoading, setIsCalendarLoading] = useState(true)
  const [calendarTimeZone, setCalendarTimeZone] = useState('UTC')
  const [isAuthed, setIsAuthed] = useState(false)
  const [viewMode, setViewMode] = useState<1 | 2 | 3 | 7>(3)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [hoveredSlot, setHoveredSlot] = useState<{ start: string, end: string, label?: string } | null>(null)
  const [recentlyModifiedEventId, setRecentlyModifiedEventId] = useState<string | undefined>(undefined)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedEventId) {
            setSelectedEventId(null)
            return
        }
        
        if (input.length > 0) {
             setInput('')
             return
        }

        if (appMode !== 'bar') {
            handleNewChat() // Reusing the full reset logic
            return
        }

        if ((window as any).electron) {
            (window as any).electron.hideWindow()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [input, appMode, selectedEventId])

  const fetchCalendarData = async (targetDate?: Date) => {
    const dateStr = (targetDate || focusedDate).toISOString().split('T')[0]
    
    try {
      const response = await fetch(`/api/calendar?date=${dateStr}`)
      if (response.status === 401) {
        setIsAuthed(false)
        setCalendarDays([])
        return
      }
      if (!response.ok) throw new Error('Failed to load calendar')
      
      const data = await response.json()
      setIsAuthed(true)
      setCalendarDays(data.days || [])
      setCalendarTimeZone(data.timeZone || 'UTC')
      setCalendarError(null)
    } catch (error) {
      console.error('Calendar load error:', error)
      setCalendarError('Unable to load calendar events.')
    }
  }

  const [lastActivity, setLastActivity] = useState(Date.now())

  // Reset chat after 1 minute of inactivity
  useEffect(() => {
    const checkActivity = setInterval(() => {
        if (Date.now() - lastActivity > 60000 && appMode !== 'bar') {
            handleNewChat()
        }
    }, 5000)

    const updateActivity = () => setLastActivity(Date.now())
    
    window.addEventListener('mousemove', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('click', updateActivity)

    return () => {
        clearInterval(checkActivity)
        window.removeEventListener('mousemove', updateActivity)
        window.removeEventListener('keydown', updateActivity)
        window.removeEventListener('click', updateActivity)
    }
  }, [lastActivity, appMode])

  useEffect(() => {
    const init = async () => {
      setIsCalendarLoading(true)
      await fetchCalendarData()
      setIsCalendarLoading(false)
    }
    init()
  }, [])

  const handleNavigate = (direction: 'prev' | 'next') => {
    const daysToAdd = viewMode === 7 ? 7 : (viewMode === 1 ? 1 : viewMode)
    const delta = direction === 'next' ? daysToAdd : -daysToAdd
    
    const newDate = new Date(focusedDate)
    newDate.setDate(newDate.getDate() + delta)
    setFocusedDate(newDate)
    
    // Check if we need to fetch more data
    const year = newDate.getFullYear()
    const month = String(newDate.getMonth() + 1).padStart(2, '0')
    const day = String(newDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    // Check if date is within our current data range (with some buffer)
    const isInRange = calendarDays.some(d => d.date === dateStr)
    
    if (!isInRange) {
        setIsFetchingMore(true)
        fetchCalendarData(newDate).finally(() => setIsFetchingMore(false))
    }
  }

  const handleToday = () => {
    const now = new Date()
    setFocusedDate(now)
    fetchCalendarData(now)
  }

  const handleSignIn = () => {
    // Open in new window to trigger Electron's setWindowOpenHandler
    window.open('/api/google/auth', '_blank')
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
    setAppMode('bar')
    setSelectedEventId(null)
    setShowCalendar(false)
  }

  const refreshCalendar = async () => {
     await fetchCalendarData()
  }

  const getVisibleDays = () => {
    // If we have no data, return empty
    if (calendarDays.length === 0) return []

    // If hovering a slot outside current view, temporarily snap to it?
    let targetDate = focusedDate
    if (hoveredSlot) {
        const slotDate = new Date(hoveredSlot.start)
        // Check if slotDate is outside current visible range
        // For simplicity, just override targetDate if valid
        if (!isNaN(slotDate.getTime())) {
            targetDate = slotDate
        }
    }

    // Construct local YYYY-MM-DD to match calendarDays format
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const targetDateStr = `${year}-${month}-${day}`
    
    // Find index of target date
    const targetIndex = calendarDays.findIndex(day => day.date === targetDateStr)
    
    // If not found (e.g. data fetching lag), try to find closest
    let centerIndex = targetIndex
    if (targetIndex === -1) {
       // Just pick middle of array or fallback to today
       // Or filtering by searching closest date?
       // Let's assume data is sorted.
       // Find closest date
       let minDiff = Infinity
       calendarDays.forEach((day, idx) => {
           const d = new Date(day.date)
           const diff = Math.abs(d.getTime() - targetDate.getTime())
           if (diff < minDiff) {
               minDiff = diff
               centerIndex = idx
           }
       })
    }

    if (viewMode === 7) {
        // For week view, align to start of week (Sunday) based on targetDate
        const d = new Date(targetDate)
        const dayOfWeek = d.getDay() // 0 = Sunday
        // We want to start 'dayOfWeek' days before the targetDate to align?
        // Actually, if we are in week view, we usually want to see the whole week containing the date.
        // Let's just create a window. Since our API returns "start of week", maybe we align to that?
        // But the user might be navigating freely. 
        // Let's just try to center or start the week properly.
        
        // Find the Sunday before or on the target date
        // Since we don't have infinite data, we just find the closest previous Sunday in our list
        // Or simpler: just show 7 days starting from targetDate's start-of-week
        const startOffset = d.getDay()
        let startIndex = centerIndex - startOffset
        if (startIndex < 0) startIndex = 0
        return calendarDays.slice(startIndex, startIndex + 7)
    }
    
    // For 1, 2, 3 days
    // Show 'viewMode' days starting from targetDate? Or centered?
    // "Single day view" -> show targetDate.
    // "3 day view" -> maybe today + next 2 days?
    let start = centerIndex
    let end = centerIndex + viewMode
    
    if (end > calendarDays.length) {
       start = Math.max(0, calendarDays.length - viewMode)
       end = calendarDays.length
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

  const handleCopyChat = () => {
    const chatLog = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}${m.toolData ? `\n[TOOL DATA]: ${JSON.stringify(m.toolData, null, 2)}` : ''}`).join('\n\n---\n\n')
    navigator.clipboard.writeText(chatLog)
  }

  const handleSlotSelection = (slot: { start: string, end: string, label?: string }) => {
    // Send a message to the AI that the user selected this slot
    const selectionMessage = `I'll take the slot: ${slot.label ? slot.label + ' ' : ''}${new Date(slot.start).toLocaleString()} - ${new Date(slot.end).toLocaleTimeString()}`
    setInput(selectionMessage)
    // We could auto-submit here, but letting the user confirm/edit is often better. 
    // If you want auto-submit, you'd move the handleSubmit logic to a reusable function and call it here with the message.
  }

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(prev => prev === eventId ? null : eventId)
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

    let messageContent = input
    
    // Add context if event is selected
    if (selectedEventId) {
      const allEvents = calendarDays.flatMap(d => d.events)
      const selectedEvent = allEvents.find(e => e.id === selectedEventId)
      if (selectedEvent) {
          messageContent = `[Context: User selected event ID: ${selectedEvent.id}, Summary: "${selectedEvent.summary}"]\n${input}`
      }
    }

    const userMessage: Message = { role: 'user', content: messageContent }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    // Clear selection after sending? Maybe keep it for follow-up? 
    // Usually modifying it once clears the ambiguity, but keeping it allows "move it again".
    // Let's keep it selected until user unselects or selects another.

    // Filter relevant events to reduce token usage and noise for the AI
    // Send 3 days of past history and 21 days of future
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const pastLimit = new Date(now);
    pastLimit.setDate(now.getDate() - 3);
    const futureLimit = new Date(now);
    futureLimit.setDate(now.getDate() + 21);

    const relevantCalendarEvents = calendarDays.filter(day => {
        const dayDate = new Date(day.date);
        return dayDate >= pastLimit && dayDate <= futureLimit;
    });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          calendarEvents: relevantCalendarEvents,
          runningApps: launchedApps, // Pass the known running apps
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
          // Log the full AI response chunk
          console.log('%c AI Stream Data:', 'color: #00f0ff; font-weight: bold;', data)

          if (data === '[DONE]') {
            return
          }

          try {
            const parsed = JSON.parse(data)
            
            // Log parsed object for inspection
            console.log('Parsed chunk:', parsed)

            // Check if calendar needs refresh
            if (parsed.refresh_calendar) {
              console.log('Triggering calendar refresh')
              refreshCalendar()
              continue
            }

            // Check for tool result data
            if (parsed.tool_result_data) {
                console.log('Received tool data:', parsed.tool_result_data)

                if (parsed.tool_result_data.type === 'manage_app' && (window as any).electron) {
                    (window as any).electron.manageApp(parsed.tool_result_data.appName, parsed.tool_result_data.action);
                    if (parsed.tool_result_data.action === 'launch') {
                         setLaunchedApps(prev => [...prev, parsed.tool_result_data.appName])
                    }
                } else if (parsed.tool_result_data.type === 'launch_app' && (window as any).electron) {
                     // Backward compatibility just in case
                    (window as any).electron.launchApp(parsed.tool_result_data.appName);
                    setLaunchedApps(prev => [...prev, parsed.tool_result_data.appName])
                } else if (parsed.tool_result_data.type === 'list_apps') {
                    // Update the list immediately from server data just in case
                    if (Array.isArray(parsed.tool_result_data.apps)) {
                        setLaunchedApps(parsed.tool_result_data.apps)
                    }
                }

                setMessages(prev => {
                    const updated = [...prev]
                    const lastIndex = updated.length - 1
                    if (updated[lastIndex].role === 'assistant') {
                        // Normalize tool data for events vs slots
                        let normalizedToolData = parsed.tool_result_data;
                        if (parsed.tool_result_data.type && (parsed.tool_result_data.eventId || parsed.tool_result_data.type === 'create')) { 
                            // Ensure 'create' type is caught even if eventId is missing (though it shouldn't be)
                            // The backend sends 'create', 'update', 'delete' as type.
                            normalizedToolData = {
                                ...parsed.tool_result_data,
                                eventType: parsed.tool_result_data.type,
                                type: 'event'
                            }
                            
                            // Set modified event ID for shimmer effect
                            if (parsed.tool_result_data.eventId) {
                                console.log('Setting modified event ID:', parsed.tool_result_data.eventId);
                                setRecentlyModifiedEventId(parsed.tool_result_data.eventId);
                                // Clear after 15 seconds
                                setTimeout(() => setRecentlyModifiedEventId(undefined), 15000);
                            }
                        } else if (parsed.tool_result_data.type === 'slots') {
                             // already in correct format
                        }
                        
                        console.log('Setting tool data on message:', normalizedToolData)

                        updated[lastIndex] = {
                            ...updated[lastIndex],
                            toolData: normalizedToolData
                        }
                    } else {
                        console.warn('Last message was not assistant, appending new message for tool data')
                        updated.push({
                            role: 'assistant',
                            content: '',
                            toolData: parsed.tool_result_data.type === 'slots' ? parsed.tool_result_data : {
                                ...parsed.tool_result_data,
                                eventType: parsed.tool_result_data.type,
                                type: 'event'
                            }
                        })
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

  return (
    <main className="h-screen w-screen overflow-hidden bg-transparent">
      {appMode !== 'bar' && <div className="stars"></div>}
      <div className={`mx-auto flex h-full w-full ${(appMode === 'calendar' || appMode === 'launcher') ? 'flex-row gap-6 px-4 py-6' : 'flex-col gap-0 p-0'} relative z-10 transition-all duration-300`}>
        {/* Chat panel */}
        <motion.section 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`flex min-h-0 flex-1 flex-col ${appMode === 'bar' ? 'rounded-lg' : 'rounded-2xl'} glass-panel shadow-lg ${appMode === 'calendar' ? 'w-1/3' : appMode === 'launcher' ? 'w-[70%]' : 'w-full'} overflow-hidden transition-all duration-300`}
        >
          {/* Header */}
          {appMode !== 'bar' && (
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
                    <div className="w-px bg-white/10 mx-1"></div>
                    <button
                    onClick={handleCopyChat}
                    className="text-[10px] uppercase tracking-widest text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-400/10 px-2 py-1 rounded transition-colors"
                    >
                    Copy
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
          )}

          {/* Messages */}
          {appMode !== 'bar' && (
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
                        onClick={() => {
                            setInput(prompt)
                            setAppMode('chat')
                        }}
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
                      
                      {message.toolData && (message.toolData.type === 'manage_app' || message.toolData.type === 'launch_app') && (
                        <AppControlCard 
                            appName={message.toolData.appName!}
                            action={message.toolData.action || 'launch'}
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
          )}

          {/* Input */}
          <div className={`${appMode === 'bar' ? 'p-0 bg-transparent h-full' : 'p-6 border-t border-white/10 bg-white/5 h-auto'} relative flex flex-col justify-center transition-all duration-300`}>
            {/* Drag Region for Bar Mode */}
            {appMode === 'bar' && (
               <div className="absolute top-0 left-0 w-4 h-full cursor-grab z-20 flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity drag-region">
                  <div className="h-4 w-1 rounded-full bg-white/20"></div>
               </div>
            )}
            <AnimatePresence>
            {selectedEventId && (
              <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 10 }}
               className="absolute -top-12 left-6 right-6 bg-space-accent/10 border border-space-accent/20 backdrop-blur-md px-4 py-2 rounded-lg flex items-center justify-between text-sm text-space-accent shadow-lg"
              >
                  <div className="flex items-center gap-2 truncate">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="truncate">
                          Selected: <span className="font-bold">{calendarDays.flatMap(d => d.events).find(e => e.id === selectedEventId)?.summary || 'Event'}</span>
                      </span>
                  </div>
                  <button 
                    onClick={() => setSelectedEventId(null)}
                    className="p-1 hover:bg-space-accent/20 rounded-full transition-colors"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </motion.div>
            )}
            </AnimatePresence>
            <form onSubmit={handleSubmit} className={`flex items-center gap-4 ${appMode === 'bar' ? 'h-full pl-6 pr-4' : ''}`}>
               {appMode === 'bar' && isAuthed && (
                  <svg className="w-6 h-6 text-space-accent/70 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               )}
              
              {!isAuthed ? (
                  <button
                    type="button"
                    onClick={handleSignIn}
                    className="flex-1 flex items-center justify-center gap-3 w-full h-full bg-transparent hover:bg-white/5 transition-colors rounded-xl group"
                  >
                        <span className="font-light text-xl text-gray-300 group-hover:text-white transition-colors">
                            Connect <span className="font-bold text-space-accent">DOTION</span> to Google Calendar
                        </span>
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                  </button>
              ) : (
                <>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={appMode === 'bar' ? "Ask Dotion..." : "Type command..."}
                    disabled={isLoading}
                    autoFocus
                    className={`flex-1 ${appMode === 'bar' ? 'bg-transparent border-none text-xl p-0 h-full focus:ring-0 placeholder-white/30' : 'rounded-xl px-6 py-4 bg-black/20 border border-white/10 focus:border-space-accent/50 focus:bg-black/40'} text-white placeholder-gray-500 focus:outline-none transition-all disabled:opacity-50`}
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={`${appMode === 'bar' ? 'hidden' : 'px-8 py-4 bg-space-accent/10 border border-space-accent/30 text-space-accent hover:bg-space-accent/20 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-space-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider text-sm shadow-[0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_20px_rgba(0,240,255,0.3)]'}`}
                >
                    {isLoading ? 'Processing...' : 'Send'}
                </button>
                </>
              )}
            </form>
          </div>
        </motion.section>

        {/* Calendar panel */}
        {(appMode === 'calendar' || appMode === 'launcher') && (
        <motion.aside 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          className={`flex min-h-0 flex-col rounded-2xl glass-panel shadow-lg ${appMode === 'calendar' ? 'flex-1' : 'w-[25%]'} overflow-hidden`}
        >
          {appMode === 'launcher' ? (
              <RecentAppsView apps={launchedApps} />
          ) : (
          <>
          <div className="p-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => handleNavigate('prev')}
                  disabled={isFetchingMore}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50 text-gray-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="text-center">
                    <h2 className="text-xl font-light text-white">
                        {focusedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </h2>
                     <p className="text-xs text-gray-400 uppercase tracking-widest">
                        {focusedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                     </p>
                </div>
                 <button 
                  onClick={() => handleNavigate('next')}
                  disabled={isFetchingMore}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50 text-gray-400 hover:text-white"
                >
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
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
                  onSelectEvent={handleSelectEvent}
                  selectedEventId={selectedEventId}
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
                  recentlyModifiedEventId={recentlyModifiedEventId}
                  onSelectEvent={handleSelectEvent}
                  selectedEventId={selectedEventId}
              />
            )}
          </div>
          </>
          )}
        </motion.aside>
        )}
      </div>
    </main>
  )
}
