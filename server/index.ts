import { serve, getRequestListener } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { readFile, writeFile, readdir, stat, mkdir, rm, cp } from 'fs/promises'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { homedir } from 'os'
import { execSync } from 'child_process'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = join(__dirname, '..', 'dist')

const app = new Hono()

// Server bind IP for CORS
const BIND_IP = '127.0.0.1'
const PORT = 5180

// CORS - restricted to same origin
app.use('/api/*', cors({
  origin: `http://${BIND_IP}:${PORT}`,
  credentials: true,
}))

// Password authentication
const PASSWORD = process.env.OPENCLAW_ADMIN_PASSWORD
if (!PASSWORD) {
  console.error('ERROR: OPENCLAW_ADMIN_PASSWORD environment variable is required')
  process.exit(1)
}

app.use('/api/*', async (c, next) => {
  const providedPassword = c.req.header('X-Password')
  if (providedPassword !== PASSWORD) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
})

const OPENCLAW_DIR = join(homedir(), '.openclaw')
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, 'openclaw.json')
const OPENCLAW_AGENTS = join(OPENCLAW_DIR, 'agents')
const OPENCLAW_CRON = join(OPENCLAW_DIR, 'cron', 'jobs.json')
const SKILLS_SOURCE = join(homedir(), 'openclaw', 'skills')
const ALLOWED_FILES = new Set(['SOUL.md', 'USER.md', 'AGENTS.md', 'MEMORY.md', 'TOOLS.md', 'IDENTITY.md', 'HEARTBEAT.md'])

// Gateway connection cache
let gatewayInfo: { url: string; token: string } | null = null

async function getGatewayInfo() {
  if (gatewayInfo) return gatewayInfo
  const config = await readConfig()
  const port = config?.gateway?.port 
  const token = config?.gateway?.auth?.token ?? ''
  gatewayInfo = {
    url: `ws://127.0.0.1:${port}`,
    token,
  }
  return gatewayInfo
}

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

// Serve static files from dist/ (production build)
app.use('/*', serveStatic({ root: DIST_DIR }))

// SPA fallback - serve index.html for client-side routing
app.get('*', async (c) => {
  try {
    const html = await readFile(join(DIST_DIR, 'index.html'), 'utf-8')
    return c.html(html)
  } catch {
    return c.text('Not found - run npm run build first', 404)
  }
})

// Create HTTP server with Hono
const requestListener = getRequestListener(app.fetch)
const httpServer = createServer(requestListener)

// WebSocket server for gateway proxy
const wss = new WebSocketServer({ noServer: true })

httpServer.on('upgrade', async (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`)

  // Only handle /ws/gateway path
  if (url.pathname !== '/ws/gateway') {
    socket.destroy()
    return
  }

  // Check password from query param
  const providedPassword = url.searchParams.get('password')
  if (providedPassword !== PASSWORD) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

let connectionCounter = 0
let lastConnectionTime = 0
const MIN_CONNECTION_INTERVAL = 500 // ms

wss.on('connection', async (clientWs) => {
  const connId = ++connectionCounter
  const now = Date.now()

  // Rate limit: reject if connecting too fast
  if (now - lastConnectionTime < MIN_CONNECTION_INTERVAL) {
    console.log(`[WS Proxy] Client #${connId} rejected (rate limit)`)
    clientWs.close(1008, 'Rate limited')
    return
  }
  lastConnectionTime = now

  console.log(`[WS Proxy] Client #${connId} connected`)

  let gatewayWs: WebSocket | null = null
  let connected = false

  try {
    const { url, token } = await getGatewayInfo()
    gatewayWs = new WebSocket(url)

    gatewayWs.on('open', () => {
      console.log('[WS Proxy] Connected to gateway')
      connected = true

      // Perform handshake automatically
      const connectFrame = {
        type: 'req',
        id: randomUUID(),
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: 'gateway-client',
            displayName: 'openclaw-admin',
            version: '1.0.0',
            platform: 'linux',
            mode: 'ui',
            instanceId: randomUUID(),
          },
          auth: { token },
          role: 'operator',
          scopes: ['operator.admin'],
        },
      }
      gatewayWs!.send(JSON.stringify(connectFrame))
    })

    gatewayWs.on('message', (data) => {
      const msg = data.toString()
      try {
        const frame = JSON.parse(msg)
        console.log(`[WS Proxy] Gateway -> Client: ${frame.type} ${frame.event || frame.method || ''} ${frame.ok !== undefined ? (frame.ok ? 'OK' : 'FAIL') : ''}`)
      } catch {
        console.log(`[WS Proxy] Gateway -> Client: (unparseable)`)
      }
      // Forward all messages from gateway to client
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(msg)
      }
    })

    gatewayWs.on('error', (err) => {
      console.error('[WS Proxy] Gateway error:', err.message)
      clientWs.close(1011, 'Gateway error')
    })

    gatewayWs.on('close', (code, reason) => {
      console.log(`[WS Proxy] Gateway disconnected - code: ${code}, reason: ${reason?.toString() || 'none'}`)
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1000, 'Gateway closed')
      }
    })

  } catch (err) {
    console.error('[WS Proxy] Failed to connect to gateway:', err)
    clientWs.close(1011, 'Failed to connect to gateway')
    return
  }

  // Forward messages from client to gateway (except connect, which we handle)
  clientWs.on('message', (data) => {
    if (!connected || !gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
      return
    }

    try {
      const frame = JSON.parse(data.toString())
      console.log(`[WS Proxy] Client #${connId} -> Gateway: ${frame.method || frame.type}`)
      // Skip connect requests from client - we already handled it
      if (frame.method === 'connect') {
        return
      }
      gatewayWs.send(data.toString())
    } catch {
      gatewayWs.send(data.toString())
    }
  })

  clientWs.on('close', (code, reason) => {
    console.log(`[WS Proxy] Client disconnected - code: ${code}, reason: ${reason?.toString() || 'none'}`)
    if (gatewayWs && gatewayWs.readyState === WebSocket.OPEN) {
      gatewayWs.close()
    }
  })

  clientWs.on('error', (err) => {
    console.error('[WS Proxy] Client error:', err.message)
  })
})

// Start server
httpServer.listen(PORT, BIND_IP, () => {
  console.log(`OpenClaw Admin running at http://${BIND_IP}:${PORT}`)
})
