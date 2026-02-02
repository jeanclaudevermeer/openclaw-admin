import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { readFile, writeFile, readdir, stat, mkdir, rm, cp } from 'fs/promises'
import { join, resolve } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'

const app = new Hono()
app.use('/*', cors())

const OPENCLAW_DIR = join(homedir(), '.openclaw')
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, 'openclaw.json')
const OPENCLAW_AGENTS = join(OPENCLAW_DIR, 'agents')
const OPENCLAW_CRON = join(OPENCLAW_DIR, 'cron', 'jobs.json')
const SKILLS_SOURCE = join(homedir(), 'openclaw', 'skills')
const ALLOWED_FILES = new Set(['SOUL.md', 'USER.md', 'AGENTS.md', 'MEMORY.md', 'TOOLS.md', 'IDENTITY.md', 'HEARTBEAT.md'])

interface AgentConfig {
  id?: string
  identity?: { name?: string; emoji?: string }
  name?: string
  emoji?: string
  workspace?: string
  workspaceDir?: string
  paths?: { workspace?: string }
}

async function readConfig() {
  const raw = await readFile(OPENCLAW_CONFIG, 'utf-8')
  return JSON.parse(raw)
}

function resolveWorkspace(agent: AgentConfig): string | null {
  return (
    agent.workspace ||
    agent.workspaceDir ||
    agent.paths?.workspace ||
    (agent as { workspacePath?: string }).workspacePath ||
    null
  )
}

async function listAgents() {
  // OpenClaw stores agents in ~/.openclaw/agents/<id>/
  // Each agent has a workspace at ~/.openclaw/agents/<id>/workspace/ or configured elsewhere
  const config = await readConfig()
  const defaultWorkspace = config?.agents?.defaults?.workspace
  
  let agentDirs: string[] = []
  try {
    agentDirs = await readdir(OPENCLAW_AGENTS)
  } catch {
    return []
  }

  const agents = await Promise.all(
    agentDirs.map(async (agentId) => {
      const agentPath = join(OPENCLAW_AGENTS, agentId)
      const agentInfo = await stat(agentPath)
      if (!agentInfo.isDirectory()) return null

      // Try to find workspace - check agent config or use default
      let workspace = defaultWorkspace
      try {
        const agentConfigPath = join(agentPath, 'agent', 'config.json')
        const agentConfig = JSON.parse(await readFile(agentConfigPath, 'utf-8'))
        workspace = agentConfig?.workspace ?? agentConfig?.workspaceDir ?? defaultWorkspace
      } catch {
        // No agent config, use default workspace
      }

      // Read identity from workspace IDENTITY.md if exists
      let name = agentId
      let emoji = '🤖'
      if (workspace) {
        try {
          const identityPath = join(workspace, 'IDENTITY.md')
          const identityContent = await readFile(identityPath, 'utf-8')
          const nameMatch = identityContent.match(/\*\*Name:\*\*\s*(.+)/i)
          const emojiMatch = identityContent.match(/\*\*Emoji:\*\*\s*(.+)/i)
          if (nameMatch) name = nameMatch[1].trim()
          if (emojiMatch) emoji = emojiMatch[1].trim()
        } catch {
          // No identity file
        }
      }

      const files: Record<string, boolean> = {}
      for (const file of Array.from(ALLOWED_FILES)) {
        if (!workspace) {
          files[file] = false
          continue
        }
        try {
          const info = await stat(join(workspace, file))
          files[file] = info.isFile()
        } catch {
          files[file] = false
        }
      }

      return {
        id: agentId,
        name,
        emoji,
        workspace,
        files,
      }
    }),
  )

  return agents.filter((a): a is NonNullable<typeof a> => a !== null)
}

function parseFrontmatter(content: string) {
  if (!content.startsWith('---')) return null
  const end = content.indexOf('\n---', 3)
  if (end === -1) return null
  const raw = content.slice(3, end).trim()
  const data: Record<string, string> = {}
  for (const line of raw.split('\n')) {
    const [key, ...rest] = line.split(':')
    if (!key || rest.length === 0) continue
    data[key.trim()] = rest.join(':').trim().replace(/^"|"$/g, '')
  }
  return data
}

async function collectSkillDirs() {
  const config = await readConfig()
  const extraDirs: string[] = config?.skills?.load?.extraDirs ?? []
  const dirs = [SKILLS_SOURCE, ...extraDirs]
  return dirs
}

