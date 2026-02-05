import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { getPassword } from '@/lib/api'

// Fallback UUID generator for browsers without crypto.randomUUID
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  timestamp: Date
}

interface GatewayFrame {
  type: 'req' | 'res' | 'event'
  id?: string
  method?: string
  event?: string
  ok?: boolean
  payload?: Record<string, unknown>
  error?: { message?: string }
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface ChatContextType {
  messages: Message[]
  status: ConnectionStatus
  errorMsg: string
  sending: boolean
  sendMessage: (content: string) => void
  reconnect: () => void
}

const ChatContext = createContext<ChatContextType | null>(null)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const wsRef = useRef<WebSocket | null>(null)
  const statusRef = useRef<ConnectionStatus>('disconnected')
  const connectingRef = useRef(false)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const connect = useCallback(() => {
    if (connectingRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return

    const password = getPassword()
    if (!password) {
      setStatus('error')
      setErrorMsg('Not authenticated')
      return
    }

    connectingRef.current = true
    setStatus('connecting')
    setErrorMsg('')

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/gateway`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    let authComplete = false
    let handshakeComplete = false

    ws.onopen = () => {
      console.log('[Chat] WebSocket connected, sending auth')
      // Authenticate via first message instead of URL query param
      ws.send(JSON.stringify({ type: 'auth', password }))
    }

    ws.onmessage = (event) => {
      try {
        const frame: GatewayFrame = JSON.parse(event.data)

        // Handle auth response (first message back from server)
        if (!authComplete && (frame as Record<string, unknown>).type === 'auth') {
          authComplete = true
          if (!(frame as Record<string, unknown>).ok) {
            connectingRef.current = false
            setStatus('error')
            setErrorMsg('Authentication failed')
            ws.close()
            return
          }
          console.log('[Chat] Authenticated')
          return
        }

        // Handle connect response
        if (frame.type === 'res' && frame.ok !== undefined && !handshakeComplete) {
          connectingRef.current = false
          handshakeComplete = true
          if (frame.ok) {
            setStatus('connected')
            // Request history
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'req',
                id: generateId(),
                method: 'chat.history',
                params: { sessionKey: 'main', limit: 50 },
              }))
            }
          } else {
            setStatus('error')
            setErrorMsg(frame.error?.message || 'Connection failed')
          }
          return
        }

        // Handle streaming events
        if (frame.type === 'event') {
          // Ignore system events
          if (frame.event === 'health' || frame.event === 'tick' || frame.event === 'connect.challenge') {
            return
          }

          if (frame.event === 'chat') {
            const payload = frame.payload as {
              state?: string
              message?: { role?: string; content?: Array<{ type: string; text?: string }> }
            }

            if (payload.state === 'delta' || payload.state === 'final') {
              const text = payload.message?.content?.[0]?.text || ''

              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1]
                if (lastMsg?.role === 'assistant' && lastMsg.streaming) {
                  return prev.map((m, i) =>
                    i === prev.length - 1
                      ? { ...m, content: text, streaming: payload.state !== 'final' }
                      : m
                  )
                }
                return prev
              })

              if (payload.state === 'final') {
                setSending(false)
              }
            }
          } else if (frame.event === 'agent') {
            const payload = frame.payload as { stream?: string; data?: { text?: string; delta?: string } }

            if (payload.stream === 'assistant' && payload.data?.delta) {
              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1]
                if (lastMsg?.role === 'assistant' && lastMsg.streaming) {
                  return prev.map((m, i) =>
                    i === prev.length - 1
                      ? { ...m, content: m.content + payload.data!.delta }
                      : m
                  )
                }
                return prev
              })
            }
          }
        }

        // Handle RPC responses for history
        if (frame.type === 'res' && frame.ok && frame.payload && handshakeComplete) {
          const payload = frame.payload as { messages?: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }
          if (payload.messages) {
            const historyMessages: Message[] = payload.messages.map((m, i) => ({
              id: `history-${i}`,
              role: m.role as 'user' | 'assistant',
              content: m.content?.[0]?.text || '',
              timestamp: new Date(),
            }))
            setMessages(historyMessages)
          }
        }

      } catch (err) {
        console.error('[Chat] Failed to parse frame:', err)
      }
    }

    ws.onerror = () => {
      console.error('[Chat] WebSocket error')
      connectingRef.current = false
      setStatus('error')
      setErrorMsg('Connection error')
    }

    ws.onclose = () => {
      console.log('[Chat] WebSocket closed')
      wsRef.current = null
      connectingRef.current = false
      if (statusRef.current === 'connected') {
        setStatus('disconnected')
      }
    }
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const sendMessage = useCallback((content: string) => {
    const message = content.trim()
    if (!message || sending || status !== 'connected') return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    setMessages((prev) => [...prev,
      { id: generateId(), role: 'user', content: message, timestamp: new Date() },
      { id: generateId(), role: 'assistant', content: '', streaming: true, timestamp: new Date() }
    ])
    setSending(true)

    const frame = {
      type: 'req',
      id: generateId(),
      method: 'chat.send',
      params: { sessionKey: 'main', message, deliver: false, timeoutMs: 120000, idempotencyKey: generateId() },
    }

    wsRef.current.send(JSON.stringify(frame))
  }, [sending, status])

  const reconnect = useCallback(() => {
    window.location.reload()
  }, [])

  return (
    <ChatContext.Provider value={{ messages, status, errorMsg, sending, sendMessage, reconnect }}>
      {children}
    </ChatContext.Provider>
  )
}
