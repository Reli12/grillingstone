# Grilling Stone

A local tool where you and your AI coding agent, **Claude Code** or **Codex**, grill a requirement into a single,
well-written Azure DevOps work item. Grilling Stone calls whichever one you choose the **Assistant**.

You describe a requirement, or a bug you saw. The Assistant interrogates it one question at a time until it is clear,
then writes it as an **Epic, Feature, PBI, Task or Bug** in your Template. You edit the result like a document, ask the
Assistant to rework any part, and copy it into Azure DevOps. The Assistant writes the copy; you stay the editor.

> **Why "Grilling Stone"?** A grilling stone holds the heat, and whatever you put on it gets turned until it's done all
> the way through. Here your requirement goes on the stone and the Assistant's questions are the heat: every vague word gets
> turned over until nothing raw is left.

## How it works

1. **Choose your Assistant** in Settings: Claude or Codex, whichever you have set up. You can switch at any time.
2. **Create a Project** for the product you work on. Each Project keeps its own **Glossary**, which can start empty,
   from text you paste, or as a copy of another Project's. Terms settled in one Draft are known in the next.
3. **Start a Draft.** Describe the requirement, pick its Work Item Type and Template, and start grilling.
4. **Answer the Assistant's questions.** Each comes as a card with a recommended answer. Nothing is written until you
   confirm,
   either at its Ready Check or with **Enough — write it**.
5. **Edit v1 like a document.** Reorder, edit or discard Sections and Entries. Locked Sections (e.g. a PBI's User Story
   and Acceptance Criteria) can be edited and moved, but never discarded.
6. **Refine with the Assistant.** Press **Grill this** on any Section for a Focused Session. Later sessions never overwrite
   your work; they return a **Proposal**. Changes to text only the Assistant wrote can be accepted in bulk; changes touching
   your edits arrive as **Conflicts** you decide one at a time.
7. **Copy for Azure DevOps.** Each field is rendered and copied as formatted text, ready to paste.

**Templates** define a Draft's Sections and the writing method the Assistant follows. Default Templates ship for every
Work Item Type; you can edit copies, build your own, or let the Assistant grill you about how your team writes a work item in a
**Template Session**. Templates can be exported and imported to share with your team.

The domain language (Draft, Section, Proposal, Conflict, Iteration…) is defined in [CONTEXT.md](CONTEXT.md).

## How the Assistant runs

Grilling Stone doesn't call an AI API. It runs the Assistant chosen in **Settings** as a child process on your machine,
one per session, started and supervised by the local backend. Both Assistants get the same seed, ask through the same
cards and submit through the same validation; they differ in how they are driven and guarded.

### Claude Code

The backend runs your installed **Claude Code** headless:

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

### Codex

The backend runs your installed **Codex** as `codex app-server`, speaking JSON-RPC over its stdin and stdout:

1. **Launch and seed.** Each session starts `codex app-server` with a permission profile passed as `-c` overrides, then
   opens a thread (`thread/start`) with the grilling seed as developer instructions, the model chosen in Settings,
   and one extra tool, `submit_draft`. Each turn is a `turn/start`; its notifications become the Transcript.
2. **Sandbox.** Codex runs every command inside its own OS sandbox, set by the profile: it may read the Project's
   folder and nothing else of yours, and its commands get no network. On macOS it may write only the Glossary
   (`CONTEXT.md`) and the Project's `plan/` folder. Linux's sandbox can't grant writes to a single file, so there it
   may write the Project folder while `project.json`, `drafts/` and `transcripts/` stay read-only and `AGENTS.md`
   stays shut. Either way, Drafts change only through a validated submission. Live web search stays available to
   Codex itself.
3. **Permission Guard.** Every approval Codex asks for is answered by the same Guard that checks Claude: command and
   file-change approvals are declined, and anything it doesn't recognise is declined. Both the sandbox and the Guard
   have to allow an action.
4. **Writing.** Codex submits by calling `submit_draft` with the Draft or Proposal; the backend validates it exactly as
   it validates the submit script, and the reply tells Codex whether it was accepted or what to fix.
