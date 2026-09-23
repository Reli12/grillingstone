import type { WorkItemType } from '#core/shared/workItemType.ts'
import type { Template, TemplateSection } from '#core/template/templateTypes.ts'
import type { TemplateContent } from '#core/template/templateValidator.ts'

/**
 * The Template a Template Session submitted (already validated), with only the fields a Template has and
 * text trimmed. The store assigns its id, a unique name and version 1.
 */
export function templateFromSession(content: TemplateContent, workItemType: WorkItemType, now: string): Template {
  const sections: TemplateSection[] = content.sections.map((s) => ({
    key: s.key,
    heading: s.heading.trim(),
    shape: s.shape,
    locked: s.locked,
    guidance: typeof s.guidance === 'string' ? s.guidance.trim() : '',
    target: s.target,
    ...(s.entryFormat === 'gherkin' ? { entryFormat: 'gherkin' as const } : {}),
  }))
  return {
    id: '',
    workItemType,
    name: content.name.trim(),
    version: 1,
    isDefault: false,
    sections,
    method: content.method.trim(),
    iterationLogHeading: content.iterationLogHeading?.trim() || `${workItemType} Iteration Log`,
    updatedAt: now,
  }
}
