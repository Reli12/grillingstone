# Grilling Stone

A local tool where you and Claude grill a requirement into a single, well-written Azure DevOps work item.

You describe a requirement, or a bug you saw. Claude interrogates it one question at a time until it is clear, then
writes it as an **Epic, Feature, PBI, Task or Bug** in your Template. You edit the result like a document, ask Claude to
rework any part, and copy it into Azure DevOps. Claude writes the copy; you stay the editor.

> **Why "Grilling Stone"?** A grilling stone holds the heat, and whatever you put on it gets turned until it's done all
> the way through. Here your requirement goes on the stone and Claude's questions are the heat: every vague word gets
> turned over until nothing raw is left.

## Website

[grillingstone.com](https://grillingstone.com) is the project's landing page: a one-page overview of what Grilling
Stone does, how it works, what it needs and how to install it. It is built in a separate repository. This README stays
the source of truth for setup and configuration details.

## How it works

1. **Create a Project** for the product you work on. Each Project keeps its own **Glossary**, which can start empty,
   from text you paste, or as a copy of another Project's. Terms settled in one Draft are known in the next.
2. **Start a Draft.** Describe the requirement, pick its Work Item Type and Template, and start grilling.
3. **Answer Claude's questions.** Each comes as a card with a recommended answer. Claude never writes until you confirm,
   either at its Ready Check or with **Enough — write it**.
4. **Edit v1 like a document.** Reorder, edit or discard Sections and Entries. Locked Sections (e.g. a PBI's User Story
   and Acceptance Criteria) can be edited and moved, but never discarded.
5. **Refine with Claude.** Press **Grill this** on any Section for a Focused Session. Later sessions never overwrite
   your work; they return a **Proposal**. Changes to text only Claude wrote can be accepted in bulk; changes touching
   your edits arrive as **Conflicts** you decide one at a time.
6. **Copy for Azure DevOps.** Each field is rendered and copied as formatted text, ready to paste.

**Templates** define a Draft's Sections and the writing method Claude follows. Default Templates ship for every Work
Item Type; you can edit copies, build your own, or let Claude grill you about how your team writes a work item in a
**Template Session**. Templates can be exported and imported to share with your team.

The domain language (Draft, Section, Proposal, Conflict, Iteration…) is defined in [CONTEXT.md](CONTEXT.md).

## How Claude runs

Grilling Stone doesn't call an API. It runs your installed **Claude Code** as a headless child process, one per session,
started and supervised by the local backend:

```
browser ──HTTP/websocket──▶ backend ──stdin/stdout (stream-json)──▶ claude -p   (cwd: the Project's folder)
   ▲                           │  ▲                                    │
   └──── live chat updates ────┘  └── scripts/writeDraft.mjs ◀─────────┘  the only way to write a Draft
```

1. **Launch.** Starting a session spawns `claude -p --input-format stream-json --output-format stream-json`. Its
   working directory is the Project's own folder (`data/projects/<id>/`), where the Glossary lives as `CONTEXT.md`.
   The model is the one chosen in Settings (`--model`), or Claude Code's default.
2. **Seed.** An appended system prompt carries the grilling rules, the chosen Template's Sections and its writing
   method. The first message carries the requirement, the current Draft (if any), the Glossary, linked References and
   what you Discarded. No earlier chat is replayed: the Draft is the memory.
3. **Conversation.** Your answers go to Claude's stdin as stream-json messages. Claude's output is parsed line by line
   into the Transcript and pushed to the browser over a websocket. Questions and the Ready Check arrive as fenced JSON
   blocks (`pbi-question`, `pbi-ready`) that the UI renders as cards.
4. **Writing.** Claude may write only after you confirm (the tool sends the message `Write it now.`). It then pipes
   the Draft or Proposal as JSON into `scripts/writeDraft.mjs`, which posts it to the backend with a per-session
   token. The backend validates it against the Template. An invalid submission is refused with named reasons, and
   Claude fixes it and submits again.
5. **Ending.** **Stop** sends `SIGTERM`, then `SIGKILL` after 3 seconds. If the backend goes down mid-session, the
   session is marked interrupted on the next start. **Continue** resumes an ended session with `claude --resume`, so
   Claude remembers the chat, while the current Draft still wins over anything said earlier.

**What a session may do.** Each session gets a fixed tool list (`--tools`), no MCP servers (`--strict-mcp-config`)
and no permission prompts. A `PreToolUse` hook (`scripts/permissionHook.mjs`) checks every tool call and denies by
default. It allows:

- reading, searching and globbing inside the Project's folder (paths are normalised and symlinks resolved);
- editing only the Glossary (`CONTEXT.md`) and markdown decision records under the Project's `plan/`;
- web search and fetch, and the `grill-with-docs` skill;
- exactly one Bash command: the submit script in its fixed heredoc form.

Drafts themselves can only change through the submit script. Only one session runs per Draft at a time.

A **Template Session** runs the same way with a stricter scope. It works in its own empty folder, writes no files,
loads no skills and has no Glossary. It submits a Template instead of a Draft, and isn't kept for continuing.

## Requirements

- **Node.js 23.6 or newer.** The backend runs TypeScript directly through Node's type stripping, with no build step.
- **[Claude Code](https://claude.com/claude-code)**, installed and logged in. Grilling Stone runs it headless
  (`claude -p`) on your own Claude account: a Claude subscription or an Anthropic API key, whichever you signed in
  with. Choose the model in **Settings**; leave it empty for Claude Code's default.

Or neither of them: with Docker you need only Docker and a Claude account (see
[Running with Docker](#running-with-docker)).

## Getting started

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5310>. `npm run dev` starts both processes side by side: the React frontend (Vite, port 5310)
and the Node backend (port 5311), which restarts when `server/` or `core/` changes. Both listen on `127.0.0.1` only.

No separate Claude terminal is needed: the backend starts and stops Claude Code for each session. Just log in to
Claude Code once (run `claude` in any terminal and sign in), and make sure `claude` is on the `PATH` of the shell that
runs `npm run dev`. If it isn't, point `GRILLINGSTONE_CLAUDE_BIN` at the binary.

The **How it works** page inside the app walks through every step.

## Running with Docker

No Node.js or Claude Code on your machine? Run Grilling Stone in Docker instead. You need only
[Docker](https://www.docker.com/products/docker-desktop/) and a Claude account: a subscription (Pro or Max) or an
Anthropic API key. The container holds the backend, the frontend and Claude Code.

From the repository root:

```bash
# 1. Build the image (again after every git pull)
docker compose -f docker/compose.yml build

# 2. Sign in to Claude, once. Open the link it prints, sign in with your Claude account, paste the code back.
#    Using an Anthropic API key instead? Add --console after login and sign in to your Console account.
docker compose -f docker/compose.yml run --rm grillingstone login

# 3. Start Grilling Stone
docker compose -f docker/compose.yml up
```

Open <http://localhost:5310>. Stop it with `Ctrl+C`, or with `docker compose -f docker/compose.yml down` if you started
it with `up -d`.

- **Your data** stays in this repository's `data/` folder, the same one `npm run dev` uses. Don't run both at once.
- **Your Claude login** is kept in the `grillingstone_claude-home` Docker volume, with Claude Code's chat copies, so it
  survives restarts and rebuilds. `down -v` deletes it: you sign in again, and ended sessions can no longer be
  Continued.
- **Sessions can't be Continued across the two setups:** one started under `npm run dev` can't be Continued in Docker,
  nor the other way round.
- **Port 5310 only, and only from your machine.** The backend accepts browser calls only from `localhost:5310`, and the
  port is bound to `127.0.0.1` because Grilling Stone has no login of its own.

Check your login with `docker compose -f docker/compose.yml run --rm grillingstone claude auth status --text`. More
details, including Linux file permissions, are in [docker/README.md](docker/README.md).

## Your data and privacy

- Everything Grilling Stone produces (Projects, Drafts, Glossaries, Transcripts, Templates, settings) lives in the
  git-ignored `data/` folder inside this repository. Nothing is sent anywhere except to Claude, through Claude Code.
- Claude Code also keeps its own copy of each grilling conversation (under `~/.claude/projects/`), which is what lets an
  ended session be continued.
- Claude sees only what a session is seeded with and its own Project's folder (see [How Claude runs](#how-claude-runs)).

## Configuration

Optional environment variables, mainly for running isolated copies (the test suites use them):

| Variable                    | Default  | Purpose                                                                     |
| --------------------------- | -------- | --------------------------------------------------------------------------- |
| `GRILLINGSTONE_WEB_PORT`    | `5310`   | Vite dev server port; the backend only accepts browser calls from this port |
| `GRILLINGSTONE_SERVER_PORT` | `5311`   | Backend port                                                                |
| `GRILLINGSTONE_DATA_DIR`    | `data`   | Data folder; must be named `data…` and sit directly in the repository       |
| `GRILLINGSTONE_CLAUDE_BIN`  | `claude` | The Claude Code binary to run                                               |

## Project structure

| Folder                | What lives there                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `core/`               | Pure domain logic shared by frontend and backend, grouped by concept (draft, proposal, session…) |
| `server/`             | Local Node backend: HTTP routes → services → storage, and the supervisor of Claude sessions      |
| `src/`                | React 19 frontend: React Router, TanStack Query, React Hook Form + Zod, Tailwind v4              |
| `scripts/`            | `dev.mjs`, the submit script sessions write Drafts through, and the permission hook              |
| `defaults/templates/` | The Default Templates for Epic, Feature, PBI, Task and Bug                                       |
| `test/`               | Test support: a fake Claude, MSW mocks, setup                                                    |
| `e2e/`                | Playwright browser smoke tests                                                                   |

## Testing

| Command                 | What it runs                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `npm test`              | Vitest: `core/` unit tests, `server/` end-to-end tests against a fake Claude, `src/` tests in jsdom |
| `npm run test:coverage` | The same, with coverage (80% threshold)                                                             |
| `npm run test:e2e`      | Playwright smoke tests in Chromium: the real backend with fake Claude, plus the Vite dev server     |
| `npm run test:e2e:ui`   | The smoke tests in Playwright's UI mode, for writing and debugging                                  |

Neither suite needs Claude Code or a network: `test/server/fakeClaude.mjs` plays Claude's side of a session. The e2e
suite uses its own ports (5398/5399) and data folder (`data-e2e/`), so it can run beside `npm run dev` and `npm test`.
If Playwright reports a missing browser, run `npx playwright install chromium` once.

Other checks: `npm run typecheck`, `npm run lint`, `npm run format:check`. An optional local SonarQube is wired up in
`compose.sonar.yml` (`npm run sonar:up`, then `npm run sonar`).

## Acknowledgements

The grilling method is built on Matt Pocock's open-source [skills](https://github.com/mattpocock/skills), in
particular `grill-with-docs`, used under the MIT License. Matt Pocock is not involved in this project. The adapted
files and his license notice are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE), with third-party notices in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The license covers
this repository's code only. Claude Code is Anthropic's software: you install it
separately, and your use of it and of Claude is governed by Anthropic's terms. Grilling Stone is an independent
project, not affiliated with or endorsed by Anthropic or Microsoft.
