'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface CalendarEventCardProps {
  type: 'create' | 'update' | 'delete'
  eventId: string
  summary: string
  start: string
  end?: string
  location?: string
  originalEvent?: any
  onUndo: () => void
}

export default function CalendarEventCard({ type, eventId, summary, start, end, location, originalEvent, onUndo }: CalendarEventCardProps) {
  const [isDeleted, setIsDeleted] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleUndo = async () => {
    setIsDeleting(true)
    try {
      if (type === 'create') {
        const response = await fetch('/api/calendar', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId })
        })
        if (response.ok) { setIsDeleted(true); onUndo() }
      } else if (type === 'update') {
          // To undo update, update back to original details
          const response = await fetch('/api/calendar', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  eventId, 
                  summary: originalEvent.summary,
                  description: originalEvent.description || null,
                  location: originalEvent.location || null,
                  start: originalEvent.start.dateTime || originalEvent.start.date,
                  end: originalEvent.end.dateTime || originalEvent.end.date
              })
          })
          if (response.ok) { setIsDeleted(true); onUndo() }
      } else if (type === 'delete') {
          // To undo delete, re-create the event
          const response = await fetch('/api/calendar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  summary: originalEvent.summary,
                  description: originalEvent.description || null,
                  location: originalEvent.location || null,
                  start: originalEvent.start.dateTime || originalEvent.start.date,
                  end: originalEvent.end.dateTime || originalEvent.end.date
              })
          })
          if (response.ok) { setIsDeleted(true); onUndo() }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isDeleted) {
     return (
         <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/30 w-full my-4"
         >
             <div className="flex items-center gap-3 text-gray-300">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                 <span className="text-sm font-medium">Action undone</span>
             </div>
         </motion.div>
     )
  }

  const startDate = new Date(start)
  const endDate = end ? new Date(end) : null
  
  const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endTimeStr = endDate ? endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

  const typeConfig = {
      create: {
          colorClass: 'text-space-accent',
          bgColorClass: 'bg-space-accent/10',
          borderColorClass: 'border-space-accent/30',
          pulseColorClass: 'bg-space-accent',
          glowFrom: 'from-space-accent',
          glowTo: 'to-purple-500',
          title: 'New Event',
          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
      },
      update: {
          colorClass: 'text-orange-400',
          bgColorClass: 'bg-orange-400/10',
          borderColorClass: 'border-orange-400/30',
          pulseColorClass: 'bg-orange-400',
          glowFrom: 'from-orange-400',
          glowTo: 'to-red-500',
          title: 'Event Updated',
          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
      },
      delete: {
          colorClass: 'text-red-500',
          bgColorClass: 'bg-red-500/10',
          borderColorClass: 'border-red-500/30',
          pulseColorClass: 'bg-red-500',
          glowFrom: 'from-red-500',
          glowTo: 'to-pink-600',
          title: 'Event Deleted',
          icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      }
  }[type]

  const config = typeConfig

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="group relative w-full my-4 font-sans text-left"
    >
      {/* Glow effects */}
      <div className={`absolute -inset-0.5 bg-gradient-to-r ${config.glowFrom} via-current ${config.glowTo} rounded-xl opacity-20 group-hover:opacity-40 blur transition duration-500`}></div>
      
      <div className="relative flex flex-col gap-3 p-5 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none"></div>
        <div className={`absolute bottom-0 left-0 w-16 h-16 ${config.bgColorClass} rounded-tr-full blur-xl pointer-events-none`}></div>

        {/* Header */}
        <div className="flex items-start justify-between z-10">
           <div className="flex flex-col">
              <span className={`text-[10px] uppercase tracking-widest ${config.colorClass} font-bold mb-1 flex items-center gap-1`}>
                 <span className={`w-1.5 h-1.5 rounded-full ${config.pulseColorClass} animate-pulse`}></span>
                 {config.title}
              </span>
              <h3 className={`text-lg font-medium text-white shadow-black drop-shadow-md leading-tight ${type === 'delete' ? 'line-through decoration-red-500/50 text-gray-400' : ''}`}>{summary}</h3>
           </div>
           <div className={`h-8 w-8 rounded-full ${config.bgColorClass} flex items-center justify-center border ${config.borderColorClass} shrink-0 ml-2 ${config.colorClass}`}>
             {config.icon}
           </div>
        </div>

        {/* Details */}
        <div className="space-y-2 py-3 border-t border-white/10 border-b border-white/10 my-1 z-10">
           <div className="flex items-center gap-2.5 text-sm text-gray-300">
             <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             <div className="flex flex-col leading-tight">
                 <span className="font-medium text-white">{dateStr}</span>
                 <span className="text-xs text-gray-400 font-mono">{timeStr} {endTimeStr && `- ${endTimeStr}`}</span>
             </div>
           </div>
           {location && (
             <div className="flex items-center gap-2.5 text-sm text-gray-300">
               <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
               <span className="truncate">{location}</span>
             </div>
           )}
        </div>

        {/* Footer / Actions */}
        <div className="flex items-center justify-between pt-1 z-10">
           <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-[10px] font-medium text-green-300">
             SYNCED
           </span>
           
           <button 
             onClick={handleUndo} 
             disabled={isDeleting}
             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-xs font-medium text-gray-400 hover:text-red-300 transition-all border border-transparent hover:border-red-500/30 disabled:opacity-50 group/button"
           >
             <svg className="w-3.5 h-3.5 group-hover/button:-rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
             {isDeleting ? 'REVERTING...' : 'UNDO'}
           </button>
        </div>
      </div>
    </motion.div>
  )
}
