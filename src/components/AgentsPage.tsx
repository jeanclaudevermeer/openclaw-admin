import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Editor from '@monaco-editor/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api'

interface AgentInfo {
  id: string
  name: string
  emoji?: string
  workspace: string | null
  files: Record<string, boolean>
}

interface SkillInfo {
  name: string
  description: string
  group: string
}

const agentFiles = [
  { key: 'SOUL.md', label: 'SOUL.md' },
  { key: 'USER.md', label: 'USER.md' },
  { key: 'AGENTS.md', label: 'AGENTS.md' },
  { key: 'MEMORY.md', label: 'MEMORY.md' },
  { key: 'TOOLS.md', label: 'TOOLS.md' },
]

export function AgentsPage() {
  const queryClient = useQueryClient()
  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiFetch<AgentInfo[]>('/api/agents'),
  })
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState(agentFiles[0].key)

  useEffect(() => {
    if (!selectedAgentId && agents && agents.length > 0) {
      setSelectedAgentId(agents[0].id)
    }
  }, [agents, selectedAgentId])

  const selectedAgent = useMemo(
    () => agents?.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )

  const fileQuery = useQuery({
    queryKey: ['agent-file', selectedAgentId, activeFile],
    queryFn: () =>
      apiFetch<{ content: string }>(`/api/agents/${selectedAgentId}/file/${activeFile}`),
    enabled: Boolean(selectedAgentId) && activeFile !== 'skills',
  })

  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (fileQuery.data?.content !== undefined) {
      setDraft(fileQuery.data.content)
    }
  }, [fileQuery.data?.content])

  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      apiFetch(`/api/agents/${selectedAgentId}/file/${activeFile}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['agent-file', selectedAgentId, activeFile],
      })
    },
  })

  const { data: allSkills = [] } = useQuery({
    queryKey: ['skills-all'],
    queryFn: () => apiFetch<SkillInfo[]>('/api/skills/all'),
  })

  const { data: enabledSkills = [] } = useQuery({
    queryKey: ['agent-skills', selectedAgentId],
    queryFn: () => apiFetch<string[]>(`/api/agents/${selectedAgentId}/skills`),
    enabled: Boolean(selectedAgentId),
  })

  const [skillFilter, setSkillFilter] = useState('')

  const filteredSkills = useMemo(() => {
    const query = skillFilter.toLowerCase().trim()
    if (!query) return allSkills
    return allSkills.filter((skill) =>
      [skill.name, skill.description, skill.group].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [allSkills, skillFilter])

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, SkillInfo[]>()
    for (const skill of filteredSkills) {
      const key = skill.group || 'Other'
      const current = groups.get(key) ?? []
      current.push(skill)
      groups.set(key, current)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredSkills])

  const toggleSkill = async (skillName: string, enable: boolean) => {
    const action = enable ? 'enable' : 'disable'
    await apiFetch(`/api/agents/${selectedAgentId}/skills/${skillName}/${action}`, {
      method: 'POST',
    })
    queryClient.invalidateQueries({ queryKey: ['agent-skills', selectedAgentId] })
  }

  const handleEnableAll = async () => {
    await apiFetch(`/api/agents/${selectedAgentId}/skills/enable-all`, {
      method: 'POST',
    })
    queryClient.invalidateQueries({ queryKey: ['agent-skills', selectedAgentId] })
  }

  const handleDisableAll = async () => {
    const confirmed = window.confirm('Disable all skills for this agent?')
    if (!confirmed) return
    await apiFetch(`/api/agents/${selectedAgentId}/skills/disable-all`, {
      method: 'POST',
    })
    queryClient.invalidateQueries({ queryKey: ['agent-skills', selectedAgentId] })
  }

  if (isLoading) {
    return <div className="text-sm text-slate-300">Loading agents…</div>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card className="border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">Agents</div>
        <div className="space-y-2">
          {agents?.map((agent) => (
            <button
              key={agent.id}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                selectedAgentId === agent.id
                  ? 'border-emerald-400/40 bg-emerald-400/10'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
              }`}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                  {agent.id === 'main' ? (
                    <img src="/jean-clawd.jpg" alt="Jean-Clawd" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span>{agent.emoji ?? '🤖'}</span>
                  )}
                  {agent.name}
                </div>
                <div className="text-xs text-slate-500">{agent.id}</div>
              </div>
              <Badge variant="secondary">
                {Object.values(agent.files).filter(Boolean).length} files
              </Badge>
            </button>
          ))}
        </div>
      </Card>

      <Card className="border-slate-800 bg-slate-900/40 p-4">
        {selectedAgent ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
                  {selectedAgent.id === 'main' ? (
                    <img src="/jean-clawd.jpg" alt="Jean-Clawd" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <span>{selectedAgent.emoji ?? '🤖'}</span>
                  )}
                  {selectedAgent.name}
                </h2>
                <p className="text-xs text-slate-500">Workspace: {selectedAgent.workspace ?? '—'}</p>
              </div>
              <Badge variant="outline">{selectedAgent.id}</Badge>
            </div>

            <Tabs value={activeFile} onValueChange={setActiveFile}>
              <TabsList className="bg-slate-800 border border-slate-700">
                {agentFiles.map((file) => (
                  <TabsTrigger key={file.key} value={file.key}>
                    {file.label}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="skills">Skills</TabsTrigger>
              </TabsList>

              {agentFiles.map((file) => (
                <TabsContent key={file.key} value={file.key} className="mt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      {selectedAgent.files[file.key] ? 'File exists' : 'File will be created on save'}
                    </div>
                    <Button
                      onClick={() => saveMutation.mutate(draft)}
                      disabled={saveMutation.isPending || draft === fileQuery.data?.content}
                    >
                      {saveMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                  <div className="h-[520px] overflow-hidden rounded-md border border-slate-800">
                    <Editor
                      language="markdown"
                      theme="vs-dark"
                      value={draft}
                      onChange={(value) => setDraft(value ?? '')}
                      options={{
                        wordWrap: 'on',
                        minimap: { enabled: false },
                        fontSize: 13,
                      }}
                    />
                  </div>
                  {saveMutation.isError && (
                    <p className="mt-2 text-xs text-rose-300">
                      {saveMutation.error instanceof Error
                        ? saveMutation.error.message
                        : 'Failed to save file'}
                    </p>
                  )}
                </TabsContent>
              ))}

              <TabsContent value="skills" className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="max-w-sm"
                    placeholder="Search skills…"
                    value={skillFilter}
                    onChange={(event) => setSkillFilter(event.target.value)}
                  />
                  <Button variant="secondary" onClick={handleEnableAll}>
                    Enable All
                  </Button>
                  <Button variant="outline" onClick={handleDisableAll}>
                    Disable All
                  </Button>
                </div>
                <div className="space-y-4">
                  {groupedSkills.map(([group, skills]) => (
                    <div key={group} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                      <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">{group}</div>
                      <div className="space-y-2">
                        {skills.map((skill) => {
                          const enabled = enabledSkills.includes(skill.name)
                          return (
                            <div
                              key={skill.name}
                              className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2"
                            >
                              <div>
                                <div className="text-sm text-slate-100">{skill.name}</div>
                                <div className="text-xs text-slate-400">{skill.description}</div>
                              </div>
                              <Switch
                                checked={enabled}
                                onCheckedChange={(checked) => toggleSkill(skill.name, checked)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-sm text-slate-400">Select an agent to begin.</div>
        )}
      </Card>
    </div>
  )
}
