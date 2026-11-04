# PRD — Code Folders

## Problem Statement

When I grill a requirement into a PBI, Claude knows the requirement, the Glossary, my References and (once Backlog Copies exist) the BA's Feature, but nothing about the code the PBI will change. So it asks questions the code could answer ("Is there already a device list?"), it can't name the components and endpoints a developer-authored PBI should name, and it can't spot where the Feature contradicts how the app works today. I end up answering from memory or pasting code into the chat.

At the same time, the code I work on is client code that sits next to secrets: `.env` files, certificates, registry tokens, environment-specific settings. Any way of giving sessions the code must never let them read those, and must never let a session change the code.

## Solution

A Project can link **Code Folders**: folders of source code on my own machine, each with a short label ("app", "ui-lib") and a default branch. A Grilling Session in that Project may read, search and list them (never change them) when I allow it on starting the session. It's allowed by default when the Project has Code Folders.

- **Excluded Files** are never read, searched or listed:
  - a fixed set of secret-holding file kinds that I can't lift;
  - everything the folder's own ignore rules keep out of version control;
  - any extra patterns I add for that Code Folder.
- What Claude finds in code counts as **how things work today, never what should happen**. Every claim taken from code is cited by Code Folder label and path. Where code and the requirement disagree, Claude asks me, and what stays unresolved becomes an Open Question.
- Every session is told which branch and commit each Code Folder is on and whether it has uncommitted changes. It treats code that is off the default branch, or uncommitted, as possibly not yet true. Wherever I start a Grilling Session, I'm warned about this before I start.
- The tool refuses folders that are obviously wrong to link: a drive root, a system folder, my home folder or anything containing it, and anything overlapping the tool's own data. It warns about doubtful ones: no ignore rules, not in git, very large.
- Only Grilling Sessions read Code Folders. Prototype, Import and Template Sessions never do.
- Web search and fetch stay available in sessions that read code. This is a deliberate trade-off, recorded under Further Notes.

## User Stories

### Linking Code Folders

1. As a developer, I want to link a local folder of source code to my Project, so that Grilling Sessions can read the code my work items will change.
2. As a developer, I want to link several Code Folders to one Project, so that a PBI touching both the app and a shared UI library is grilled against both.
3. As a developer, I want to give each Code Folder a short label that is unique in the Project, so that Claude can cite code unambiguously ("app: src/devices/DeviceList.tsx").
4. As a developer, I want to pick the folder with a folder picker or by pasting a path, so that linking takes seconds.
5. As a developer, I want to name the Code Folder's default branch when linking it, prefilled from the folder's git setup when it has one, so that the tool knows what "not on the default branch" means.
6. As a developer, I want to link the same folder to several Projects, so that two Projects working on one codebase both benefit.
7. As a developer, I want to link a subfolder of a monorepo instead of the whole repo, so that sessions only see the part that matters.
8. As a developer, I want linking refused for a drive root, a system folder, my home folder or anything containing it, so that I can't expose my whole machine by mistake.
9. As a developer, I want linking refused for a folder that contains or sits inside the tool's own data, so that sessions never see other Projects' Drafts or transcripts.
10. As a developer, I want a warning when the folder has no ignore rules, so that I know only the fixed exclusions protect it.
11. As a developer, I want a warning when the folder is not inside a git checkout, so that I know branch information and ignore rules won't be available.
12. As a developer, I want a warning when the folder holds an unusually large number of files, so that I notice I may have linked too much.
13. As a developer, I want to link a folder despite a warning, so that the tool advises me but doesn't block a deliberate choice.
14. As a developer, I want to see each Code Folder's label, path, default branch and current branch in the Project, so that I know what sessions will read.
15. As a developer, I want to edit a Code Folder's label, default branch and extra exclusions, so that I can correct them without unlinking.
16. As a developer, I want to unlink a Code Folder, so that later sessions no longer read it. Unlinking never touches the folder itself.
17. As a developer, I want a Code Folder whose path no longer exists to be shown as missing and skipped by sessions, so that a moved repo doesn't break grilling.
18. As a developer working in a Jira Project, I want Code Folders too, so that code context doesn't depend on the Tracker.

### Excluded Files

