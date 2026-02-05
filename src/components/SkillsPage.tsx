import { useMemo, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { apiFetch } from '@/lib/api'
import { Cpu, Loader2, FolderOpen, Bot, Search } from 'lucide-react'

interface SkillInfo {
  name: string
  description: string
  group: string
  source: string
}

interface AgentInfo {
  id: string
  name: string
  emoji?: string
}

export function SkillsPage() {
  const queryClient = useQueryClient()
  const { data: skills = [], isLoading, isError } = useQuery({
    queryKey: ['skills-all'],
    queryFn: () => apiFetch<SkillInfo[]>('/api/skills/all'),
  })
  const {
    data: agents = [],
    isLoading: isLoadingAgents,
    isError: isAgentError,
  } = useQuery({
    queryKey: ['agents'],
    queryFn: () => apiFetch<AgentInfo[]>('/api/agents'),
  })
  const [filter, setFilter] = useState('')
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set())

  const agentSkillQueries = useQueries({
    queries: agents.map((agent) => ({
      queryKey: ['agent-skills', agent.id],
      queryFn: () => apiFetch<string[]>(`/api/agents/${agent.id}/skills`),
      enabled: Boolean(agent.id),
    })),
  })

  const agentSkillsById = useMemo(() => {
    const map = new Map<string, Set<string>>()
    agents.forEach((agent, index) => {
      const skillsForAgent = agentSkillQueries[index]?.data ?? []
      map.set(agent.id, new Set(skillsForAgent))
    })
    return map
  }, [agents, agentSkillQueries])

  const isLoadingAgentSkills = agentSkillQueries.some((query) => query.isLoading)
  const isAgentSkillsError = agentSkillQueries.some((query) => query.isError)

  const filtered = useMemo(() => {
    const query = filter.toLowerCase().trim()
    if (!query) return skills
    return skills.filter((skill) =>
      [skill.name, skill.description, skill.group, skill.source].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [skills, filter])

  const groupedSkills = useMemo(() => {
    const groups = new Map<string, SkillInfo[]>()
    for (const skill of filtered) {
      const key = skill.group || 'Other'
      const current = groups.get(key) ?? []
      current.push(skill)
      groups.set(key, current)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const toggleSkill = async (agentId: string, skillName: string, enable: boolean) => {
    const action = enable ? 'enable' : 'disable'
    const key = `${agentId}::${skillName}`
    setPendingToggles((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    try {
      await apiFetch(`/api/agents/${agentId}/skills/${skillName}/${action}`, {
        method: 'POST',
      })
      await queryClient.invalidateQueries({ queryKey: ['agent-skills', agentId] })
    } finally {
      setPendingToggles((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  if (isLoading || isLoadingAgents) {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading skills...
      </div>
    )
  }

  if (isError || isAgentError) {
    return (
      <div className="card-glow rounded-xl p-12 flex flex-col items-center justify-center">
        <Cpu className="w-12 h-12 mb-4 text-rose-400/50" />
        <span className="text-sm font-mono text-rose-400">Failed to load skills</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <Cpu className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Skill Library</h2>
            <p className="text-xs font-mono text-slate-500">
              {skills.length} skills · {agents.length} agents
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            className="input-glow w-64 pl-10 bg-slate-900/60 border-slate-700/50 text-sm font-mono"
            placeholder="Search skills..."
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
      </div>

      {(isLoadingAgentSkills || isAgentSkillsError) && (
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          {isLoadingAgentSkills ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading agent coverage...
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              Some agent data failed to load
            </>
          )}
        </div>
      )}

      {/* Skill Groups */}
      <div className="space-y-6">
        {groupedSkills.map(([group, groupSkills], groupIndex) => (
          <div
            key={group}
            className="card-glow rounded-xl p-5 animate-fade-in-up opacity-0"
            style={{
              animationDelay: `${groupIndex * 0.1}s`,
              animationFillMode: 'forwards',
            }}
          >
            {/* Group Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
                  {group}
                </span>
              </div>
              <span className="badge-glow-cyan text-[10px] font-mono px-2 py-0.5 rounded">
                {groupSkills.length} skills
              </span>
            </div>

            {/* Skills */}
            <div className="space-y-4">
              {groupSkills.map((skill, skillIndex) => {
                const enabledAgents = agents.filter((agent) =>
                  agentSkillsById.get(agent.id)?.has(skill.name),
                )
                const pendingKeyPrefix = `::${skill.name}`

                return (
                  <div
                    key={skill.name}
                    className="rounded-lg border border-slate-800/50 bg-slate-900/30 p-4 animate-fade-in-up opacity-0"
                    style={{
                      animationDelay: `${(groupIndex * 0.1) + (skillIndex * 0.03)}s`,
                      animationFillMode: 'forwards',
                    }}
                  >
                    {/* Skill Info */}
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Cpu className="w-4 h-4 text-cyan-400/70" />
                          <h3 className="text-sm font-semibold text-slate-100">
                            {skill.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          {skill.description}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-600">
                          <span className="flex items-center gap-1">
                            <FolderOpen className="w-3 h-3" />
                            {skill.source.split('/').slice(-2).join('/')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            {enabledAgents.length}/{agents.length} agents
                          </span>
                        </div>
                      </div>
                      <span className="badge-glow-emerald text-[10px] font-mono px-2 py-0.5 rounded">
                        {skill.group || 'Other'}
                      </span>
                    </div>

                    {/* Agent Toggles */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800/30">
                      {agents.map((agent) => {
                        const enabled = agentSkillsById.get(agent.id)?.has(skill.name) ?? false
                        const pendingKey = `${agent.id}${pendingKeyPrefix}`
                        const isPending = pendingToggles.has(pendingKey)

                        return (
                          <div
                            key={`${agent.id}-${skill.name}`}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-200 ${
                              enabled
                                ? 'border-emerald-400/20 bg-emerald-400/5'
                                : 'border-slate-800/50 bg-slate-950/30 hover:border-slate-700/50'
                            }`}
                          >
                            <span className="text-xs text-slate-400">
                              {agent.emoji ?? '🤖'}
                            </span>
                            <span className="text-xs font-medium text-slate-300">
                              {agent.name}
                            </span>
                            <Switch
                              checked={enabled}
                              disabled={isPending}
                              onCheckedChange={(checked) =>
                                toggleSkill(agent.id, skill.name, checked)
                              }
                              className="switch-glow ml-1"
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
