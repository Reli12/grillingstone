// The shape of every request body the API accepts. Rules about meaning (a Template's Sections, a
// Proposal's changes…) stay in core; these only make sure the JSON has the right fields and types.
import { z } from 'zod'

import { THEMES } from '#core/contract/apiTypes.ts'
import type { HumanOp } from '#core/draft/humanOps.ts'
import { ASSISTANT_NAMES } from '#core/session/assistantName.ts'
import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'

const workItemType = z.enum(WORK_ITEM_TYPES, { error: 'Choose Epic, Feature, PBI, Task or Bug.' })
const ids = z.array(z.string()).default([])

export const settingsBody = z.object({
  author: z.string(),
  assistant: z.enum(ASSISTANT_NAMES as ['claude', 'codex'], { error: 'Choose Claude or Codex.' }).default('claude'),
  models: z
    .object({ claude: z.string().default(''), codex: z.string().default('') })
    .default({ claude: '', codex: '' }),
  theme: z.enum(THEMES as ['system', 'light', 'dark']).default('system'),
})

export const projectNameBody = z.object({ name: z.string().trim().min(1, 'A Project needs a name.') })

export const newProjectBody = projectNameBody.extend({ glossary: z.string().optional() })

export const glossaryBody = z.object({ markdown: z.string(), baseVersion: z.string() })

export const newDraftBody = z.object({
  workItemType,
  templateId: z.string(),
  requirement: z.string(),
  references: ids,
})

export const referencesBody = z.object({ references: ids })

const sectionId = z.string()
const entryId = z.string()
export const humanOpBody: z.ZodType<HumanOp> = z.discriminatedUnion('op', [
  z.object({ op: z.literal('retitle'), title: z.string() }),
  z.object({ op: z.literal('editSection'), sectionId, body: z.string() }),
  z.object({
    op: z.literal('editEntry'),
    sectionId,
    entryId,
    title: z.string().optional(),
    body: z.string().optional(),
  }),
  z.object({ op: z.literal('addEntry'), sectionId, title: z.string(), body: z.string() }),
  z.object({ op: z.literal('moveSection'), sectionId, toIndex: z.number().int() }),
  z.object({ op: z.literal('moveEntry'), sectionId, entryId, toIndex: z.number().int() }),
  z.object({ op: z.literal('discardSection'), sectionId }),
  z.object({ op: z.literal('restoreSection'), sectionId }),
  z.object({ op: z.literal('discardEntry'), sectionId, entryId }),
  z.object({ op: z.literal('restoreEntry'), sectionId, entryId }),
])

export const decideBody = z.object({ changeId: z.string(), accept: z.boolean() })

export const startSessionBody = z.object({
  kind: z.enum(['first', 'focused', 'iteration', 'upgrade'], { error: 'Unknown session kind.' }),
  focus: z.object({ sectionId: z.string(), entryId: z.string().optional() }).optional(),
  humanNote: z.string().optional(),
})

export const continueSessionBody = z.object({ humanNote: z.string().optional() })

export const sayBody = z.object({ text: z.string(), kind: z.enum(['answer', 'message']).default('message') })

export const templateSessionBody = z.object({
  workItemType,
  purpose: z.string(),
  examples: z.string().default(''),
  baseTemplateId: z
    .string()
    .optional()
    .transform((id) => id || undefined),
})

/** Only the envelope is checked here; the Template itself is validated by the store (core/template). */
export const templateBody = z
  .object({ template: z.record(z.string(), z.unknown()) })
  .transform(({ template }) => template as unknown as Template)

export const exportBody = z.object({ ids })
export const importPreviewBody = z.object({ bundle: z.unknown() })
export const importBody = z.object({ bundle: z.unknown(), selected: z.array(z.number().int()).default([]) })