19. As a developer, I want `.env` files and their variants never read, so that my environment secrets never reach a session.
20. As a developer, I want committed examples such as `.env.example` and `.env.sample` to stay readable, so that Claude can learn which settings exist without seeing their values.
21. As a developer, I want key and certificate files, package-registry credentials, environment-specific settings files and anything named as a secret or credentials always excluded, so that the common secret locations are covered without my listing them.
22. As a developer, I want version-control internals always excluded, so that history, remotes and stored credentials stay out of reach.
23. As a developer, I want everything my ignore rules keep out of version control excluded, so that local secrets nobody thought to name, and also dependencies and build output, stay out.
24. As a developer, I want to add my own exclusion patterns per Code Folder, so that I can protect client-specific material such as exported customer data.
25. As a developer, I want the fixed exclusions impossible to lift, so that no misconfiguration re-exposes secrets.
26. As a developer, I want an Excluded File to be invisible to reading, searching and listing alike, so that a search for "password" can't print a secret file's contents.
27. As a developer, I want to see which files of a Code Folder are excluded (a preview count and examples), so that I can check the exclusions do what I expect.
28. As a developer, I want a session that tries to read an Excluded File to be told it is excluded, without its content, so that Claude stops trying and I can see it happened in the Transcript.

### Sessions reading code

29. As a developer, I want a "Read Code Folders" choice wherever I start a Grilling Session (the New Draft form, the message box when no session runs, and the Focused/Upgrade dialog), on by default when the Project has Code Folders, so that I decide per session whether code is in play.
30. As a developer running a Focused Session on wording, I want to untick "Read Code Folders", so that Claude doesn't wander into the code or cite implementation in a business-level Section.
31. As a developer, I want the session's opening context to list the Code Folders it may read, with label, branch, commit and uncommitted state, so that Claude knows what it is reading and how far to trust it.
32. As a developer, I want Claude to treat code that is off the default branch or uncommitted as possibly not yet true, so that a spike branch isn't written into a PBI as current behaviour.
33. As a developer, I want a warning wherever I start a session when a Code Folder is off its default branch or has uncommitted changes, so that I can switch branch before starting.
34. As a developer, I want that warning never to block starting, so that I can grill against a spike branch on purpose.
35. As a developer, I want the branch, commit and uncommitted state of each Code Folder recorded in the session's Transcript, so that I can later tell what a citation was based on.
36. As a developer, I want Claude to treat code as how things work today and never as what should happen, so that the requirement and the Backlog Copies stay the source of intent.
37. As a developer, I want every claim taken from code cited by label and path, so that I can check it.
38. As a developer, I want Claude to ask me when code and requirement disagree, so that contradictions surface during grilling and not during implementation.
39. As a developer, I want an unresolved disagreement between code and requirement written as an Open Question, so that it isn't lost.
40. As a developer, I want Claude to use code to ask sharper questions ("I see no archived status on devices; is this new?"), so that grilling gets to the real decisions faster.
41. As a developer, I want sessions never able to change any file in a Code Folder, so that grilling can't damage my working copy.
42. As a developer, I want Continuations to follow the same rules, re-reading the current branch state and my choice for this session, so that a picked-up session isn't working from stale assumptions.
43. As a developer, I want Prototype, Import and Template Sessions never to read Code Folders, so that each session kind keeps its existing, documented inputs.

## Implementation Decisions

### Glossary

- The terms are in the Project's `CONTEXT.md`: **Code Folder** and **Excluded File** (new), plus relationship lines on who may read Code Folders and what code may tell a Draft. A Code Folder is never called the Project's repo, codebase or workspace, and it is not a **Reference**.

### Key architectural decision: Code Folders are reached through the tool's own read-only code tools, not through Claude's built-in file tools

The Permission Guard decides on a tool's _input_ before it runs (a PreToolUse hook) and cannot filter its _output_. For Read it can check the path, but for Grep and Glob it can only check where they search. A Grep whose path is a Code Folder would print matching lines from `.env`, because the search engine doesn't know about Excluded Files. So:

- Claude's built-in Read, Grep and Glob stay limited to the Project folder, exactly as today. The guard keeps refusing any path outside it, Code Folders included.
- Code Folders are reached only through three tools the tool itself provides to a session, as a local MCP server started per session (sessions already run with a strict MCP configuration, so no other server is reachable):
  - _list code files_ (Code Folder label, optional subfolder or glob)
  - _search code_ (label, pattern, optional glob, result limit)
  - _read code file_ (label, path, optional line range)

  Each tool resolves paths inside the named Code Folder, refuses anything that escapes it (`..`, absolute paths, symlinks pointing outside) and applies Excluded Files **before** returning anything, so excluded content is never produced, not just never shown.

- The guard allows exactly these three tools, and only when the session was started with "Read Code Folders" ticked. Write tools have no path into a Code Folder at all, so read-only holds by construction.
- This needs the user's confirmation; it was not discussed in the grilling session. The alternative of rewriting Grep and Glob input in the hook to add exclusion globs was rejected. It depends on the hook's input-rewriting behaviour and on the search engine honouring every pattern, which is exactly where a leak would come from.

### Modules

