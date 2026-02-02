import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiFetch } from '@/lib/api'

interface ChannelsResponse {
  channels: Record<string, unknown>
  bindings: Array<Record<string, unknown>>
}

function renderChannelDetails(channel: unknown) {
  if (!channel || typeof channel !== 'object') return null
  const entries = Object.entries(channel as Record<string, unknown>)
  return (
    <div className="mt-2 space-y-2 text-xs text-slate-400">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2">
          <div className="text-[10px] uppercase text-slate-500">{key}</div>
          <div className="break-all text-slate-200">
            {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChannelsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: () => apiFetch<ChannelsResponse>('/api/channels'),
  })

  if (isLoading) {
    return <div className="text-sm text-slate-300">Loading channels…</div>
  }

  const channelEntries = Object.entries(data?.channels ?? {})

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {channelEntries.map(([name, details]) => (
          <Card key={name} className="border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">{name}</h3>
              <Badge variant="secondary">Configured</Badge>
            </div>
            {renderChannelDetails(details)}
          </Card>
        ))}
      </div>

      <Card className="border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-base font-semibold text-slate-100">Bindings</h3>
        <div className="mt-3 space-y-2 text-xs text-slate-300">
          {(data?.bindings ?? []).map((binding, index) => (
            <div key={index} className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
              {JSON.stringify(binding, null, 2)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
