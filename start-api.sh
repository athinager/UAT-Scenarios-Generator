#!/bin/bash
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
pkill -f "vercel dev" 2>/dev/null || true
sleep 1
vercel dev --listen 3000