1. **Excluded File policy (core, new, deep).** It answers one question, "may this path inside this Code Folder be read, searched or listed?", given:
   - the fixed exclusions (built in, not configurable);
   - the folder's own ignore rules, supplied as the set of files git reports as not ignored, or none when the folder isn't in git;
   - the Code Folder's extra patterns.

   The fixed exclusions cover:
   - environment files (`.env`, `.env.*`) except `.env.example` and `.env.sample`;
   - keys and certificates (`*.pem`, `*.key`, `*.pfx`, `*.p12`, `*.crt` private-key bundles, `id_rsa*`, `id_ed25519*`);
   - registry and tool credentials (`.npmrc`, `.yarnrc.yml`, `.pypirc`, `.netrc`, `.git-credentials`);
   - environment-specific settings (`appsettings.*.json` but not `appsettings.json`, `secrets.json`, `local.settings.json`);
   - any file or folder named with `secret` or `credential`;
   - version-control internals (`.git`).

   Matching is case-insensitive and applies to any depth. The policy is pure, has a tiny interface and is where every leak would be, so it gets the heaviest tests.

2. **Code Folder linking rules (core, new, deep).** Pure validation of a proposed link given resolved facts about the path (passed in, so the rules are testable without a filesystem):
   - _Rejected:_ the path is missing; it is a drive root; it is a system folder; it is the home folder or one of its ancestors; it overlaps the tool's data folder (containing it or contained by it).
   - _Warned:_ no ignore rules; not inside a git checkout; more files than a threshold (indicatively 50,000, excluding Excluded Files).
   - _Otherwise:_ the label is non-empty, a short slug, and unique in the Project.

   It returns `ok`, `rejected` with reasons, or `ok-with-warnings` with reasons.

3. **Code Folder reader (server, new, deep).** It implements list, search and read over one Code Folder, using the Excluded File policy and the folder's git facts. Every path is resolved and symlink-checked against the Code Folder root, and results are capped (files listed, matches returned, bytes read), with truncation reported. Binary files are skipped. This is the only code in the tool that touches Code Folder contents.

4. **Git facts (server, new).** It reads, for a Code Folder:
   - whether it is inside a git checkout;
   - the current branch (or detached commit) and short commit;
   - whether there are uncommitted changes;
   - the files git considers not ignored (tracked and untracked-but-not-ignored), which honours nested ignore rules exactly as git does;
   - a suggested default branch from the remote's HEAD when available.

   It runs git commands from the server, never from the session. A folder outside git yields "no git" and only the fixed and extra exclusions apply. If git isn't installed, the tool treats every folder as "not in git" and says so in the warning.

5. **Code tools server (server, new).** A local MCP server launched per Grilling Session, given the session's allowed Code Folders. It exposes the three tools by calling the Code Folder reader. It runs as a separate process like the submit script and talks to the main server over the existing session token.

6. **Permission Guard (core, modified).** It allows the three code tools only when the session's context says Code Folders are allowed, and keeps denying every other MCP tool. Read, Grep, Glob and the write rules are unchanged, which keeps the guard's existing tests valid. The guard context gains a "Code Folders allowed" flag.

7. **Project model and storage (core and server, modified).** A Project gains `codeFolders: { label, path, defaultBranch, extraExclusions: string[] }[]`. A Project read without the field has none, so no migration is needed. Paths are stored as the human chose them and resolved at use. This applies to both Trackers.

8. **Code Folder service and routes (server, new).**
   - _Validate a path:_ runs the linking rules and returns rejections or warnings, git facts and a suggested default branch.
   - _Add, edit and remove_ a Code Folder.
   - _Preview exclusions:_ a count of excluded files and a few examples per rule.
   - _Current state for session start:_ branch, commit, uncommitted changes and whether the path is missing, per Code Folder.

9. **Grilling seed and session start (core and server, modified).**
   - Session start arguments gain `readCodeFolders?: boolean`, defaulting to true when the Project has Code Folders.
   - When allowed, the session starts the code tools server and the seed gains a "Code Folders" block. It lists each available folder's label, branch, commit, uncommitted state and whether it is on the default branch.
   - The block gives the rules: code is how things work today, never what should happen; cite every code-derived claim as `label: path`; ask when code and requirement disagree, and write what stays unresolved as an Open Question; treat code off the default branch or uncommitted as possibly not yet true; Excluded Files can't be read, so don't try to work around them.
   - Missing folders are left out and named in the intro line.
   - The branch state per Code Folder is stored on the Transcript.
   - Prototype, Import and Template Sessions never get the block or the code tools.

