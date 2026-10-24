// Turning a Template Session's validated submission into a Template the store can save.
import type { Tracker } from '#core/shared/tracker.ts'
import type { SectionTarget } from '#core/shared/trackerFields.ts'
import type { WorkItemType } from '#core/shared/workItemType.ts'
import type { Template, TemplateSection } from '#core/template/templateTypes.ts'
import type { TemplateContent } from '#core/template/templateValidator.ts'

/**
 * The Template a Template Session submitted (already validated), with only the fields a Template has and
 * text trimmed. The store assigns its id, a unique name and version 1.
 */
export function templateFromSession(
  content: TemplateContent,
  { tracker, workItemType }: { tracker: Tracker; workItemType: WorkItemType },
  now: string,
): Template {
  const sections: TemplateSection[] = content.sections.map((section) => ({
    key: section.key,
    heading: section.heading.trim(),
    shape: section.shape,
    locked: section.locked,
    guidance: typeof section.guidance === 'string' ? section.guidance.trim() : '',
    target: section.target,
    ...(section.entryFormat === 'gherkin' ? { entryFormat: 'gherkin' as const } : {}),
  }))
  return {
    id: '',
    tracker,
    workItemType,
    name: content.name.trim(),
    version: 1,
    isDefault: false,
    sections,
    method: content.method.trim(),
    iterationLogHeading: content.iterationLogHeading?.trim() || `${workItemType} Iteration Log`,
    // Already checked against the type's fields by the validator.
    ...(content.iterationLogTarget ? { iterationLogTarget: content.iterationLogTarget as SectionTarget } : {}),
    updatedAt: now,
  }
}
