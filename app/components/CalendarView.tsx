'use client'

import { useState, useEffect, useRef } from 'react'

interface CalendarEvent {
  id: string
  summary: string
  start: string
  end: string | null
  location: string
  colorId?: string
}

interface CalendarDay {
  label: string
  date: string
  isToday?: boolean
  events: CalendarEvent[]
}

interface CalendarViewProps {
  days: CalendarDay[]
  timeZone: string
  zoomLevel: number
  hoveredSlot?: { start: string, end: string, label?: string } | null
}

const getEventColor = (eventSummary: string, colorId?: string) => {
  // Categorize by keywords in summary - Space Theme
  const summary = eventSummary.toLowerCase()
  
  if (summary.includes('homework') || summary.includes('quiz') || 
      summary.includes('test') || summary.includes('review') ||
      summary.includes('ch ') || summary.includes('chapter')) {
    return 'bg-pink-500/20 border-pink-500/50 text-pink-100 shadow-[0_0_10px_rgba(236,72,153,0.1)]'
  }
  if (summary.includes('meeting')) {
    return 'bg-cyan-500/20 border-cyan-500/50 text-cyan-100 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
  }
  if (summary.includes('lab')) {
    return 'bg-purple-500/20 border-purple-500/50 text-purple-100 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
  }
  if (summary.includes('pillar') || summary.includes('spirit')) {
    return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
  }
  
  // Default colors for classes/events
  return 'bg-blue-600/20 border-blue-500/40 text-blue-100'
}

const isAllDayOrTask = (event: CalendarEvent) => {
  // Check if event has no specific time (all-day or task)
  return !event.start.includes('T') || event.start.includes('00:00:00')
}

const formatTime = (isoString: string, timeZone: string) => {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(date)
}

const getEventPosition = (start: string, end: string | null, timeZone: string, hourHeight: number, startHour: number) => {
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : new Date(startDate.getTime() + 60 * 60 * 1000)
  
  const startHourTime = startDate.getHours()
  const startMinute = startDate.getMinutes()
  const endHourTime = endDate.getHours()
  const endMinute = endDate.getMinutes()
  
  const startInHours = startHourTime + startMinute / 60
  const endInHours = endHourTime + endMinute / 60
  
  const top = ((startInHours - startHour) * hourHeight)
  const height = (endInHours - startInHours) * hourHeight
  
  return { top, height }
}

