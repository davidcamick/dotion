'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

interface Slot {
  start: string
  end: string
  label?: string
}

interface SlotPickerProps {
  slots: Slot[]
  onSelect: (slot: Slot) => void
  onHover?: (slot: Slot | null) => void
}

export default function SlotPicker({ slots, onSelect, onHover }: SlotPickerProps) {
  const [page, setPage] = useState(0)
  const pageSize = 6
  
  const visibleSlots = slots.slice(page * pageSize, (page + 1) * pageSize)
  const hasMore = (page + 1) * pageSize < slots.length
  
  const nextPage = () => setPage(p => p + 1)
  const prevPage = () => setPage(p => p - 1)

  return (
    <div className="flex flex-col gap-2 my-4 w-full">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-space-accent uppercase tracking-widest font-semibold ml-1">
          Available Time Slots detected
        </p>
        
        {slots.length > pageSize && (
            <div className="flex gap-1">
                <button 
                  onClick={prevPage} 
                  disabled={page === 0}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-xs text-gray-500 font-mono self-center">
                    {page + 1}/{Math.ceil(slots.length / pageSize)}
                </span>
                <button 
                  onClick={nextPage} 
                  disabled={!hasMore}
                  className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {visibleSlots.map((slot, index) => {
          const startDate = new Date(slot.start)
          const endDate = new Date(slot.end)
          
          const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          const timeRange = `${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          
          return (
            <motion.button
              key={`${slot.start}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onMouseEnter={() => onHover && onHover(slot)}
              onMouseLeave={() => onHover && onHover(null)}
              onClick={() => onSelect(slot)}
              className="group flex flex-col items-start p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-space-accent/10 hover:border-space-accent/50 transition-all text-left"
            >
              <div className="flex items-center gap-2 w-full mb-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-space-accent/50 group-hover:bg-space-accent group-hover:shadow-[0_0_8px_rgba(0,240,255,0.6)] transition-all"></div>
                 <span className="text-xs font-mono text-gray-400 group-hover:text-space-accent/80 transition-colors">{dateStr}</span>
              </div>
              <span className="text-sm font-medium text-gray-200 group-hover:text-white pl-3.5">
                {timeRange}
              </span>
              {slot.label && (
                <span className="text-[10px] text-gray-500 pl-3.5 mt-1 group-hover:text-gray-400 transition-colors">
                  {slot.label}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
