// Templates: read-only Defaults shipped with the tool plus the human's own, stored in data/templates/.
// Editing a Template bumps its version; Drafts keep the snapshot they were written in.
import fs from 'node:fs/promises'
import path from 'node:path'

import { newId } from '#core/shared/ids.ts'
import { WORK_ITEM_TYPES } from '#core/shared/workItemType.ts'
import {
  applyImport,
  type Bundle,
  exportBundle,
  type ImportItem,
  previewImport,
} from '#core/template/templateBundle.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { validateTemplate } from '#core/template/templateValidator.ts'

import { DEFAULT_TEMPLATES_DIR } from '../config.ts'
import { NotFound } from './errors.ts'
import { isSafeId, listJson, writeJson } from './fsUtil.ts'
import { userTemplatesDir as userDir } from './paths.ts'

/** A Template that breaks the rules, or a change a Default does not allow. */
export class TemplateError extends Error {}

/** Work Item Type order first, then Defaults before the human's own, then by name. */
const byTypeThenName = (first: Template, second: Template) =>
  WORK_ITEM_TYPES.indexOf(first.workItemType) - WORK_ITEM_TYPES.indexOf(second.workItemType) ||
  Number(second.isDefault) - Number(first.isDefault) ||
  first.name.localeCompare(second.name)

export async function listTemplates(): Promise<Template[]> {
  const shipped = await listJson<Template>(DEFAULT_TEMPLATES_DIR)
  const defaults = shipped.map((template) => ({ ...template, isDefault: true }))
  const own = await listJson<Template>(userDir)
  const mine = own.map((template) => ({ ...template, isDefault: false }))
  return [...defaults, ...mine].sort(byTypeThenName)
}

export async function getTemplate(id: string): Promise<Template> {
  const template = (await listTemplates()).find((candidate) => candidate.id === id)
  if (!template) throw new NotFound(`No Template ${id}`)
  return template
}

function checkTemplate(template: Template) {
  if (!WORK_ITEM_TYPES.includes(template.workItemType)) throw new TemplateError('Unknown Work Item Type.')
  const result = validateTemplate(template)
  if (!result.ok) throw new TemplateError(result.reasons.map((reason) => reason.message).join(' '))
}

const write = (template: Template) => writeJson(path.join(userDir, `${template.id}.json`), template)

/** `origin` is set only by the server, when a Template Session made the Template. */
export async function createTemplate(
  { origin: _ignored, ...input }: Template,
  now: string,
  origin?: Template['origin'],
): Promise<Template> {
  const all = await listTemplates()
  let name = input.name.trim()
  const nameTaken = (candidate: string) =>
    all.some((template) => template.workItemType === input.workItemType && template.name === candidate)
  while (nameTaken(name)) name = `${name} (copy)`
  const template: Template = {
    ...input,
    id: newId('t'),
    name,
    version: 1,
    isDefault: false,
    updatedAt: now,
    ...(origin ? { origin } : {}),
  }
  checkTemplate(template)
  await write(template)
  return template
}

export async function updateTemplate(
  id: string,
  { origin: _ignored, ...input }: Template,
  now: string,
): Promise<Template> {
  const current = await getTemplate(id)
  if (current.isDefault) throw new TemplateError('Default Templates are read-only — duplicate it to customise.')
  const template: Template = {
    ...input,
    id,
    isDefault: false,
    workItemType: current.workItemType,
    version: current.version + 1,
    updatedAt: now,
    ...(current.origin ? { origin: current.origin } : {}),
  }
  checkTemplate(template)
  await write(template)
  return template
}

export async function deleteTemplate(id: string) {
  const current = await getTemplate(id)
  if (current.isDefault) throw new TemplateError('Default Templates can never be deleted.')
  if (!isSafeId(id)) throw new NotFound(id)
  await fs.rm(path.join(userDir, `${id}.json`))
}

export async function exportTemplates(ids: string[], now: string): Promise<Bundle> {
  const all = await listTemplates()
  return exportBundle(
    all.filter((template) => ids.includes(template.id)),
    now,
  )
}

export async function previewTemplateImport(bundle: unknown) {
  return previewImport(bundle, await listTemplates())
}

/** Re-previews the bundle server-side, so only what the preview allowed can be written. */
export async function importTemplates(bundle: unknown, selected: number[], now: string): Promise<Template[]> {
  const existing = await listTemplates()
  const preview = previewImport(bundle, existing)
  if (!preview.ok) throw new TemplateError(preview.reason)
  const items: ImportItem[] = preview.items.map((item, i) => ({ ...item, selected: selected.includes(i) }))
  const writes = applyImport(existing, items, now)
  for (const template of writes) {
    checkTemplate(template)
    if (!isSafeId(template.id)) throw new TemplateError(`Unsafe Template id ${template.id}`)
    await write(template)
  }
  return writes
}
