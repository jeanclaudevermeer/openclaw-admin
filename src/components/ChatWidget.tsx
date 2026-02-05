import { useState } from 'react'
import { ChatPage } from './ChatPage'
import { MessageSquare, X, Minus } from 'lucide-react'

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full shadow-lg shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95"
        title="Open Chat"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div
      className={`fixed right-0 top-0 z-50 h-full bg-slate-900/95 backdrop-blur-sm border-l border-slate-700/50 shadow-2xl transition-all duration-300 ${
        isMinimized ? 'w-12' : 'w-[380px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
        {!isMinimized && (
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium text-slate-200">Chat</span>
          </div>
        )}
        <div className={`flex items-center gap-1 ${isMinimized ? 'mx-auto' : ''}`}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <MessageSquare className="w-4 h-4" />
            ) : (
              <Minus className="w-4 h-4" />
            )}
          </button>
          {!isMinimized && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Content */}
      {!isMinimized && (
        <div className="h-[calc(100%-52px)] overflow-hidden">
          <div className="h-full p-4">
            <ChatPage compact />
          </div>
        </div>
      )}
    </div>
  )
}
