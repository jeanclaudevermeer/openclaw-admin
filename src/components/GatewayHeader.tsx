import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'

interface GatewayStatus {
  connected: boolean
  port: number | null
  mode: string | null
  agentCount: number
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
    <header className="fixed left-0 top-0 z-20 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              data?.connected ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)] animate-pulse' : 'bg-rose-400'
            }`}
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide text-slate-100">Gateway</span>
            <span className="text-xs text-slate-400">OpenClaw Admin</span>
          </div>
          <Badge variant={data?.connected ? 'default' : 'destructive'}>
            {data?.connected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>

        <div className="flex items-center gap-6 text-sm text-slate-300">
          <div className="flex flex-col items-end">
            <span className="text-xs uppercase text-slate-500">Port</span>
            <span>{data?.port ?? '—'}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs uppercase text-slate-500">Mode</span>
            <span>{data?.mode ?? '—'}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs uppercase text-slate-500">Agents</span>
            <span>{data?.agentCount ?? 0}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            Refresh
          </Button>
          <Button variant="destructive" onClick={handleRestart}>
            Restart Gateway
          </Button>
        </div>
      </div>
      {isError && (
        <div className="mx-auto w-full max-w-7xl px-6 pb-3 text-xs text-rose-300">
          {error instanceof Error ? error.message : 'Failed to load gateway status'}
        </div>
      )}
    </header>
  )
}