async function listSkills() {
  const dirs = await collectSkillDirs()
  const results: { name: string; description: string; group: string; source: string; path: string }[] = []

  for (const dir of dirs) {
    let entries: string[] = []
    try {
      entries = await readdir(dir)
    } catch {
      continue
    }

    for (const entry of entries) {
      const skillPath = join(dir, entry)
      try {
        const info = await stat(skillPath)
        if (!info.isDirectory()) continue
        const skillFile = join(skillPath, 'SKILL.md')
        const content = await readFile(skillFile, 'utf-8')
        const meta = parseFrontmatter(content) ?? {}
        results.push({
          name: meta.name ?? entry,
          description: meta.description ?? 'No description provided',
          group: meta.group ?? 'General',
          source: dir,
          path: skillPath,
        })
      } catch {
        continue
      }
    }
  }

  return results
}

async function resolveSkillPath(skillName: string) {
  const skills = await listSkills()
  const match = skills.find((skill) => skill.name === skillName)
  return match?.path ?? null
}

app.get('/api/gateway/status', async (c) => {
  let connected = false
  let statusInfo: Record<string, unknown> = {}
  try {
    const output = execSync('openclaw gateway status --json 2>/dev/null', { encoding: 'utf-8' })
    statusInfo = JSON.parse(output)
    // Check rpc.ok or service.runtime.status === 'running'
    const rpc = statusInfo.rpc as { ok?: boolean } | undefined
    const service = statusInfo.service as { runtime?: { status?: string } } | undefined
    connected = Boolean(rpc?.ok || service?.runtime?.status === 'running')
  } catch {
    // Try a simple check if the process is running
    try {
      execSync('pgrep -f "openclaw.*gateway"', { encoding: 'utf-8' })
      connected = true
    } catch {
      connected = false
    }
  }

  const config = await readConfig()
  const agents = await listAgents()
  const agentCount = agents.length
  
  // Extract port from status or config
  const portInfo = statusInfo.port as { port?: number } | undefined
  const gatewayInfo = statusInfo.gateway as { port?: number; bindMode?: string } | undefined
  const gateway = config?.gateway ?? {}
  const port = gatewayInfo?.port ?? portInfo?.port ?? gateway?.port 
  const mode = gatewayInfo?.bindMode ?? gateway?.mode ?? 'local'

  return c.json({ connected, port, mode, agentCount })
})

app.post('/api/gateway/restart', async (c) => {
  execSync('openclaw gateway restart', { stdio: 'pipe' })
  return c.json({ ok: true })
})

app.get('/api/agents', async (c) => {
  const agents = await listAgents()
  return c.json(agents)
})

app.get('/api/agents/:id/file/:filename', async (c) => {
  const { id, filename } = c.req.param()
  if (!ALLOWED_FILES.has(filename)) {
    return c.json({ error: 'Invalid file' }, 400)
  }
  const agents = await listAgents()
  const agent = agents.find((item) => item.id === id)
  if (!agent?.workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }
  const filePath = resolve(join(agent.workspace, filename))
  if (!filePath.startsWith(resolve(agent.workspace))) {
    return c.json({ error: 'Invalid path' }, 400)
  }
  let content = ''
  try {
    content = await readFile(filePath, 'utf-8')
  } catch {
    content = ''
  }
  return c.json({ content })
})

app.put('/api/agents/:id/file/:filename', async (c) => {
  const { id, filename } = c.req.param()
  if (!ALLOWED_FILES.has(filename)) {
    return c.json({ error: 'Invalid file' }, 400)
  }
  const agents = await listAgents()
  const agent = agents.find((item) => item.id === id)
  if (!agent?.workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }
  const body = await c.req.json()
  const content = body?.content ?? ''
  const filePath = resolve(join(agent.workspace, filename))
  if (!filePath.startsWith(resolve(agent.workspace))) {
    return c.json({ error: 'Invalid path' }, 400)
  }
  await mkdir(agent.workspace, { recursive: true })
  await writeFile(filePath, content, 'utf-8')
  return c.json({ ok: true })
})

app.get('/api/agents/:id/skills', async (c) => {
  const { id } = c.req.param()
  const agents = await listAgents()
  const agent = agents.find((item) => item.id === id)
  if (!agent?.workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }
  const skillRoot = join(agent.workspace, 'skills')
  let entries: string[] = []
  try {
    entries = await readdir(skillRoot)
  } catch {
    return c.json([])
  }
  const enabled: string[] = []
  for (const entry of entries) {
    try {
      const info = await stat(join(skillRoot, entry))
      if (info.isDirectory()) enabled.push(entry)
    } catch {
      continue
    }
  }
  return c.json(enabled)
})

