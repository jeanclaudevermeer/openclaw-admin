import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { RefreshCw, Power, Wifi, WifiOff } from 'lucide-react'

interface GatewayStatus {
  connected: boolean
  port: number | null
  mode: string | null
  agentCount: number
}

function StatusIndicator({ connected }: { connected: boolean }) {
  return (
    <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
      <div className="status-indicator-dot" />
      {connected && (
        <>
          <div className="status-indicator-ring" />
          <div className="status-indicator-ring" />
          <div className="status-indicator-ring" />
        </>
      )}
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-box">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">
        {label}
      </div>
      <div className="text-sm font-mono font-medium text-slate-200">
        {value}
      </div>
    </div>
  )
}

export function GatewayHeader() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gateway-status'],
    queryFn: () => apiFetch<GatewayStatus>('/api/gateway/status'),
    refetchInterval: 10_000,
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['gateway-status'] })
  }

  const handleRestart = async () => {
    const confirmed = window.confirm('Restart the OpenClaw gateway now?')
    if (!confirmed) return
    await apiFetch('/api/gateway/restart', { method: 'POST' })
    handleRefresh()
  }

  return (
    <header className="fixed left-0 top-0 z-20 w-full header-glass">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        {/* Left: Status */}
        <div className="flex items-center gap-4">
          <StatusIndicator connected={data?.connected ?? false} />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-wide text-slate-100">
                Gateway
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono ${
                  data?.connected
                    ? 'badge-glow-emerald'
                    : 'badge-glow-rose'
                }`}
              >
                {data?.connected ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    ONLINE
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    OFFLINE
                  </>
                )}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-500">
              OpenClaw Control Panel
            </span>
          </div>
        </div>

        {/* Center: Stats */}
        <div className="hidden md:flex items-center gap-3">
          <StatBox label="Port" value={data?.port ?? '—'} />
          <StatBox label="Mode" value={data?.mode ?? '—'} />
          <StatBox label="Agents" value={data?.agentCount ?? 0} />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-glow border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 gap-2 font-mono text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            REFRESH
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestart}
            className="btn-glow border-rose-900/50 bg-rose-950/30 hover:bg-rose-900/30 text-rose-300 gap-2 font-mono text-xs"
          >
            <Power className="w-3.5 h-3.5" />
            RESTART
          </Button>
        </div>
      </div>

      {/* Error display */}
      {isError && (
        <div className="mx-auto w-full max-w-7xl px-6 pb-3">
          <div className="flex items-center gap-2 text-xs font-mono text-rose-400">
            <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
            {error instanceof Error ? error.message : 'Failed to load gateway status'}
          </div>
        </div>
      )}

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
    </header>
  )
}
