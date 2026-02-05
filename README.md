# OpenClaw Admin

A web-based admin dashboard for [OpenClaw](https://github.com/openclaw/openclaw) — the open-source AI agent framework.

## Features

- **Chat** — Real-time chat interface with streaming responses
- **Agents** — View and manage running agents
- **Skills** — Browse available skills and their configurations
- **Cron** — Monitor scheduled tasks
- **Channels** — View connected channels (Discord, Telegram, etc.)
- **Config** — View gateway configuration

## Prerequisites

- Node.js 18+
- A running OpenClaw gateway (default: `127.0.0.1:<port>`)

## Setup

```bash
# Clone the repo
git clone https://github.com/jeanclaudevermeer/openclaw-admin.git
cd openclaw-admin

# Install dependencies
npm install

# Set your admin password
export OPENCLAW_ADMIN_PASSWORD="your-password-here"

# Optional: bind to specific IP (defaults to 127.0.0.1)
export OPENCLAW_ADMIN_HOST="127.0.0.1"
export OPENCLAW_ADMIN_PORT="5180"

# Start the server
npm run dev
```

The dashboard will be available at `http://localhost:5180`

## Configuration

The server reads gateway connection info from `~/.openclaw/openclaw.json` (the standard OpenClaw config location).

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Hono (server)
- WebSocket proxy for real-time chat

## License

MIT
