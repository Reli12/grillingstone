// Where the backend finds and keeps things, and which ports and binaries it uses — read once from the
// environment (GRILLINGSTONE_*) at startup.
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const TOOL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/**
 * Everything the tool produces (Projects, Drafts, Glossaries, Transcripts, Templates, Template Sessions,
 * settings) lives in one git-ignored folder inside the project. GRILLINGSTONE_DATA_DIR may pick another folder,
 * but only one named data* directly inside the project (e.g. "data-test" for throwaway runs).
 */
function dataDir(): string {
  const requested = process.env.GRILLINGSTONE_DATA_DIR
  if (!requested) return path.join(TOOL_DIR, 'data')
  const dir = path.resolve(TOOL_DIR, requested)
  if (path.dirname(dir) !== TOOL_DIR || !path.basename(dir).startsWith('data'))
    throw new Error(`GRILLINGSTONE_DATA_DIR must be a folder named data… directly inside ${TOOL_DIR}; got ${dir}`)
  return dir
}

export const DATA_DIR = dataDir()
export const DEFAULT_TEMPLATES_DIR = path.join(TOOL_DIR, 'defaults', 'templates')
export const SUBMIT_SCRIPT = path.join(TOOL_DIR, 'scripts', 'writeDraft.mjs')
export const HOOK_SCRIPT = path.join(TOOL_DIR, 'scripts', 'permissionHook.mjs')

const DEFAULT_SERVER_PORT = 5311
const DEFAULT_WEB_PORT = 5310

export const SERVER_PORT = Number(process.env.GRILLINGSTONE_SERVER_PORT ?? DEFAULT_SERVER_PORT)
export const WEB_PORT = Number(process.env.GRILLINGSTONE_WEB_PORT ?? DEFAULT_WEB_PORT)
export const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`
/** Browser origins allowed to call the API (the Vite dev server). */
export const ALLOWED_ORIGINS = new Set([`http://127.0.0.1:${WEB_PORT}`, `http://localhost:${WEB_PORT}`])

export const CLAUDE_BIN = process.env.GRILLINGSTONE_CLAUDE_BIN ?? 'claude'
export const DEFAULT_AUTHOR = os.userInfo().username
