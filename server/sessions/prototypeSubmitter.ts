// The Prototype submit contract (ADR-0023): the payload a Prototype Session submits, validated with Zod; the
// submitter that reads prototype.html from the session folder, runs assembly, and either refuses with reasons or
// hands the finished Prototype to `store`. Storing itself belongs to Prototype storage.
import fs from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { assemblePrototype, type AssemblyImage, type PrototypeAssumption } from '#core/prototype/prototypeAssembly.ts'
import { PROTOTYPE_FILE } from '#core/prototype/prototypeFiles.ts'
import { plural } from '#core/shared/plural.ts'
import type { Reason } from '#core/shared/validation.ts'

import { isMissingFile } from '../storage/fsUtil.ts'
import type { SubmitResult } from './sessionScope.ts'

/** The submit payload names the file (always prototype.html) and lists the assumptions; the HTML is read from disk. */
export const prototypePayload = z.object({
  prototype: z.literal(PROTOTYPE_FILE, { error: `"prototype" must be "${PROTOTYPE_FILE}".` }),
  assumptions: z.array(
    z.object({
      choice: z.string({ error: 'Each assumption needs a "choice" text.' }),
      why: z.string({ error: 'Each assumption needs a "why" text.' }),
    }),
    { error: '"assumptions" must be a list of { "choice", "why" }.' },
  ),
}) satisfies z.ZodType<{ prototype: typeof PROTOTYPE_FILE; assumptions: PrototypeAssumption[] }>

/** A Prototype that passed assembly, ready to be kept. */
export interface StoredPrototype {
  /** Claude's file as submitted. */
  source: string
  /** The self-contained page the tool serves. */
  html: string
  assumptions: PrototypeAssumption[]
  /** Numbers of the session's Images the page shows. */
  usedImages: number[]
}

export interface PrototypeSubmitterDeps {
  /** The session's working folder, where Claude wrote prototype.html. */
  sessionDir: string
  /** The session's Image map: ticked, extra and kept Images by number. */
  images: AssemblyImage[]
  store: (prototype: StoredPrototype) => Promise<void>
}

const invalidPayload = (error: z.ZodError): Reason[] =>
  error.issues.map((issue) => {
    const where = issue.path.length ? ` (${issue.path.join('.')})` : ''
    return { code: 'invalid-payload', message: `${issue.message}${where}` }
  })

const missingPrototype: Reason = {
  code: 'missing-prototype',
  message: `${PROTOTYPE_FILE} is missing or empty: write the whole page to ${PROTOTYPE_FILE} before submitting.`,
}

/** The file Claude wrote, or null when it does not exist or holds nothing. */
async function readSource(sessionDir: string): Promise<string | null> {
  try {
    const source = await fs.readFile(path.join(sessionDir, PROTOTYPE_FILE), 'utf8')
    return source.trim() ? source : null
  } catch (error) {
    if (isMissingFile(error)) return null
    throw error
  }
}

export function prototypeSubmitter({ sessionDir, images, store }: PrototypeSubmitterDeps) {
  return async (payload: unknown): Promise<SubmitResult> => {
    const parsed = prototypePayload.safeParse(payload)
    if (!parsed.success) return { ok: false, reasons: invalidPayload(parsed.error) }
    const source = await readSource(sessionDir)
    if (source === null) return { ok: false, reasons: [missingPrototype] }

    const { assumptions } = parsed.data
    const assembled = assemblePrototype({ source, assumptions, images })
    if (!assembled.ok) return { ok: false, reasons: assembled.reasons }

    await store({ source, html: assembled.html, assumptions, usedImages: assembled.usedImages })
    return { ok: true, message: `Prototype saved (${plural(assumptions.length, 'assumption')}).` }
  }
}
