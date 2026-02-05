import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api'
import {
  FileText,
  User,
  Users,
  Brain,
  Wrench,
  Sparkles,
  Save,
  Check,
  Loader2,
  FolderOpen,
} from 'lucide-react'

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
  { key: 'SOUL.md', label: 'Soul', icon: Sparkles },
  { key: 'USER.md', label: 'User', icon: User },
  { key: 'AGENTS.md', label: 'Agents', icon: Users },
  { key: 'MEMORY.md', label: 'Memory', icon: Brain },
  { key: 'TOOLS.md', label: 'Tools', icon: Wrench },
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
    return (
      <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading agents...
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Agent List */}
      <div className="card-glow rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
            Agents
          </span>
          <span className="ml-auto text-xs font-mono text-slate-600">
            {agents?.length ?? 0}
          </span>
        </div>

        <div className="space-y-2">
          {agents?.map((agent, index) => (
            <button
              key={agent.id}
              className={`group w-full flex items-center gap-3 rounded-lg p-3 text-left transition-all duration-200 animate-fade-in-up opacity-0 ${
                selectedAgentId === agent.id
                  ? 'card-glow-selected bg-emerald-400/5'
                  : 'hover:bg-slate-800/50 border border-transparent hover:border-slate-700/50'
              }`}
              style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <div className="relative">
                {agent.id === 'main' ? (
                  <img
                    src="/jean-clawd.jpg"
                    alt={agent.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-700/50"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-lg">
                    {agent.emoji ?? '🤖'}
                  </div>
                )}
                {selectedAgentId === agent.id && (
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate">
                  {agent.name}
                </div>
                <div className="text-xs font-mono text-slate-500 truncate">
                  {agent.id}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-mono text-slate-600 uppercase">
                  Files
                </span>
                <span className="badge-glow-cyan text-[10px] font-mono px-1.5 py-0.5 rounded">
                  {Object.values(agent.files).filter(Boolean).length}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Agent Details */}
      <div className="card-glow rounded-xl p-4">
        {selectedAgent ? (
          <div className="space-y-3">
            {/* Agent Header - Compact */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/50">
              <div className="flex items-center gap-3">
                {selectedAgent.id === 'main' ? (
                  <img
                    src="/jean-clawd.jpg"
                    alt={selectedAgent.name}
                    className="w-9 h-9 rounded-lg object-cover border border-slate-700/50"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/50 flex items-center justify-center text-xl">
                    {selectedAgent.emoji ?? '🤖'}
                  </div>
                )}
                <div>
                  <h2 className="text-base font-semibold text-slate-100">
                    {selectedAgent.name}
                  </h2>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                    <FolderOpen className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[250px]">
                      {selectedAgent.workspace ?? 'No workspace'}
                    </span>
                  </div>
                </div>
              </div>
              <span className="badge-glow-cyan text-[10px] font-mono px-1.5 py-0.5 rounded">
                {selectedAgent.id}
              </span>
            </div>

            {/* File Tabs */}
            <Tabs value={activeFile} onValueChange={setActiveFile}>
              <TabsList className="tab-list-glow rounded-md w-full justify-start h-9">
                {agentFiles.map((file) => {
                  const Icon = file.icon
                  return (
                    <TabsTrigger
                      key={file.key}
                      value={file.key}
                      className="tab-trigger-glow flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium"
                    >
                      <Icon className="w-3 h-3" />
                      {file.label}
                    </TabsTrigger>
                  )
                })}
                <TabsTrigger
                  value="skills"
                  className="tab-trigger-glow flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium"
                >
                  <Sparkles className="w-3 h-3" />
                  Skills
                </TabsTrigger>
              </TabsList>

              {agentFiles.map((file) => (
                <TabsContent key={file.key} value={file.key} className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                      <FileText className="w-3 h-3" />
                      {selectedAgent.files[file.key] ? (
                        <span className="text-emerald-400/80">exists</span>
                      ) : (
                        <span className="text-amber-400/80">new</span>
                      )}
                    </div>
                    <Button
                      onClick={() => saveMutation.mutate(draft)}
                      disabled={saveMutation.isPending || draft === fileQuery.data?.content}
                      className={`btn-glow gap-1.5 text-[10px] font-mono h-7 px-2.5 ${
                        draft !== fileQuery.data?.content
                          ? 'btn-primary-glow text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                      size="sm"
                    >
                      {saveMutation.isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          SAVING
                        </>
                      ) : saveMutation.isSuccess && draft === fileQuery.data?.content ? (
                        <>
                          <Check className="w-3 h-3" />
                          SAVED
                        </>
                      ) : (
                        <>
                          <Save className="w-3 h-3" />
                          SAVE
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="editor-container h-[calc(100vh-300px)] min-h-[400px]">
                    <Editor
                      language="markdown"
                      theme="vs-dark"
                      value={draft}
                      onChange={(value) => setDraft(value ?? '')}
                      options={{
                        wordWrap: 'on',
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', monospace",
                        padding: { top: 16 },
                        lineHeight: 1.6,
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>

                  {saveMutation.isError && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-mono text-rose-400">
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full" />
                      {saveMutation.error instanceof Error
                        ? saveMutation.error.message
                        : 'Failed to save file'}
                    </div>
                  )}
                </TabsContent>
              ))}

              <TabsContent value="skills" className="mt-3">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Input
                    className="input-glow flex-1 max-w-[200px] bg-slate-900/60 border-slate-700/50 text-xs font-mono h-8"
                    placeholder="Search..."
                    value={skillFilter}
                    onChange={(event) => setSkillFilter(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnableAll}
                    className="btn-glow border-emerald-900/50 bg-emerald-950/30 hover:bg-emerald-900/20 text-emerald-400 font-mono text-[10px] h-8 px-2"
                  >
                    Enable All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisableAll}
                    className="btn-glow border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 font-mono text-[10px] h-8 px-2"
                  >
                    Disable All
                  </Button>
                  <span className="ml-auto text-[10px] font-mono text-slate-600">
                    {enabledSkills.length}/{allSkills.length} enabled
                  </span>
                </div>

                <div className="h-[calc(100vh-340px)] min-h-[300px] overflow-y-auto pr-1 space-y-3">
                  {groupedSkills.map(([group, skills], groupIndex) => (
                    <div
                      key={group}
                      className="animate-fade-in-up opacity-0"
                      style={{
                        animationDelay: `${groupIndex * 0.05}s`,
                        animationFillMode: 'forwards',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-slate-900/95 backdrop-blur-sm py-1 z-10">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                          {group}
                        </span>
                        <div className="flex-1 h-px bg-slate-800/50" />
                        <span className="text-[10px] font-mono text-slate-600">
                          {skills.length}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-1">
                        {skills.map((skill) => {
                          const enabled = enabledSkills.includes(skill.name)
                          return (
                            <div
                              key={skill.name}
                              className={`flex items-center gap-3 rounded-md border px-3 py-1.5 transition-all duration-150 ${
                                enabled
                                  ? 'border-emerald-400/20 bg-emerald-400/5'
                                  : 'border-slate-800/30 bg-slate-950/20 hover:border-slate-700/50'
                              }`}
                            >
                              <Switch
                                checked={enabled}
                                onCheckedChange={(checked) => toggleSkill(skill.name, checked)}
                                className="switch-glow scale-90"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-slate-200">
                                  {skill.name}
                                </span>
                                <span className="text-[10px] text-slate-500 ml-2 hidden sm:inline">
                                  {skill.description.length > 50
                                    ? skill.description.slice(0, 50) + '...'
                                    : skill.description}
                                </span>
                              </div>
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
          <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
            <Users className="w-12 h-12 mb-4 text-slate-700" />
            <span className="text-sm font-mono">Select an agent to begin</span>
          </div>
        )}
      </div>
    </div>
  )
}
