import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Radio, Link2, Loader2, Hash } from 'lucide-react'

interface ChannelsResponse {
  channels: Record<string, unknown>
  bindings: Array<Record<string, unknown>>
}

function renderChannelDetails(channel: unknown) {
  if (!channel || typeof channel !== 'object') return null
  const entries = Object.entries(channel as Record<string, unknown>)
  return (
    <div className="mt-3 space-y-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="rounded-lg border border-slate-800/50 bg-slate-900/50 px-3 py-2"
        >
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
            {key}
          </div>
          <div className="text-xs font-mono text-slate-300 break-all">
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
    return (
      <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading channels...
      </div>
    )
  }

  const channelEntries = Object.entries(data?.channels ?? {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <Radio className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Channels</h2>
          <p className="text-xs font-mono text-slate-500">
            {channelEntries.length} channels · {data?.bindings?.length ?? 0} bindings
          </p>
        </div>
      </div>

      {/* Channels Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {channelEntries.map(([name, details], index) => (
          <div
            key={name}
            className="card-glow rounded-xl p-5 animate-fade-in-up opacity-0"
            style={{
              animationDelay: `${index * 0.1}s`,
              animationFillMode: 'forwards',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" />
                <h3 className="text-base font-semibold text-slate-100">{name}</h3>
              </div>
              <span className="badge-glow-emerald text-[10px] font-mono px-2 py-0.5 rounded">
                Active
              </span>
            </div>
            {renderChannelDetails(details)}
          </div>
        ))}
      </div>

      {/* Bindings Section */}
      {(data?.bindings?.length ?? 0) > 0 && (
        <div
          className="card-glow rounded-xl p-5 animate-fade-in-up opacity-0"
          style={{
            animationDelay: `${channelEntries.length * 0.1}s`,
            animationFillMode: 'forwards',
          }}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/50">
            <Link2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Bindings
            </span>
            <span className="badge-glow-cyan text-[10px] font-mono px-2 py-0.5 rounded ml-auto">
              {data?.bindings?.length ?? 0}
            </span>
          </div>

          <div className="space-y-2">
            {(data?.bindings ?? []).map((binding, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-3"
              >
                <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap">
                  {JSON.stringify(binding, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {channelEntries.length === 0 && (
        <div className="card-glow rounded-xl p-12 flex flex-col items-center justify-center">
          <Radio className="w-12 h-12 mb-4 text-slate-700" />
          <span className="text-sm font-mono text-slate-500">No channels configured</span>
        </div>
      )}
    </div>
  )
}
