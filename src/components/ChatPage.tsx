import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useChatContext } from '@/context/ChatContext'
import { Send, MessageSquare, Bot, User, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

interface ChatPageProps {
  compact?: boolean
}

export function ChatPage({ compact = false }: ChatPageProps) {
  const { messages, status, errorMsg, sending, sendMessage, reconnect } = useChatContext()
  const [input, setInput] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
    inputRef.current?.focus()
  }

  const StatusIndicator = () => {
    const statusConfig = {
      connecting: { color: 'bg-amber-400', text: 'Connecting...', pulse: true },
      connected: { color: 'bg-emerald-400', text: 'Connected', pulse: false },
      disconnected: { color: 'bg-slate-500', text: 'Disconnected', pulse: false },
      error: { color: 'bg-rose-400', text: errorMsg || 'Error', pulse: false },
    }
    const cfg = statusConfig[status]

    return (
      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
        <span className={`w-2 h-2 rounded-full ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`} />
        {cfg.text}
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : 'h-[calc(100vh-200px)] max-h-[700px]'}`}>
      {/* Header */}
      {compact ? (
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/50">
          <StatusIndicator />
          {status !== 'connected' && status !== 'connecting' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reconnect}
              className="text-slate-400 hover:text-slate-200 h-6 px-2 text-xs"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Chat</h2>
              <StatusIndicator />
            </div>
          </div>

          {status !== 'connected' && status !== 'connecting' && (
            <Button
              variant="outline"
              size="sm"
              onClick={reconnect}
              className="btn-glow border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 gap-2 font-mono text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              RECONNECT
            </Button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {messages.length === 0 && status === 'connected' && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className={`${compact ? 'p-3' : 'p-4'} bg-slate-800/30 rounded-2xl border border-slate-700/30 mb-4`}>
              <Bot className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} text-slate-600`} />
            </div>
            <p className="text-slate-500 font-mono text-sm">No messages yet</p>
            {!compact && <p className="text-slate-600 text-xs mt-1">Start a conversation with OpenClaw</p>}
          </div>
        )}

        {status === 'connecting' && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Loader2 className="w-8 h-8 text-slate-500 animate-spin mb-4" />
            <p className="text-slate-500 font-mono text-sm">Connecting...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className={`${compact ? 'p-3' : 'p-4'} bg-rose-900/20 rounded-2xl border border-rose-700/30 mb-4`}>
              <AlertCircle className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} text-rose-400/50`} />
            </div>
            <p className="text-rose-400 font-mono text-sm">{errorMsg || 'Connection failed'}</p>
            {!compact && <p className="text-slate-600 text-xs mt-1">Click reconnect to try again</p>}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 animate-fade-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex-shrink-0 ${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-lg flex items-center justify-center ${
                msg.role === 'user'
                  ? 'bg-cyan-500/20 border border-cyan-500/30'
                  : 'bg-emerald-500/20 border border-emerald-500/30'
              }`}
            >
              {msg.role === 'user' ? (
                <User className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-cyan-400`} />
              ) : (
                <Bot className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-emerald-400`} />
              )}
            </div>

            <div
              className={`max-w-[80%] rounded-xl ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${
                msg.role === 'user'
                  ? 'bg-cyan-500/10 border border-cyan-500/20 text-slate-200'
                  : 'bg-slate-800/50 border border-slate-700/50 text-slate-300'
              }`}
            >
              {msg.streaming && !msg.content ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className={`${compact ? 'text-xs' : 'text-sm'} font-mono`}>Thinking...</span>
                </div>
              ) : (
                <div className={`${compact ? 'text-xs' : 'text-sm'} whitespace-pre-wrap break-words leading-relaxed`}>
                  {msg.content}
                  {msg.streaming && (
                    <span className="inline-block w-2 h-4 ml-1 bg-emerald-400/50 animate-pulse" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`${compact ? 'pt-2' : 'pt-4'} border-t border-slate-800/50`}>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={status === 'connected' ? 'Type a message...' : 'Connecting...'}
              disabled={status !== 'connected' || sending}
              rows={1}
              className={`w-full resize-none bg-slate-900/60 border border-slate-700/50 rounded-xl ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'} text-slate-200 placeholder:text-slate-600 font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{ minHeight: compact ? '36px' : '48px', maxHeight: compact ? '80px' : '120px' }}
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={!input.trim() || status !== 'connected' || sending}
            className={`btn-glow bg-cyan-600 hover:bg-cyan-500 text-white ${compact ? 'h-9 w-9' : 'h-12 w-12'} rounded-xl p-0`}
          >
            {sending ? (
              <Loader2 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`} />
            ) : (
              <Send className={`${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
            )}
          </Button>
        </div>

        {!compact && (
          <p className="text-xs text-slate-600 mt-2 font-mono text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        )}
      </div>
    </div>
  )
}