export default function CalendarView({ days, timeZone, zoomLevel, hoveredSlot }: CalendarViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const currentTimeRef = useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // Adjust hour range and height based on zoom
  const hourHeight = 80 * zoomLevel
  const startHour = zoomLevel <= 0.75 ? 0 : 6 // Show full day when zoomed out
  const endHour = zoomLevel <= 0.75 ? 24 : 24 // 0-24 or 6-24
  const hours = Array.from({ length: endHour - startHour }, (_, i) => i + startHour)
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [])
  
  // Auto-scroll to current time on mount and when view changes or zoom changes
  useEffect(() => {
    if (currentTimeRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current
      const timeIndicator = currentTimeRef.current
      const containerHeight = container.clientHeight
      const scrollTo = timeIndicator.offsetTop - containerHeight / 2 + 20
      
      container.scrollTo({
        top: scrollTo,
        behavior: 'smooth'
      })
    }
  }, [days.length, zoomLevel])
  
  // Calculate current time position
  const getCurrentTimePosition = () => {
    const now = currentTime
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const timeInHours = hours + minutes / 60
    const top = (timeInHours - startHour) * hourHeight
    return top
  }
  
  // Split events into tasks (all-day/no time) and timed events
  const getDayData = (day: CalendarDay) => {
    const tasks = day.events.filter(isAllDayOrTask)
    const timedEvents = day.events.filter(e => !isAllDayOrTask(e))
    return { tasks, timedEvents }
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header with day names */}
      <div className="flex border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="w-16 flex-shrink-0 border-r border-white/5"></div>
        <div className="flex flex-1">
          {days.map((day) => (
            <div key={day.date} className="flex-1 px-2 py-3 text-center border-l border-white/5">
              <div className={`text-xs font-medium mb-1 uppercase tracking-wider ${day.isToday ? 'text-space-accent' : 'text-gray-500'}`}>
                {day.label.split(' ')[0]}
              </div>
              <div className={`text-xl font-light rounded-full w-10 h-10 flex items-center justify-center mx-auto transition-all ${
                day.isToday ? 'bg-space-accent text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'text-gray-300'
              }`}>
                {day.label.split(' ')[1]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tasks/All-day events section */}
      <div className="flex border-b border-white/10 bg-black/20 min-h-[80px]">
        <div className="w-16 flex-shrink-0 flex items-start justify-center pt-3 border-r border-white/5">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest -rotate-90 mt-4 origin-center">Tasks</span>
        </div>
        <div className="flex flex-1">
          {days.map((day) => {
            const { tasks } = getDayData(day)
            return (
              <div key={`tasks-${day.date}`} className="flex-1 px-1 py-2 border-l border-white/5 space-y-1">
                {tasks.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs px-2 py-1.5 rounded-md border backdrop-blur-sm transition-all hover:scale-105 ${getEventColor(event.summary, event.colorId)} truncate cursor-pointer`}
                  >
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
                      <span className="truncate font-medium">{event.summary}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" ref={scrollContainerRef}>
        <div className="flex relative">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 border-r border-white/5 bg-black/10">
            {hours.map((hour) => (
              <div key={hour} style={{ height: `${hourHeight}px` }} className="flex items-start justify-end pr-2 pt-1 border-b border-transparent">
                <span className="text-[10px] font-mono text-gray-600">
                  {hour === 0 ? '12AM' : hour > 12 ? hour - 12 : hour === 12 ? '12' : hour}
                  {hour === 0 || hour === 12 ? '' : hour >= 12 ? 'PM' : 'AM'}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 relative min-h-[500px]">
             {/* Background Grid Lines */}
             <div className="absolute inset-0 pointer-events-none">
                {hours.map((hour) => (
                    <div
                      key={`line-${hour}`}
                      style={{ height: `${hourHeight}px` }}
                      className="border-b border-white/5"
                    />
                  ))}
             </div>

            {days.map((day) => {
              const { timedEvents } = getDayData(day)
              
              // Check if hovered slot belongs to this day
              let hoveredSlotStyle: { top: number, height: number } | null = null
              if (hoveredSlot) {
                  // Robust date comparison that handles YYYY-MM-DD correctly
                  const [y, m, d] = day.date.split('-').map(Number)
                  const slotStart = new Date(hoveredSlot.start)
                  // Use local date components of the slot
                  const isSameDay = slotStart.getFullYear() === y && 
                                    (slotStart.getMonth() + 1) === m && 
                                    slotStart.getDate() === d
                  
                  if (isSameDay) {
                      const { top, height } = getEventPosition(hoveredSlot.start, hoveredSlot.end, timeZone, hourHeight, startHour)
                      hoveredSlotStyle = { top, height }
                  }
              }

              return (
                <div key={`grid-${day.date}`} className="flex-1 border-l border-white/5 relative bg-gradient-to-b from-transparent to-black/5">
                  
                  {/* Hovered Slot Indicator */}
                  {hoveredSlotStyle && (
                      <div 
                        className="absolute left-1 right-1 rounded-md border-2 border-dashed border-space-accent/50 bg-space-accent/5 z-30 pointer-events-none animate-pulse"
                        style={{
                            top: `${hoveredSlotStyle.top}px`,
                            height: `${Math.max(hoveredSlotStyle.height, 20)}px`
                        }}
                      />
                  )}

                  {/* Events */}
                  {timedEvents.map((event) => {
                    const { top, height } = getEventPosition(event.start, event.end, timeZone, hourHeight, startHour)
                    return (
                      <div
                        key={event.id}
                        className={`absolute left-1 right-1 rounded-md border backdrop-blur-md transition-all hover:z-20 hover:scale-[1.02] shadow-lg ${getEventColor(event.summary, event.colorId)} overflow-hidden px-2 py-1 cursor-pointer group`}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 40)}px`,
                        }}
                      >
                        <div className="text-xs font-semibold truncate group-hover:whitespace-normal">
                          {event.summary}
                        </div>
                        {height > 30 && (
                          <div className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5 font-mono">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {formatTime(event.start, timeZone)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  
                  {/* Current time indicator */}
                  {day.isToday && getCurrentTimePosition() >= 0 && getCurrentTimePosition() < (hours.length * hourHeight) && (
                    <div
                      ref={currentTimeRef}
                      className="absolute left-0 right-0 pointer-events-none z-10"
                      style={{ top: `${getCurrentTimePosition()}px` }}
                    >
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse"></div>
                        <div className="flex-1 h-[2px] bg-red-500/50 shadow-[0_0_4px_rgba(239,68,68,0.5)]"></div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
