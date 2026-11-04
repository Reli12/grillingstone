// Throwaway folders for server tests that link, read or run git in real folders. They live in the git-ignored
// data-test-folders/, not the OS temp folder: macOS keeps that under /private, a system folder no Code Folder may be.
// Git stops looking for a repository there, so a folder a test doesn't `git init` is outside git, not in this repo.
import fs from 'node:fs'
import path from 'node:path'

import { TOOL_DIR } from '../../server/config.ts'

const TEST_FOLDERS = path.join(TOOL_DIR, 'data-test-folders')

/** A new empty folder, named after the prefix; the test removes it. */
export function makeTestFolder(prefix: string): string {
  fs.mkdirSync(TEST_FOLDERS, { recursive: true })
  process.env.GIT_CEILING_DIRECTORIES = TEST_FOLDERS
  return fs.realpathSync(fs.mkdtempSync(path.join(TEST_FOLDERS, `${prefix}-`)))
}
