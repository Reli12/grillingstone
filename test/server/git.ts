// Runs git for server tests that build real repositories, with a throwaway identity for commits.
import { execFileSync } from 'node:child_process'

import { GIT_BIN } from '../../server/config.ts'

export const git = (cwd: string, ...args: string[]) =>
  execFileSync(GIT_BIN, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd, encoding: 'utf8' })
