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
}

const getEventColor = (eventSummary: string, colorId?: string) => {
  // Categorize by keywords in summary
  const summary = eventSummary.toLowerCase()
  
  if (summary.includes('homework') || summary.includes('quiz') || 
      summary.includes('test') || summary.includes('review') ||
      summary.includes('ch ') || summary.includes('chapter')) {
    return 'bg-red-900/80 border-red-700'
  }
  if (summary.includes('meeting')) {
    return 'bg-blue-900/80 border-blue-700'
  }
  if (summary.includes('lab')) {
    return 'bg-orange-900/80 border-orange-700'
  }
  if (summary.includes('pillar') || summary.includes('spirit')) {
    return 'bg-gray-700/80 border-gray-600'
  }
  
  // Default colors for classes/events
  return 'bg-amber-900/70 border-amber-800'
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

export default function CalendarView({ days, timeZone, zoomLevel }: CalendarViewProps) {
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
    <div className="flex flex-col h-full">
      {/* Header with day names */}
      <div className="flex border-b border-gray-700 bg-gray-900/80">
        <div className="w-16 flex-shrink-0"></div>
        <div className="flex flex-1">
          {days.map((day) => (
            <div key={day.date} className="flex-1 px-2 py-3 text-center border-l border-gray-700">
              <div className={`text-xs font-medium mb-1 ${day.isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                {day.label.split(' ')[0]}
              </div>
              <div className={`text-lg font-semibold rounded-full w-8 h-8 flex items-center justify-center mx-auto ${
                day.isToday ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}>
                {day.label.split(' ')[1]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tasks/All-day events section */}
      <div className="flex border-b border-gray-700 bg-gray-900/60 min-h-[100px]">
        <div className="w-16 flex-shrink-0 flex items-start justify-center pt-2">
          <span className="text-xs text-gray-500">Tasks</span>
        </div>
        <div className="flex flex-1">
          {days.map((day) => {
            const { tasks } = getDayData(day)
            return (
              <div key={`tasks-${day.date}`} className="flex-1 px-1 py-2 border-l border-gray-700 space-y-1">
                {tasks.map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs px-2 py-1.5 rounded border ${getEventColor(event.summary, event.colorId)} text-white truncate`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[10px]">⭕</span>
                      <span className="truncate">{event.summary}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
        <div className="flex relative">
          {/* Time labels */}
          <div className="w-16 flex-shrink-0">
            {hours.map((hour) => (
              <div key={hour} style={{ height: `${hourHeight}px` }} className="flex items-start justify-end pr-2 pt-1">
                <span className="text-xs text-gray-500">
                  {hour === 0 ? '12AM' : hour > 12 ? hour - 12 : hour === 12 ? '12' : hour}
                  {hour === 0 || hour === 12 ? '' : hour >= 12 ? 'PM' : 'AM'}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 relative">
            {days.map((day) => {
              const { timedEvents } = getDayData(day)
              return (
                <div key={`grid-${day.date}`} className="flex-1 border-l border-gray-700 relative">
                  {/* Hour lines */}
                  {hours.map((hour) => (
                    <div
                      key={`${day.date}-${hour}`}
                      style={{ height: `${hourHeight}px` }}
                      className="border-b border-gray-800/50"
                    />
                  ))}
                  
                  {/* Events */}
                  {timedEvents.map((event) => {
                    const { top, height } = getEventPosition(event.start, event.end, timeZone, hourHeight, startHour)
                    return (
                      <div
                        key={event.id}
                        className={`absolute left-1 right-1 rounded border ${getEventColor(event.summary, event.colorId)} overflow-hidden px-1 py-1`}
                        style={{
                          top: `${top}px`,
                          height: `${Math.max(height, 40)}px`,
                        }}
                      >
                        <div className="text-xs font-medium text-white truncate">
                          {event.summary}
                        </div>
                        {height > 30 && (
                          <div className="text-[10px] text-gray-300">
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
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
                        <div className="flex-1 h-0.5 bg-red-500"></div>
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
