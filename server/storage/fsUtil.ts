import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

/** Write-then-rename, so a crash never leaves a half-written file. */
export async function writeFileAtomic(file: string, content: string) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${randomUUID().slice(0, 8)}.tmp`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, file)
}

export const writeJson = (file: string, data: unknown) => writeFileAtomic(file, `${JSON.stringify(data, null, 2)}\n`)

export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export async function readText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export async function listJson<T>(dir: string): Promise<T[]> {
  let names: string[]
  try {
    names = await fs.readdir(dir)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
  const items = await Promise.all(names.filter((n) => n.endsWith('.json')).map((n) => readJson<T>(path.join(dir, n))))
  return items.filter((x): x is Awaited<T> => x !== null)
}

/** Serialises async work per key (e.g. one Draft), so a submit and a UI edit never interleave. */
export class KeyedLock {
  private tails = new Map<string, Promise<unknown>>()
  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.tails.get(key) ?? Promise.resolve()
    const next = prev.then(fn, fn)
    const tail = next.catch(() => undefined)
    this.tails.set(key, tail)
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key)
    })
    return next
  }
}

/** A safe single path segment for ids that end up in file names. */
export const isSafeId = (id: string) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(id)
