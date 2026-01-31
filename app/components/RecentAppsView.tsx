import { motion } from 'framer-motion'

interface RecentAppsViewProps {
  apps: string[]
}

export default function RecentAppsView({ apps }: RecentAppsViewProps) {
  // deduplicate and reverse to show newest first
  const uniqueApps = Array.from(new Set(apps)).reverse()

  return (
    <div className="h-full flex flex-col p-4 bg-black/10">
      <div className="flex items-center gap-2 mb-4 opacity-50">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
        <span className="text-[10px] uppercase tracking-widest text-white font-medium">Session</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
        {uniqueApps.length === 0 ? (
           <div className="text-center text-gray-600 text-xs py-10 font-mono">
              Ready to launch
           </div>
        ) : (
            uniqueApps.map((app, index) => (
                <motion.div
                    key={app + index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group cursor-default"
                >
                    <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-white/10 rounded text-[10px] text-gray-300 font-bold group-hover:bg-white/20 group-hover:text-white transition-colors">
                        {app.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-400 font-light group-hover:text-gray-200 transition-colors truncate">
                        {app}
                    </span>
                </motion.div>
            ))
        )}
      </div>
    </div>
  )
}
