import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api'

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
  if (trimmed.startsWith('*/')) return { label: 'Every few minutes', color: 'bg-rose-500/20 text-rose-200' }
  if (trimmed.startsWith('0 *') || trimmed.startsWith('0 */'))
    return { label: 'Hourly', color: 'bg-yellow-500/20 text-yellow-200' }
  if (trimmed.includes(' 0 ') || trimmed.startsWith('0 0'))
    return { label: 'Daily', color: 'bg-emerald-500/20 text-emerald-200' }
  return { label: 'Custom', color: 'bg-slate-500/20 text-slate-200' }
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
    return <div className="text-sm text-slate-300">Loading cron jobs…</div>
  }

  return (
    <div className="space-y-4">
      {grouped.map(([destination, jobs]) => (
        <div key={destination} className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">{destination}</div>
          <div className="grid gap-3 lg:grid-cols-2">
            {jobs.map((job) => {
              const badge = frequencyBadge(job.schedule.expr)
              return (
                <Card key={job.id} className="border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-100">{job.name}</h3>
                      <p className="text-xs text-slate-400">{job.description ?? 'No description'}</p>
                    </div>
                    <Badge className={badge.color}>{badge.label}</Badge>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    {job.schedule.expr} {job.schedule.tz ? `(${job.schedule.tz})` : ''}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Enabled</span>
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(checked) => updateMutation.mutate({ id: job.id, enabled: checked })}
                      />
                    </div>
                    <Button variant="secondary" onClick={() => runMutation.mutate(job.id)}>
                      Run Now
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const confirmed = window.confirm(`Delete cron job "${job.name}"?`)
                        if (confirmed) deleteMutation.mutate(job.id)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Last run: {job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toLocaleString() : '—'}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
