import { motion } from 'framer-motion'

interface AppControlCardProps {
  appName: string
  action: 'launch' | 'quit' | 'minimize' | 'focus'
  status?: 'success' | 'failed'
}

export default function AppControlCard({ appName, action, status = 'success' }: AppControlCardProps) {
  const getIcon = () => {
    switch (action) {
      case 'launch':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )
      case 'quit':
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'minimize':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )
      case 'focus':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )
    }
  }

  const getLabel = () => {
    switch (action) {
      case 'launch': return 'Launched'
      case 'quit': return 'Quit'
      case 'minimize': return 'Minimized'
      case 'focus': return 'Focused'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 max-w-sm mt-2"
    >
      <div className={`p-2 rounded-lg bg-white/5 border border-white/5 ${
        action === 'quit' ? 'text-red-400' : 
        action === 'minimize' ? 'text-yellow-400' : 
        action === 'focus' ? 'text-blue-400' : 'text-green-400'
      }`}>
        {getIcon()}
      </div>
      <div>
        <h3 className="text-white font-medium">{appName}</h3>
        <p className="text-xs text-gray-400 flex items-center gap-1.5 uppercase tracking-wide">
          {status === 'success' ? (
             <>
               <span className={`w-1.5 h-1.5 rounded-full ${
                    action === 'quit' ? 'bg-red-500' : 'bg-green-500'
               }`}></span>
               {getLabel()} successfully
             </>
          ) : (
              'Command failed'
          )}
        </p>
      </div>
    </motion.div>
  )
}
