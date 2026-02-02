# Build Your Own OpenClaw Admin Dashboard

A comprehensive prompt for AI coding agents to build a visual admin interface for OpenClaw.

---

## Overview

Build a web-based admin dashboard for managing OpenClaw configurations, agents, skills, cron jobs, and channels. The dashboard should provide visual control over everything in `~/.openclaw/openclaw.json` and related files.

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Editor**: Monaco Editor (for markdown/JSON editing)
- **State**: TanStack Query (React Query) for data fetching
- **Backend**: Hono.js (lightweight Node.js server)

## Project Structure

```
openclaw-admin/
├── src/
│   ├── App.tsx              # Main app with tabs
│   ├── components/
│   │   ├── GatewayHeader.tsx    # Status bar
│   │   ├── AgentsPage.tsx       # Agent management
│   │   ├── SkillsPage.tsx       # Global skills browser
│   │   ├── ChannelsPage.tsx     # Channel visualization
│   │   ├── CronPage.tsx         # Cron job management
│   │   ├── ConfigPage.tsx       # Raw config viewer
│   │   └── ui/                  # shadcn components
│   └── lib/utils.ts
├── server/
│   └── index.ts             # API server
├── vite.config.ts
└── package.json
```

## Setup Commands

```bash
# Create project
npm create vite@latest openclaw-admin -- --template react-ts
cd openclaw-admin

# Install dependencies
npm install @tanstack/react-query @monaco-editor/react hono @hono/node-server lucide-react
npm install -D tailwindcss @tailwindcss/vite

# Add shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button badge card tabs switch input
```

## Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5180,
    host: '0.0.0.0', // Important for reverse proxy access
    proxy: {
      '/api': {
        target: 'http://localhost:5181',
        changeOrigin: true,
      },
    },
  },
});
```

---

## Feature 1: Gateway Header

A fixed header showing gateway status with real-time updates.

### Requirements
- Display connection status (pulsing green dot when connected)
- Show gateway port and mode
- Display agent count
- Refresh button to manually update status
- **Restart Gateway** button (calls `openclaw gateway restart`)

### API Endpoints

```typescript
// GET /api/gateway/status
// Returns gateway info from config + optional CLI status

// POST /api/gateway/restart  
// Executes: openclaw gateway restart
```

### UI Components
- Pulsing green/red dot for connection status
- Badge showing "Connected" / "Disconnected"
- Stats: port, mode, agent count
- Restart button with confirmation dialog

---

## Feature 2: Agents Page

Manage all configured agents with their workspace files.

### Layout
- **Left sidebar**: List of agents (emoji + name, clickable)
- **Right panel**: Tabs for the selected agent

### Agent List
Read from `~/.openclaw/openclaw.json` → `agents.list[]`

Each agent shows:
- Emoji (from `identity.emoji`)
- Name (from `identity.name` or `id`)
- Skill count

### File Tabs
For each agent, provide tabs to edit:
- `SOUL.md` - Agent personality
- `USER.md` - User info
- `AGENTS.md` - Agent instructions
- `MEMORY.md` - Long-term memory
- `TOOLS.md` - Tool-specific notes
- **Skills** - Skill management (see Feature 3)

### API Endpoints

```typescript
// GET /api/agents
// Returns agents list with workspace paths and file existence

// GET /api/agents/:id/file/:filename
// Returns file content from agent's workspace

// PUT /api/agents/:id/file/:filename
// Saves file content to agent's workspace
```

### Editor
Use Monaco Editor with:
- Markdown language mode
- Dark theme (`vs-dark`)
- Word wrap enabled
- No minimap

---

## Feature 3: Per-Agent Skills Management

Control which skills each agent has access to.

### Skill Sources
OpenClaw loads skills from:
1. `<workspace>/skills/` - Per-agent skills
2. `~/.openclaw/skills/` - Shared skills
3. `skills.load.extraDirs` - Additional directories
4. Bundled skills (can be disabled with `skills.allowBundled: []`)

### Skills Tab UI
- Search bar to filter skills
- **Enable All** / **Disable All** buttons
- Skills grouped by category (from SKILL.md frontmatter `group` field)
- Toggle switch for each skill

### Enable/Disable Logic

**Enable a skill:**
1. Copy skill folder from source to `<workspace>/skills/<skill-name>/`
2. Optionally update the skill's `sync.json` to track the agent

**Disable a skill:**
1. Delete `<workspace>/skills/<skill-name>/` folder
2. Optionally update `sync.json`

### API Endpoints

```typescript
// GET /api/skills/all
// Returns all available skills with metadata (name, description, group)

// POST /api/agents/:agentId/skills/:skillName/enable
// Copies skill to agent's workspace

// POST /api/agents/:agentId/skills/:skillName/disable
// Removes skill from agent's workspace

