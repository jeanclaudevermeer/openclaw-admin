import { useQuery, useQueryClient } from '@tanstack/react-query'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { apiFetch } from '@/lib/api'

export function ConfigPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['config'],
    queryFn: () => apiFetch<Record<string, unknown>>('/api/config'),
  })

  if (isLoading) {
    return <div className="text-sm text-slate-300">Loading config…</div>
  }

  if (isError) {
    return <div className="text-sm text-rose-300">Failed to load config.</div>
  }

  return (
    <Card className="border-slate-800 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">openclaw.json</h2>
          <p className="text-xs text-slate-400">Read-only configuration snapshot.</p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['config'] })}>
          Refresh
        </Button>
      </div>
      <div className="h-[600px] overflow-hidden rounded-md border border-slate-800">
        <Editor
          language="json"
          theme="vs-dark"
          value={JSON.stringify(data, null, 2)}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
          }}
        />
      </div>
    </Card>
  )
}
