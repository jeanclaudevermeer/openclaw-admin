import { useQuery, useQueryClient } from '@tanstack/react-query'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import { Settings, RefreshCw, FileJson, Loader2 } from 'lucide-react'

export function ConfigPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['config'],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/config'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading configuration...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="card-glow rounded-xl p-12 flex flex-col items-center justify-center">
        <Settings className="w-12 h-12 mb-4 text-rose-400/50" />
        <span className="text-sm font-mono text-rose-400">Failed to load configuration</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Settings className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Configuration</h2>
            <p className="text-xs font-mono text-slate-500">
              Read-only snapshot of openclaw.json
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['config'] })}
          disabled={isFetching}
          className="btn-glow border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 gap-2 font-mono text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          REFRESH
        </Button>
      </div>

      {/* Config Editor */}
      <div className="card-glow rounded-xl p-5 animate-fade-in">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/50">
          <FileJson className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono text-slate-400">
            ~/.openclaw/openclaw.json
          </span>
          <span className="badge-glow-amber text-[10px] font-mono px-2 py-0.5 rounded ml-auto">
            Read Only
          </span>
        </div>

        <div className="editor-container h-[600px]">
          <Editor
            language="json"
            theme="vs-dark"
            value={JSON.stringify(data, null, 2)}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              padding: { top: 16 },
              lineHeight: 1.6,
              scrollBeyondLastLine: false,
              folding: true,
              foldingStrategy: 'indentation',
            }}
          />
        </div>
      </div>
    </div>
  )
}