// POST /api/agents/:agentId/skills/enable-all
// Enables all skills for agent

// POST /api/agents/:agentId/skills/disable-all
// Removes all skills from agent
```

### Skill Metadata
Parse from `SKILL.md` frontmatter:
```yaml
---
name: skill-name
description: What this skill does
group: category-name
---
```

---

## Feature 4: Cron Jobs Management

Visual management of scheduled jobs.

### Data Source
Read from `~/.openclaw/cron/jobs.json`:
```json
{
  "version": 1,
  "jobs": [
    {
      "id": "uuid",
      "name": "job-name",
      "description": "What it does",
      "enabled": true,
      "schedule": {
        "kind": "cron",
        "expr": "0 9 * * *",
        "tz": "Europe/Warsaw"
      },
      "payload": {
        "kind": "agentTurn",
        "message": "/some-command",
        "channel": "telegram",
        "to": "-1001234567890",
        "threadId": "123"
      },
      "state": {
        "lastRunAtMs": 1234567890,
        "lastStatus": "ok"
      }
    }
  ]
}
```

### UI Requirements

**Group jobs by destination:**
- Parse `payload.channel`, `payload.to`, `payload.threadId`
- Display as: Platform → Group → Topic
- Map IDs to friendly names where possible

**Visual frequency indicators:**
- Color-coded badges based on schedule
- Daily = green, Hourly = yellow, Every few minutes = orange/red

**Actions per job:**
- ▶️ **Run Now** button - triggers immediate execution
- 🔄 **Enable/Disable** toggle
- 🗑️ **Delete** button

### API Endpoints

```typescript
// GET /api/cron
// Returns jobs array from jobs.json

// PUT /api/cron/:id
// Updates job (typically just { enabled: true/false })

// DELETE /api/cron/:id
// Removes job from jobs.json

// POST /api/cron/:id/run
// Executes: openclaw cron run <id> --mode force
```

---

## Feature 5: Channels Visualization

Display configured channels and their bindings.

### Data Source
From `~/.openclaw/openclaw.json`:
- `channels.telegram` - Telegram config with accounts
- `channels.discord` - Discord config with guilds
- `channels.slack` - Slack config
- `bindings` - Agent-to-channel mappings

### UI Requirements
- Show each channel type (Telegram, Discord, Slack, etc.)
- List accounts/bots under each channel
- Show which groups/guilds are configured
- Display bindings (which agent handles which channel)

### API Endpoint

```typescript
// GET /api/channels
// Returns { channels, bindings } from config
```

---

## Feature 6: Config Viewer

Read-only JSON viewer for the full config.

### Requirements
- Syntax-highlighted JSON display
- Use Monaco Editor in read-only mode with JSON language
- Refresh button to reload

### API Endpoint

```typescript
// GET /api/config
// Returns full openclaw.json content
```

---

## API Server Implementation

```typescript
// server/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFile, writeFile, readdir, stat, mkdir, rm, cp } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const app = new Hono();
app.use('/*', cors());

const OPENCLAW_CONFIG = join(homedir(), '.openclaw', 'openclaw.json');
const OPENCLAW_CRON = join(homedir(), '.openclaw', 'cron');
const SKILLS_SOURCE = join(homedir(), 'path', 'to', 'skills'); // Adjust this

// Implement endpoints as described above...

serve({ fetch: app.fetch, port: 5181 });
```

---

## Running the Dashboard

```bash
# Terminal 1: Start API server
npx tsx server/index.ts

# Terminal 2: Start frontend
npm run dev
```

Or create a combined script in package.json:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:client\" \"npm run dev:server\"",
    "dev:client": "vite",
    "dev:server": "tsx server/index.ts"
  }
}
```

---

## Security Notes

1. **Run locally only** - This dashboard has full access to your OpenClaw config
2. **No authentication** - Add auth if exposing to network
3. **File access** - Restricted to workspace and config directories
4. **Shell execution** - Only executes `openclaw` CLI commands

---

## Optional Enhancements

1. **WebSocket for real-time updates** - Connect to gateway for live status
2. **Session viewer** - Show active sessions and their history
3. **Log viewer** - Stream gateway logs
4. **Skill editor** - Edit SKILL.md files directly
5. **Config editor** - Edit openclaw.json with validation
6. **Dark/light mode** - Theme toggle

---

## Prompt for AI Agent

If giving this to an AI coding agent, use:

> Build an OpenClaw Admin Dashboard following the specifications in this document. 
> Start with the project setup, then implement features in order:
> 1. Basic app structure with tabs
> 2. Gateway header with status
> 3. Agents page with file editing
> 4. Skills management per agent
> 5. Cron jobs page
> 6. Channels visualization
> 7. Config viewer
>
> Use the exact tech stack specified. The OpenClaw config is at ~/.openclaw/openclaw.json.
> Test each feature before moving to the next.
