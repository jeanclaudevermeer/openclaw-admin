import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { apiFetch } from '@/lib/api'

interface SkillInfo {
  name: string
  description: string
  group: string
  source: string
}

export function SkillsPage() {
  const { data: skills = [], isLoading, isError } = useQuery({
    queryKey: ['skills-all'],
    queryFn: () => apiFetch<SkillInfo[]>('/api/skills/all'),
  })
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const query = filter.toLowerCase().trim()
    if (!query) return skills
    return skills.filter((skill) =>
      [skill.name, skill.description, skill.group, skill.source].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [skills, filter])

  if (isLoading) {
    return <div className="text-sm text-slate-300">Loading skills…</div>
  }

  if (isError) {
    return <div className="text-sm text-rose-300">Failed to load skills.</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Skill Library</h2>
          <p className="text-xs text-slate-400">Browse all available skills across shared and extra directories.</p>
        </div>
        <Input
          className="max-w-xs"
          placeholder="Search skills…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((skill) => (
          <Card key={skill.name} className="border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-100">{skill.name}</h3>
                <p className="text-xs text-slate-400">{skill.description}</p>
              </div>
              <Badge variant="secondary">{skill.group || 'Other'}</Badge>
            </div>
            <div className="mt-3 text-xs text-slate-500">Source: {skill.source}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}
