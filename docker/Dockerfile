# Whetstone in one container: the Node backend, the Vite frontend and Claude Code, so the host needs only Docker.
# Built from the repository root (see compose.yml); Dockerfile.dockerignore keeps data, git and local tooling out.
FROM node:24-bookworm-slim

# Claude Code, pinned: the backend relies on its stream-json and --tools/--settings flags (server/sessions/claudeProcess.ts).
ARG CLAUDE_CODE_VERSION=2.1.295
RUN npm install -g --allow-scripts=@anthropic-ai/claude-code @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} \
  && npm cache clean --force

WORKDIR /app
COPY package.json package-lock.json ./
# Dev dependencies included: the app is served by the Vite dev server.
RUN npm ci && npm cache clean --force

COPY . .
COPY docker/entrypoint.sh /usr/local/bin/whetstone-entrypoint
# The Claude home and data/ are mount points; creating them here gives the volumes the node user as owner.
RUN chmod +x /usr/local/bin/whetstone-entrypoint \
  && mkdir -p /home/node/.claude /app/data \
  && chown -R node:node /app /home/node/.claude

USER node
# Claude Code's login, settings and conversation copies (what Continue resumes) all live in this volume.
ENV CLAUDE_CONFIG_DIR=/home/node/.claude
EXPOSE 5310
ENTRYPOINT ["whetstone-entrypoint"]