10. **UI (new and modified).**
    - _Project:_ a **Code Folders** tab on the Project page, at its own URL like Drafts, Backlog Copies and Glossary, for both Trackers (settled by prototype, variant A). It shows a table (label, path, current branch and commit, state) with edit and unlink per row and an expandable exclusion preview per row. Linking happens in an inline panel: folder picker or pasted path, then Check, then rejections shown inline or warnings with "Link anyway", then label, default branch (prefilled) and extra exclusions.
    - _Session start:_ a "Code this session reads" block (settled by prototype, variant C) wherever a Grilling Session starts: the New Draft form, the idle message box (new session or Continuation) and the Focused/Upgrade dialog. It is a table of the Code Folders (label, branch, commit, state) with a Read / Don't read switch, Read by default. Folders off their default branch or with uncommitted changes are marked, and missing ones are marked as skipped. Nothing here ever blocks starting. In the message box it collapses to one line ("Reads app@main, ui-lib@feature/x*") with "change". It is hidden when the Project has no Code Folders.
    - _Transcript:_ the intro line names the Code Folders and their branches.

## Testing Decisions

- **What makes a good test:** test behaviour through public interfaces. Given a path and a folder's facts, is it readable? Given a link request, is it rejected, warned or accepted? Given a search, are excluded files' contents ever in the result? Don't test which internal helper matched a pattern.
- **Excluded File policy:** a table-driven test covering:
  - every fixed rule at several depths and in different letter cases;
  - the `.env.example`, `.env.sample` and `appsettings.json` exceptions;
  - files reported as ignored;
  - extra patterns;
  - proof that extra patterns can't re-include a fixed exclusion.

  Prior art: the Permission Guard tests, which are already table-driven over tool and input cases.

- **Linking rules:** each rejection and each warning, label uniqueness, and Windows and POSIX path forms (drive roots, case-insensitive paths on Windows, trailing separators). Prior art: the Permission Guard tests for path normalisation and symlink resolution.
- **Code Folder reader (integration over a temporary folder):**
  - a search for a secret's value returns nothing from excluded files;
  - listing never shows excluded files;
  - reading an excluded file is refused without content;
  - `..`, absolute paths and an outward symlink are refused;
  - caps and truncation are reported;
  - binary files are skipped.

  Prior art: the storage tests that work on real temporary folders.

- **Git facts:** against a temporary git repository: branch, commit, uncommitted state, the not-ignored file set with nested ignore rules, and a folder outside git.
- **Permission Guard:** the code tools are allowed only with the flag and denied without it; other MCP tools are still denied; existing cases are unchanged.
- **Grilling seed:** the Code Folders block is present only when allowed; it holds branch state and the rules; missing folders are left out; the block is never present for other session kinds. Prior art: the grillingSeed tests.
- **UI components:** linking with rejection and with warning-then-link-anyway, the exclusion preview, and the session-start block (switch and warnings) in all three start places. Prior art: the existing component tests.
- **End to end (one path):** link a temporary repo containing a `.env` and an `.env.example`, start a session with Code Folders allowed, and check that the session can list and read source files and `.env.example` but never `.env`. Prior art: the existing e2e golden-path specs with the stubbed session backend.

## Out of Scope

- Remote code (Azure DevOps Repos, GitHub) and any credentials.
- Writing to Code Folders, running code, running tests or running git commands from a session.
- Prototype, Import and Template Sessions reading code.
- Choosing Code Folders per Draft. The choice is per session (all of the Project's folders, or none).
- Removing web tools from sessions that read code (decided against; see Further Notes).
- Detecting secrets hard-coded inside committed source files. Exclusion works on file paths, not contents.
- Indexing, embeddings or semantic code search.
- Switching branches for the human.

## Further Notes

- **Deliberate trade-off: web tools stay on.** Sessions that read Code Folders keep WebSearch and WebFetch. Code a session has read can therefore leave the machine through a search query or a fetched URL. That can happen by mistake, or because a planted instruction in a code comment or a dependency's README (prompt injection) tells Claude to send it somewhere. This was chosen so that one session can both read the code and check library documentation. If a client's rules require code to stay on the machine, the fallback is a per-Project or per-session "no web while reading code" switch, which the guard can enforce in one rule.
- **Code always reaches Anthropic.** Whatever a session reads is sent to the Claude API as part of the conversation, exactly as when running Claude Code in that repo directly. Excluded Files are the only control over what is sent.
- **ADR candidates:**
  1. Code Folders are reached only through the tool's own read-only code tools, with exclusions applied before output, not through the built-in file tools plus path checks.
  2. The layered Excluded File policy (a fixed floor that can't be lifted, then ignore rules, then human patterns).
  3. Keeping web tools in code-reading sessions.

  All three are hard to reverse or surprising without context, and each came from a real trade-off. Write them in `plan/adr/` before implementation.

- **Relation to Backlog Copies:** the two are independent and complement each other. A Backlog Copy says what the BA wants, and a Code Folder says how the app works today. A session that has both should cite the Feature for intent and the code for current behaviour, which is the "code is never what should happen" rule.
- Origin: a grill-with-docs session on 2026-11-04. The decisions match the updated `CONTEXT.md`.