app.get('/api/skills/all', async (c) => {
  const skills = await listSkills()
  return c.json(skills.map(({ path, ...rest }) => rest))
})

app.post('/api/agents/:agentId/skills/:skillName/enable', async (c) => {
  const { agentId, skillName } = c.req.param()
  const agents = await listAgents()
  const agent = agents.find((item) => item.id === agentId)
  if (!agent?.workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }
  const sourcePath = await resolveSkillPath(skillName)
  if (!sourcePath) {
    return c.json({ error: 'Skill not found' }, 404)
  }
  const targetDir = join(agent.workspace, 'skills', skillName)
  await mkdir(join(agent.workspace, 'skills'), { recursive: true })
  await cp(sourcePath, targetDir, { recursive: true })
  return c.json({ ok: true })
})

app.post('/api/agents/:agentId/skills/:skillName/disable', async (c) => {
  const { agentId, skillName } = c.req.param()
  const agents = await listAgents()
  const agent = agents.find((item) => item.id === agentId)
  if (!agent?.workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }
  const targetDir = join(agent.workspace, 'skills', skillName)
  await rm(targetDir, { recursive: true, force: true })
  return c.json({ ok: true })
})

app.post('/api/agents/:agentId/skills/enable-all', async (c) => {
  const { agentId } = c.req.param()
  const agents = await listAgents()
  const agent = agents.find((item) => item.id === agentId)
  if (!agent?.workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }
  const skills = await listSkills()
  await mkdir(join(agent.workspace, 'skills'), { recursive: true })
  for (const skill of skills) {
    const targetDir = join(agent.workspace, 'skills', skill.name)
    await cp(skill.path, targetDir, { recursive: true })
  }
  return c.json({ ok: true })
})

app.post('/api/agents/:agentId/skills/disable-all', async (c) => {
  const { agentId } = c.req.param()
  const agents = await listAgents()
  const agent = agents.find((item) => item.id === agentId)
  if (!agent?.workspace) {
    return c.json({ error: 'Workspace not found' }, 404)
  }
  const targetDir = join(agent.workspace, 'skills')
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(targetDir, { recursive: true })
  return c.json({ ok: true })
})

app.get('/api/cron', async (c) => {
  let content = ''
  try {
    content = await readFile(OPENCLAW_CRON, 'utf-8')
  } catch {
    return c.json({ jobs: [] })
  }
  const data = JSON.parse(content)
  return c.json({ jobs: data?.jobs ?? [] })
})

app.put('/api/cron/:id', async (c) => {
  const { id } = c.req.param()
  const data = JSON.parse(await readFile(OPENCLAW_CRON, 'utf-8'))
  const jobs = data?.jobs ?? []
  const index = jobs.findIndex((job: { id: string }) => job.id === id)
  if (index === -1) return c.json({ error: 'Job not found' }, 404)
  const payload = await c.req.json()
  jobs[index] = { ...jobs[index], ...payload }
  await writeFile(OPENCLAW_CRON, JSON.stringify({ ...data, jobs }, null, 2), 'utf-8')
  return c.json(jobs[index])
})

app.delete('/api/cron/:id', async (c) => {
  const { id } = c.req.param()
  const data = JSON.parse(await readFile(OPENCLAW_CRON, 'utf-8'))
  const jobs = data?.jobs ?? []
  const filtered = jobs.filter((job: { id: string }) => job.id !== id)
  await writeFile(OPENCLAW_CRON, JSON.stringify({ ...data, jobs: filtered }, null, 2), 'utf-8')
  return c.json({ ok: true })
})

app.post('/api/cron/:id/run', async (c) => {
  const { id } = c.req.param()
  execSync(`openclaw cron run ${id} --mode force`, { stdio: 'pipe' })
  return c.json({ ok: true })
})

app.get('/api/channels', async (c) => {
  const config = await readConfig()
  return c.json({
    channels: config?.channels ?? {},
    bindings: config?.bindings ?? [],
  })
})

app.get('/api/config', async (c) => {
  const config = await readConfig()
  return c.json(config)
})

serve({ fetch: app.fetch, port: 5181 })
