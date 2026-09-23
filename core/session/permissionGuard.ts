// Permission Guard (ADR-0006): the decision behind the PreToolUse hook of every headless session.
// Deny by default. Pattern-based permissions alone are bypassable, so paths are normalised and
// symlink-resolved, and the single allowed Bash command is matched exactly.
import path from 'node:path'
import { SUBMIT_HEREDOC } from '#core/session/cardProtocol.ts'

export interface GuardContext {
  /** Absolute, symlink-resolved Project folder. */
  projectDir: string
  /** Absolute path of scripts/writeDraft.mjs. */
  submitScript: string
  /** Resolves symlinks (for paths that do not exist yet: of their longest existing ancestor). */
  realpath: (p: string) => string
  /** A Template Session writes nothing and loads no skills; its folder is its own empty working folder. */
  mode?: 'grilling' | 'template'
}

export type Decision = { allow: true } | { allow: false; reason: string }

export const ALLOWED_SKILLS = ['grill-with-docs']
/** Tools a session is started with (`--tools`); everything else does not even exist for it. */
export const SESSION_TOOLS = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'MultiEdit', 'Bash', 'WebSearch', 'WebFetch', 'TodoWrite', 'Skill']

const ALLOW: Decision = { allow: true }
const deny = (reason: string): Decision => ({ allow: false, reason })

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

function inside(dir: string, p: string) {
  const rel = path.relative(dir, p)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Absolute, normalised and symlink-resolved; relative paths resolve against the Project folder. */
const resolve = (ctx: GuardContext, p: string) => ctx.realpath(path.resolve(ctx.projectDir, p))

function readable(ctx: GuardContext, p: string | undefined, what: string): Decision {
  if (p === undefined) return ALLOW // defaults to the working directory, which is the Project folder
  return inside(ctx.projectDir, resolve(ctx, p)) ? ALLOW : deny(`${what} "${p}" is outside the Project folder; sessions may only read inside ${ctx.projectDir}.`)
}

const climbs = (pattern: string) => path.isAbsolute(pattern) || pattern.split(/[\\/]/).includes('..')

function writable(ctx: GuardContext, p: string | undefined): Decision {
  const why = 'Sessions may edit only the Glossary (CONTEXT.md) and markdown decision records under plan/. Drafts change only through the submit command.'
  if (!p) return deny(`No file_path given. ${why}`)
  const real = resolve(ctx, p)
  if (real === path.join(ctx.projectDir, 'CONTEXT.md')) return ALLOW
  if (inside(path.join(ctx.projectDir, 'plan'), real) && real.endsWith('.md') && real !== path.join(ctx.projectDir, 'plan')) return ALLOW
  return deny(`Writing "${p}" is not allowed. ${why}`)
}

/**
 * The only Bash a session may run: `node "<submitScript>" <<'WHETSTONE_JSON'` followed by the JSON and a final
 * WHETSTONE_JSON line. The quoted delimiter disables every expansion inside the heredoc, and nothing may follow it.
 */
function submitCommand(ctx: GuardContext, command: unknown): Decision {
  const usage = `The only allowed Bash command is:\nnode "${ctx.submitScript}" <<'${SUBMIT_HEREDOC}'\n{ …json… }\n${SUBMIT_HEREDOC}`
  if (typeof command !== 'string') return deny(usage)
  const lines = command.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n')
  const opener = new Set([`node "${ctx.submitScript}" <<'${SUBMIT_HEREDOC}'`, `node ${ctx.submitScript} <<'${SUBMIT_HEREDOC}'`])
  if (!opener.has(lines[0].trim())) return deny(usage)
  const terminators = lines.map((l, i) => (l === SUBMIT_HEREDOC ? i : -1)).filter((i) => i > 0)
  if (terminators.length !== 1 || terminators[0] !== lines.length - 1)
    return deny(`The heredoc must end with a single final "${SUBMIT_HEREDOC}" line and nothing after it. ${usage}`)
  return ALLOW
}

export function decide(tool: string, input: Record<string, unknown>, ctx: GuardContext): Decision {
  switch (tool) {
    case 'Read':
      return str(input.file_path) ? readable(ctx, str(input.file_path), 'File') : deny('Read needs a file_path.')
    case 'Glob': {
      const pattern = str(input.pattern) ?? ''
      if (climbs(pattern)) return deny(`Glob pattern "${pattern}" must be relative and must not contain "..".`)
      return readable(ctx, str(input.path), 'Folder')
    }
    case 'Grep': {
      const glob = str(input.glob) ?? ''
      if (climbs(glob)) return deny(`Grep glob "${glob}" must be relative and must not contain "..".`)
      return readable(ctx, str(input.path), 'Path')
    }
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
      if (ctx.mode === 'template') return deny('A Template Session writes no files — submit the Template with the submit command instead.')
      return writable(ctx, str(input.file_path))
    case 'Bash':
      return submitCommand(ctx, input.command)
    case 'WebSearch':
    case 'WebFetch':
    case 'TodoWrite':
      return ALLOW
    case 'Skill':
      if (ctx.mode === 'template') return deny('No skills are available in a Template Session.')
      return ALLOWED_SKILLS.includes(str(input.skill) ?? '') ? ALLOW : deny(`Only these skills are available: ${ALLOWED_SKILLS.join(', ')}.`)
    default:
      return deny(`${tool} is not available in a Grilling Session.`)
  }
}
