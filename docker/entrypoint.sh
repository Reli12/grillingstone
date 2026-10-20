#!/usr/bin/env bash
# Container entrypoint.
#   (no arguments)              start the backend and the Vite frontend side by side, like `npm run dev`
#   login claude [--console]    sign in to Claude Code once (kept in the claude-home volume): your Claude subscription
#                               by default, or with --console an Anthropic API key from your Console account
#   login codex [options]       sign in to Codex once (kept in the codex-home volume): your ChatGPT plan through a
#                               one-time code, or with options passed to `codex login`, e.g. --with-api-key
#   login [--console]           the same as `login claude`, as before Codex was added
#   <command…>                  run anything else, e.g. `bash` or `codex login status`
set -u

case "${1:-}" in
  login)
    shift
    if [ "${1:-}" = codex ]; then
      shift
      # Codex's browser sign-in waits on the container's own localhost, which the host's browser can't reach, so
      # a ChatGPT sign-in uses the device-code flow unless other options (e.g. --with-api-key) are given.
      exec codex login "${@:---device-auth}"
    fi
    # `login claude …`, or plain `login …` as before Codex was added.
    [ "${1:-}" = claude ] && shift
    exec claude auth login "$@"
    ;;
  ?*) exec "$@" ;;
esac

# Settings show which Assistant is ready; this only warns when neither one can run a session.
if ! claude auth status --text >/dev/null 2>&1 && ! codex login status >/dev/null 2>&1; then
  echo '[grillingstone] Not signed in to Claude or Codex. Sessions will fail until you sign in to one of them:'
  echo '[grillingstone]   docker compose -f docker/compose.yml run --rm grillingstone login claude'
  echo '[grillingstone]   docker compose -f docker/compose.yml run --rm grillingstone login codex'
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