5. **Ending and Continue.** **Stop** ends the process as for Claude. **Continue** resumes the thread with
   `thread/resume`; Codex keeps its own copy of the conversation under `~/.codex`.

A session is held by one Assistant: **Continue** works only while that Assistant is the one in Settings. A new session
on any Draft works with either.

### Template Sessions

A **Template Session** runs the same way with a stricter scope. It works in its own empty folder, writes no files,
loads no skills and has no Glossary. It submits a Template instead of a Draft, and isn't kept for continuing.

## Requirements

- **Node.js 23.6 or newer.** The backend runs TypeScript directly through Node's type stripping, with no build step.
- **One Assistant**, installed and signed in. You need only the one you will use:
  - **[Claude Code](https://claude.com/claude-code)**: `npm install -g @anthropic-ai/claude-code`, then
    `claude auth login`, with a Claude subscription or an Anthropic API key.
  - **[Codex](https://developers.openai.com/codex)**: `npm install -g @openai/codex`, then `codex login`, with a
    ChatGPT plan or an OpenAI API key.

Choose the Assistant and its model in **Settings**; leave the model empty for the Assistant's default. Settings show
whether each Assistant is ready, or what is still missing.

Or neither Node.js nor an Assistant: with Docker you need only Docker and a Claude or ChatGPT account (see
[Running with Docker](#running-with-docker)).

**On Windows,** run Grilling Stone in [Docker Desktop](#running-with-docker) or inside WSL2 (Ubuntu), where it behaves
as on Linux. Native Windows isn't tested: Codex is offered only where its sandbox has been checked (macOS and Linux),
so Settings show it as unavailable there.

## Getting started

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5310>. `npm run dev` starts both processes side by side: the React frontend (Vite, port 5310)
and the Node backend (port 5311), which restarts when `server/` or `core/` changes. Both listen on `127.0.0.1` only.

No separate Assistant terminal is needed: the backend starts and stops the Assistant for each session. Just sign in
once (`claude auth login` or `codex login` in any terminal), and make sure `claude` or `codex` is on the `PATH` of the
shell that runs `npm run dev`. If it isn't, point `GRILLINGSTONE_CLAUDE_BIN` or `GRILLINGSTONE_CODEX_BIN` at the
binary.

The **How it works** page inside the app walks through every step.

## Running with Docker

No Node.js or Assistant on your machine? Run Grilling Stone in Docker instead. You need only
[Docker](https://www.docker.com/products/docker-desktop/) and an account for one Assistant: Claude (a subscription or
an Anthropic API key) or Codex (a ChatGPT plan or an OpenAI API key). The container holds the backend, the frontend,
Claude Code and Codex.

From the repository root:

```bash
# 1. Build the image (again after every git pull)
docker compose -f docker/compose.yml build

# 2. Sign in to your Assistant, once. Open the link it prints and sign in.
#    Claude: paste the code back. Using an Anthropic API key instead? Add --console after `login claude`.
docker compose -f docker/compose.yml run --rm grillingstone login claude
#    Codex: enter the one-time code it prints on the page it links to.
docker compose -f docker/compose.yml run --rm grillingstone login codex

# 3. Start Grilling Stone
docker compose -f docker/compose.yml up
```

Open <http://localhost:5310>. Stop it with `Ctrl+C`, or with `docker compose -f docker/compose.yml down` if you started
it with `up -d`.

- **Your data** stays in this repository's `data/` folder, the same one `npm run dev` uses. Don't run both at once.
- **Your logins** are kept in Docker volumes with each Assistant's conversation copies: Claude's in
  `grillingstone_claude-home`, Codex's in `grillingstone_codex-home`. They survive restarts and rebuilds. `down -v`
  deletes them: you sign in again, and ended sessions can no longer be Continued.
- **Codex needs its sandbox,** which the Docker setup allows narrowly. On Ubuntu 23.10 and later hosts it may also need
  user namespaces allowed; see [docker/README.md](docker/README.md#how-it-runs).
- **Sessions can't be Continued across the two setups:** one started under `npm run dev` can't be Continued in Docker,
  nor the other way round.
- **Port 5310 only, and only from your machine.** The backend accepts browser calls only from `localhost:5310`, and the
  port is bound to `127.0.0.1` because Grilling Stone has no login of its own.

Check your logins with `… run --rm grillingstone claude auth status --text` or `… codex login status`, or open
**Settings**, which shows whether each Assistant is ready. More
details, including Linux file permissions, are in [docker/README.md](docker/README.md).

## Your data and privacy

- Everything Grilling Stone produces (Projects, Drafts, Glossaries, Transcripts, Templates, settings) lives in the
  git-ignored `data/` folder inside this repository. Nothing is sent anywhere except through your Assistant: Claude Code
  sends sessions to Anthropic, and Codex to OpenAI, each on your own account.
- The Assistant also keeps its own copy of each grilling conversation (Claude Code under `~/.claude/projects/`, Codex
  under `~/.codex`), which is what lets an ended session be continued.
- The Assistant sees only what a session is seeded with and its own Project's folder (see
  [How the Assistant runs](#how-the-assistant-runs)).
- The terms that apply to your account, and how Grilling Stone meets each maker's rules, are on the app's **Legal**
  page.

## Configuration

Optional environment variables, mainly for running isolated copies (the test suites use them):

| Variable                    | Default  | Purpose                                                                     |
| --------------------------- | -------- | --------------------------------------------------------------------------- |
| `GRILLINGSTONE_WEB_PORT`    | `5310`   | Vite dev server port; the backend only accepts browser calls from this port |
| `GRILLINGSTONE_SERVER_PORT` | `5311`   | Backend port                                                                |
| `GRILLINGSTONE_DATA_DIR`    | `data`   | Data folder; must be named `data…` and sit directly in the repository       |
| `GRILLINGSTONE_CLAUDE_BIN`  | `claude` | The Claude Code binary to run                                               |
| `GRILLINGSTONE_CODEX_BIN`   | `codex`  | The Codex binary to run                                                     |

## Project structure

| Folder                | What lives there                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `core/`               | Pure domain logic shared by frontend and backend, grouped by concept (draft, proposal, session…) |
| `server/`             | Local Node backend: HTTP routes → services → storage, and the supervisor of Assistant sessions   |
| `src/`                | React 19 frontend: React Router, TanStack Query, React Hook Form + Zod, Tailwind v4              |
| `scripts/`            | `dev.mjs`, the submit script sessions write Drafts through, and the permission hook              |
| `defaults/templates/` | The Default Templates for Epic, Feature, PBI, Task and Bug                                       |
| `test/`               | Test support: a fake Claude and a fake Codex, MSW mocks, setup                                   |
| `e2e/`                | Playwright browser smoke tests                                                                   |

## Testing

| Command                 | What it runs                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm test`              | Vitest: `core/` unit tests, `server/` end-to-end tests against both fake Assistants, `src/` tests in jsdom |
| `npm run test:coverage` | The same, with coverage (80% threshold)                                                                    |
| `npm run test:e2e`      | Playwright smoke tests in Chromium: the real backend with the fake Assistants, plus the Vite dev server    |
| `npm run test:e2e:ui`   | The smoke tests in Playwright's UI mode, for writing and debugging                                         |

Neither suite needs an Assistant or a network: `test/server/fakeClaude.mjs` and `test/server/fakeCodex.mjs` play each
Assistant's side of a session. The e2e suite runs every spec on Claude, then the main journey and the Template Session
again on Codex (the `chromium-codex` project). It uses its own ports (5398/5399) and data folder (`data-e2e/`), so it
can run beside `npm run dev` and `npm test`.
If Playwright reports a missing browser, run `npx playwright install chromium` once.

Other checks: `npm run typecheck`, `npm run lint`, `npm run format:check`. An optional local SonarQube is wired up in
`compose.sonar.yml` (`npm run sonar:up`, then `npm run sonar`).

## License

[MIT](LICENSE). The license covers this repository's code only. Claude Code is Anthropic's software and Codex is
OpenAI's: you install them separately, and your use of each is governed by its maker's terms. Grilling Stone is an
independent project, not affiliated with or endorsed by Anthropic, OpenAI or Microsoft.
