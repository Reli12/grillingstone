// Small file-system helpers the stores share: atomic writes, JSON reads that treat a missing file as
// "nothing stored", and a per-key lock so concurrent read-modify-writes never interleave.
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

/** Length of the random suffix that keeps concurrent temp files for the same target apart. */
const TMP_SUFFIX_LENGTH = 8

/** Letters, digits, `_` and `-`, starting with a letter or digit, at most 81 characters: no dots, no slashes. */
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/

export const isMissingFile = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT'

/** Write-then-rename, so a crash never leaves a half-written file. */
export async function writeFileAtomic(file: string, content: string | Uint8Array) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${randomUUID().slice(0, TMP_SUFFIX_LENGTH)}.tmp`
  // The encoding applies to text only; bytes are written as they are.
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, file)
}

export const writeJson = (file: string, data: unknown) => writeFileAtomic(file, `${JSON.stringify(data, null, 2)}\n`)

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch (error) {
    if (isMissingFile(error)) return null
    throw error
  }
}

export async function readText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8')
  } catch (error) {
    if (isMissingFile(error)) return null
    throw error
  }
}

export async function listJson<T>(dir: string): Promise<T[]> {
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch (error) {
    if (isMissingFile(error)) return []
    throw error
  }
  const jsonNames = names.filter((name) => name.endsWith('.json'))
  const items = await Promise.all(jsonNames.map((name) => readJson<T>(path.join(dir, name))))
  return items.filter((item): item is Awaited<T> => item !== null)
}

/** Serialises async work per key (e.g. one Draft), so a submit and a UI edit never interleave. */
export class KeyedLock {
  private tails = new Map<string, Promise<unknown>>()
  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    // The caller gets `next` and sees its failure; the tail only orders the next job, so it must never reject.
    const tail = next.catch(() => undefined)
    this.tails.set(key, tail)
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key)
    })
    return next
  }
}

/** A safe single path segment for ids that end up in file names. */
export const isSafeId = (id: string) => SAFE_ID.test(id)
