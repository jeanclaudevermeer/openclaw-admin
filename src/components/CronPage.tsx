import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api'
import { Clock, Play, Trash2, Loader2, Calendar, Zap } from 'lucide-react'

interface CronJob {
  id: string
  name: string
  description?: string
  enabled: boolean
  schedule: {
    kind: string
    expr: string
    tz?: string
  }
  payload: {
    kind: string
    message?: string
    channel?: string
    to?: string
    threadId?: string
  }
  state?: {
    lastRunAtMs?: number
    lastStatus?: string
  }
}

interface CronResponse {
  jobs: CronJob[]
}

function formatDestination(job: CronJob) {
  const parts = [job.payload.channel, job.payload.to, job.payload.threadId].filter(Boolean)
  return parts.join(' → ') || 'Unbound'
}

function frequencyBadge(expr: string) {
  const trimmed = expr.trim()
  if (trimmed.startsWith('*/')) return { label: 'Minutes', color: 'badge-glow-rose' }
  if (trimmed.startsWith('0 *') || trimmed.startsWith('0 */'))
    return { label: 'Hourly', color: 'badge-glow-amber' }
  if (trimmed.includes(' 0 ') || trimmed.startsWith('0 0'))
    return { label: 'Daily', color: 'badge-glow-emerald' }
  return { label: 'Custom', color: 'badge-glow-cyan' }
}

export function CronPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['cron-jobs'],
    queryFn: () => apiFetch<CronResponse>('/api/cron'),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; enabled: boolean }) =>
      apiFetch(`/api/cron/${payload.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: payload.enabled }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cron-jobs'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/cron/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cron-jobs'] }),
  })

  const runMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/cron/${id}/run`, { method: 'POST' }),
  })

  const grouped = useMemo(() => {
    const map = new Map<string, CronJob[]>()
    for (const job of data?.jobs ?? []) {
      const key = formatDestination(job)
      const list = map.get(key) ?? []
      list.push(job)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [data?.jobs])

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading cron jobs...
      </div>
    )
  }

  if (!data?.jobs?.length) {
    return (
      <div className="card-glow rounded-xl p-12 flex flex-col items-center justify-center">
        <Clock className="w-12 h-12 mb-4 text-slate-700" />
        <span className="text-sm font-mono text-slate-500">No scheduled jobs</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Clock className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Scheduled Jobs</h2>
            <p className="text-xs font-mono text-slate-500">
              {data?.jobs?.length ?? 0} jobs configured
            </p>
          </div>
        </div>
      </div>

      {/* Job Groups */}
      {grouped.map(([destination, jobs], groupIndex) => (
        <div
          key={destination}
          className="space-y-3 animate-fade-in-up opacity-0"
          style={{
            animationDelay: `${groupIndex * 0.1}s`,
            animationFillMode: 'forwards',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
              {destination}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-800 to-transparent" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {jobs.map((job, jobIndex) => {
              const badge = frequencyBadge(job.schedule.expr)
              return (
                <div
                  key={job.id}
                  className={`card-glow rounded-xl p-5 transition-all duration-300 animate-fade-in-up opacity-0 ${
                    job.enabled ? '' : 'opacity-60'
                  }`}
                  style={{
                    animationDelay: `${(groupIndex * 0.1) + (jobIndex * 0.05)}s`,
                    animationFillMode: 'forwards',
                  }}
                >
                  {/* Job Header */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className={`w-4 h-4 ${job.enabled ? 'text-emerald-400' : 'text-slate-600'}`} />
                        <h3 className="text-base font-semibold text-slate-100 truncate">
                          {job.name}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {job.description ?? 'No description'}
                      </p>
                    </div>
                    <span className={`${badge.color} text-[10px] font-mono px-2 py-1 rounded uppercase`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Schedule */}
                  <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-slate-900/50 border border-slate-800/50">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <code className="text-xs font-mono text-slate-400">
                      {job.schedule.expr}
                    </code>
                    {job.schedule.tz && (
                      <span className="text-[10px] font-mono text-slate-600">
                        ({job.schedule.tz})
                      </span>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={job.enabled}
                          onCheckedChange={(checked) =>
                            updateMutation.mutate({ id: job.id, enabled: checked })
                          }
                          className="switch-glow"
                        />
                        <span className="text-xs font-mono text-slate-500">
                          {job.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runMutation.mutate(job.id)}
                        disabled={runMutation.isPending}
                        className="btn-glow border-emerald-900/50 bg-emerald-950/30 hover:bg-emerald-900/20 text-emerald-400 font-mono text-xs gap-1.5"
                      >
                        <Play className="w-3 h-3" />
                        Run
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const confirmed = window.confirm(`Delete cron job "${job.name}"?`)
                          if (confirmed) deleteMutation.mutate(job.id)
                        }}
                        className="btn-glow border-rose-900/50 bg-rose-950/30 hover:bg-rose-900/20 text-rose-400 font-mono text-xs gap-1.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* Last Run */}
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-slate-600">
                    <Clock className="w-3 h-3" />
                    Last run:{' '}
                    {job.state?.lastRunAtMs
                      ? new Date(job.state.lastRunAtMs).toLocaleString()
                      : 'Never'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
