import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GatewayHeader } from '@/components/GatewayHeader'
import { AgentsPage } from '@/components/AgentsPage'
import { SkillsPage } from '@/components/SkillsPage'
import { CronPage } from '@/components/CronPage'
import { ChannelsPage } from '@/components/ChannelsPage'
import { ConfigPage } from '@/components/ConfigPage'
import { ChatPage } from '@/components/ChatPage'
import { ChatWidget } from '@/components/ChatWidget'
import { ChatProvider } from '@/context/ChatContext'
import { getPassword, setPassword, apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LogOut, Terminal, Cpu, Bot, Clock, Radio, Settings, MessageSquare } from 'lucide-react'

const tabs = [
  { value: 'chat', label: 'Chat', icon: MessageSquare },
  { value: 'agents', label: 'Agents', icon: Bot },
  { value: 'skills', label: 'Skills', icon: Cpu },
  { value: 'cron', label: 'Cron', icon: Clock },
  { value: 'channels', label: 'Channels', icon: Radio },
  { value: 'config', label: 'Config', icon: Settings },
]

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [password, setPasswordValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    setPassword(password)

    try {
      await apiFetch('/api/gateway/status')
      onLogin()
    } catch {
      setError('Invalid password')
      localStorage.removeItem('openclaw-admin-password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen login-bg bg-grid flex items-center justify-center p-4 overflow-hidden relative">
      {/* Scan line effect */}
      <div className="scan-line" />

      {/* Floating particles/dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-emerald-400/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <div
        className={`w-full max-w-md transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="login-card rounded-xl p-8 hud-corners relative overflow-hidden">
          {/* Inner scan line */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent"
              style={{
                animation: 'scan-line 3s linear infinite',
              }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="relative">
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/50">
                <Terminal className="h-8 w-8 text-emerald-400" />
              </div>
              {/* Glow effect behind icon */}
              <div className="absolute inset-0 bg-emerald-400/20 rounded-xl blur-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-50 font-mono tracking-tight">
                OpenClaw
              </h1>
              <p className="text-sm text-slate-400 font-mono">
                <span className="text-emerald-400">$</span> admin_console
              </p>
            </div>
          </div>

          {/* Version/Status bar */}
          <div className="flex items-center gap-3 mb-6 text-xs font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              SYSTEM READY
            </span>
            <span className="text-slate-700">|</span>
            <span>v1.0.0</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Authentication Key
              </label>
              <Input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPasswordValue(e.target.value)}
                className="input-glow bg-slate-900/60 border-slate-700/50 text-slate-50 font-mono h-12 px-4"
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-400 text-sm font-mono animate-fade-in">
                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full btn-glow btn-primary-glow h-12 text-white font-medium tracking-wide"
              disabled={loading || !password}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Initialize Session
                </span>
              )}
            </Button>
          </form>

          {/* Footer decoration */}
          <div className="mt-8 pt-6 border-t border-slate-800/50">
            <div className="flex items-center justify-between text-xs font-mono text-slate-600">
              <span>SECURE CONNECTION</span>
              <span className="flex items-center gap-1">
                <span className="w-1 h-1 bg-emerald-400/50 rounded-full" />
                <span className="w-1 h-1 bg-emerald-400/50 rounded-full" />
                <span className="w-1 h-1 bg-emerald-400/50 rounded-full" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')

  useEffect(() => {
    setMounted(true)
  }, [])

  function handleLogout() {
    localStorage.removeItem('openclaw-admin-password')
    window.location.reload()
  }

  return (
    <ChatProvider>
    <div className="min-h-screen bg-slate-950 bg-grid bg-noise text-slate-50">
      {/* Radial glow at top */}
      <div className="fixed inset-0 bg-radial-glow pointer-events-none" />

      <GatewayHeader />
      {activeTab !== 'chat' && <ChatWidget />}

      <main className={`relative mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-10 pt-24 transition-all duration-500 ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        <Tabs defaultValue="chat" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="tab-list-glow rounded-lg">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="tab-trigger-glow flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm"
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 gap-2 font-mono text-xs"
            >
              <LogOut className="h-4 w-4" />
              LOGOUT
            </Button>
          </div>

          <div className="animate-fade-in">
            <TabsContent value="chat" className="mt-0">
              <ChatPage />
            </TabsContent>
            <TabsContent value="agents" className="mt-0">
              <AgentsPage />
            </TabsContent>
            <TabsContent value="skills" className="mt-0">
              <SkillsPage />
            </TabsContent>
            <TabsContent value="cron" className="mt-0">
              <CronPage />
            </TabsContent>
            <TabsContent value="channels" className="mt-0">
              <ChannelsPage />
            </TabsContent>
            <TabsContent value="config" className="mt-0">
              <ConfigPage />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
    </ChatProvider>
  )
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const password = getPassword()
    if (!password) {
      setAuthenticated(false)
      return
    }

    apiFetch('/api/gateway/status')
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false))
  }, [])

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 bg-grid flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 font-mono">
          <div className="w-5 h-5 border-2 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
          Initializing...
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />
  }

  return <Dashboard />
}

export default App
