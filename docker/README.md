# Running Grilling Stone with Docker

For running Grilling Stone without Node.js or an Assistant on your machine. The container holds the backend, the
frontend, Claude Code and Codex; you only need [Docker](https://www.docker.com/products/docker-desktop/) and an account
for one Assistant: Claude (a subscription or an Anthropic API key) or Codex (a ChatGPT plan or an OpenAI API key).

## Getting started

Run these from the repository root:

```bash
# 1. Build the image (again after every git pull)
docker compose -f docker/compose.yml build

# 2. Sign in to your Assistant, once (or both, and choose in Settings).
#    Claude: open the link, sign in, paste the code back. Anthropic API key? Add --console after `login claude`.
docker compose -f docker/compose.yml run --rm grillingstone login claude
#    Codex: open the link it prints and enter the one-time code. OpenAI API key? See "Useful commands".
docker compose -f docker/compose.yml run --rm grillingstone login codex

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
| Your Codex login and Codex's saved threads           | The `grillingstone_codex-home` Docker volume          |

Your logins survive restarts and rebuilds. `docker compose -f docker/compose.yml down -v` deletes the volumes: you then
sign in again, and sessions that ended before can no longer be **Continued**. Your Drafts are not affected.

Sessions started under `npm run dev` can't be Continued in Docker, nor the other way round: each keeps its own
conversation copies. Don't run both at once against the same `data/`; they also need the same port, 5310.

## Useful commands

```bash
docker compose -f docker/compose.yml run --rm grillingstone claude auth status --text   # am I signed in?
docker compose -f docker/compose.yml run --rm grillingstone claude auth logout          # sign out
docker compose -f docker/compose.yml run --rm grillingstone codex login status          # signed in to Codex?
printenv OPENAI_API_KEY | docker compose -f docker/compose.yml run --rm -T grillingstone login codex --with-api-key
docker compose -f docker/compose.yml logs -f                                        # follow the logs
```

## How it runs

One container runs what `npm run dev` runs: the Node backend on the container's own `127.0.0.1:5311` and the Vite
frontend on port 5310, which forwards `/api` to the backend. Each Grilling Session starts the Assistant chosen in
Settings inside the same container, guarded the same way as outside Docker (see
[How the Assistant runs](../README.md#how-the-assistant-runs)).

- **Port 5310 on both sides.** The backend accepts browser calls only from `localhost:5310`, so the published port
  can't be changed in `compose.yml` alone.
- **Reachable only from your machine.** The port is bound to `127.0.0.1`. Grilling Stone has no login of its own; don't
  publish it on `0.0.0.0`.
- **Both Assistants are pinned** (`CLAUDE_CODE_VERSION` and `CODEX_VERSION` in the `Dockerfile`), because the backend
  depends on Claude Code's command-line flags and on Codex's experimental app-server protocol. Raise them
  deliberately: regenerate Codex's protocol schema first, and run one session on each to check.
- **Codex's sandbox.** Codex runs every command inside a Linux sandbox (bubblewrap), which needs user namespaces.
  Docker's default seccomp profile forbids them, so `compose.yml` uses `seccomp-codex.json`: Docker's default profile
  with only `unshare`, `clone`, `clone3`, `setns`, `mount`, `umount2` and `pivot_root` allowed besides. The container
  also runs with `no-new-privileges` and no Linux capabilities. If the sandbox still can't start (Ubuntu 23.10 and
  later restrict user namespaces through AppArmor), Codex refuses every command rather than running it unguarded; allow
  unprivileged user namespaces on the host, or use Claude.
- **Sign-in for Codex** uses the device-code flow: its usual browser sign-in waits on the container's own `localhost`,
  which your browser can't reach.
- **Clean Assistants.** The container has its own Claude and Codex homes, so your personal `~/.claude` and `~/.codex`
  settings, skills and hooks don't reach Grilling Stone's sessions. The repository's `.claude/` and `plan/` folders are left out of the image
  for the same reason.
- **Linux:** the container runs as uid 1000. If your user has another uid, `data/` may not be writable; add
  `user: "<uid>:<gid>"` to the service.
