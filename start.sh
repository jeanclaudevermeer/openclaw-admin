#!/bin/bash
export PATH="/home/linuxbrew/.linuxbrew/bin:/home/clawdbot/.local/bin:$PATH"
cd /home/clawdbot/Projects/openclaw-admin
exec npm run dev
