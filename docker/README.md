# Running Grilling Stone with Docker

For running Grilling Stone without Node.js or Claude Code on your machine. The container holds the backend, the frontend
and Claude Code; you only need [Docker](https://www.docker.com/products/docker-desktop/) and a Claude subscription
(Pro or Max).

## Getting started

Run these from the repository root:

```bash
# 1. Build the image (again after every git pull)
docker compose -f docker/compose.yml build

# 2. Sign in to Claude, once. Open the link it prints, sign in with your Claude account, paste the code back.
docker compose -f docker/compose.yml run --rm grillingstone login

# 3. Start Grilling Stone
docker compose -f docker/compose.yml up
```

Open <http://localhost:5310>. Stop it with `Ctrl+C`, or `docker compose -f docker/compose.yml down` if you started it
with `up -d`.

## What is kept where

| What                                                 | Where                                                 |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Projects, Drafts, Glossaries, Templates and settings | `data/` in this repository, the same as `npm run dev` |
| Your Claude login and Claude Code's chat copies      | The `grillingstone_claude-home` Docker volume         |

Your login survives restarts and rebuilds. `docker compose -f docker/compose.yml down -v` deletes the volume: you then
sign in again, and sessions that ended before can no longer be **Continued**. Your Drafts are not affected.

Sessions started under `npm run dev` can't be Continued in Docker, nor the other way round: each keeps its own Claude
Code chat copies. Don't run both at once against the same `data/`; they also need the same port, 5310.

## Useful commands

```bash
docker compose -f docker/compose.yml run --rm grillingstone claude auth status --text   # am I signed in?
docker compose -f docker/compose.yml run --rm grillingstone claude auth logout          # sign out
docker compose -f docker/compose.yml logs -f                                        # follow the logs
```

## How it runs

One container runs what `npm run dev` runs: the Node backend on the container's own `127.0.0.1:5311` and the Vite
frontend on port 5310, which forwards `/api` to the backend. Each Grilling Session starts `claude -p` inside the same
container, with the same tool allowlist and permission hook as outside Docker (see [How Claude runs](../README.md#how-claude-runs)).

- **Port 5310 on both sides.** The backend accepts browser calls only from `localhost:5310`, so the published port
  can't be changed in `compose.yml` alone.
- **Reachable only from your machine.** The port is bound to `127.0.0.1`. Grilling Stone has no login of its own; don't
  publish it on `0.0.0.0`.
- **Claude Code is pinned** (`CLAUDE_CODE_VERSION` in the `Dockerfile`), because the backend depends on its command-line
  flags. Raise it deliberately and run one session to check.
- **A clean Claude Code.** The container has its own Claude home, so your personal `~/.claude` settings, skills and
  hooks don't reach Grilling Stone's sessions. The repository's `.claude/` and `plan/` folders are left out of the image
  for the same reason.
- **Linux:** the container runs as uid 1000. If your user has another uid, `data/` may not be writable; add
  `user: "<uid>:<gid>"` to the service.
