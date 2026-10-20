# Grilling Stone in one container: the Node backend, the Vite frontend, Claude Code and Codex, so the host needs only
# Docker.
# Built from the repository root (see compose.yml); Dockerfile.dockerignore keeps data, git and local tooling out.
FROM node:24-bookworm-slim

# For Codex, a native binary: CA certificates (the slim image has none, so it could neither sign in nor reach OpenAI;
# Node, and so Claude Code, brings its own) and bubblewrap, the Linux sandbox Codex runs every command in.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates bubblewrap \
  && rm -rf /var/lib/apt/lists/*

# Claude Code, pinned: the backend relies on its stream-json and --tools/--settings flags (server/sessions/claudeProcess.ts).
ARG CLAUDE_CODE_VERSION=2.1.295
RUN npm install -g --allow-scripts=@anthropic-ai/claude-code @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
  && npm cache clean --force

# Codex, pinned: the backend speaks its experimental app-server protocol (server/sessions/codexAssistant.ts), checked
# against this version. Regenerate the protocol schema before raising it (ADR-0019).
ARG CODEX_VERSION=0.162.1
RUN npm install -g @openai/codex@${CODEX_VERSION} && npm cache clean --force

WORKDIR /app
COPY package.json package-lock.json ./
# Dev dependencies included: the app is served by the Vite dev server.
RUN npm ci && npm cache clean --force

COPY . .
COPY docker/entrypoint.sh /usr/local/bin/grillingstone-entrypoint
# The Claude and Codex homes and data/ are mount points; creating them here gives the volumes the node user as owner.
RUN chmod +x /usr/local/bin/grillingstone-entrypoint \
  && mkdir -p /home/node/.claude /home/node/.codex /app/data \
  && chown -R node:node /app /home/node/.claude /home/node/.codex

USER node
# Claude Code's login, settings and conversation copies (what Continue resumes) all live in this volume.
ENV CLAUDE_CONFIG_DIR=/home/node/.claude
# Codex's login and its saved threads (what Continue resumes) live in this one.
ENV CODEX_HOME=/home/node/.codex
EXPOSE 5310
ENTRYPOINT ["grillingstone-entrypoint"]
