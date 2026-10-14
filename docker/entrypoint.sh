#!/usr/bin/env bash
# Container entrypoint.
#   (no arguments)  start the backend and the Vite frontend side by side, like `npm run dev`
#   login           sign in to Claude Code with your Claude subscription (once; kept in the claude-home volume)
#   <command…>      run anything else, e.g. `bash` or `claude auth status --text`
set -u

case "${1:-}" in
  login) exec claude auth login --claudeai ;;
  ?*) exec "$@" ;;
esac

if ! claude auth status --text >/dev/null 2>&1; then
  echo '[grillingstone] Not logged in to Claude. Grilling Sessions will fail until you run:'
  echo '[grillingstone]   docker compose -f docker/compose.yml run --rm grillingstone login'
fi

# The backend stays on the container's 127.0.0.1; only Vite listens on all interfaces, and it proxies /api to it.
node server/main.ts &
node node_modules/vite/bin/vite.js --host 0.0.0.0 &

stop() {
  kill -TERM $(jobs -p) 2>/dev/null
  wait
}
trap 'stop; exit 0' TERM INT
# When either process exits, stop the other, so the container never runs half the app.
wait -n
stop
