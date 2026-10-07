// drafts/<id>.md — a readable rendering of the Draft JSON, regenerated on every save (ADR-0004).
import type { Draft, Section } from '#core/draft/draftTypes.ts'
import { iterationLogLine } from '#core/publish/publishRenderer.ts'
import { ADO_FIELD_LABELS } from '#core/shared/adoFields.ts'

const sectionMd = (s: Section) => {
  const entries = s.entries.filter((e) => !e.discarded)
  const body =
    s.shape === 'entries' && entries.length ? entries.map((e) => `**${e.title}**\n\n${e.body}`).join('\n\n') : s.body
  return `## ${s.heading}\n\n${body.trim()}`
}

export function draftMarkdown(draft: Draft): string {
  if (draft.version === 0)
    return `# ${draft.title || 'Untitled Draft'}\n\n_No Draft yet — grilling in progress._\n\n> ${draft.requirement.replace(/\n/g, '\n> ')}\n`
  const visible = draft.sections.filter((s) => !s.discarded)
  const discarded = draft.sections.flatMap((s) =>
    s.discarded
      ? [`- Section: ${s.heading}`]
      : s.entries.filter((e) => e.discarded).map((e) => `- ${s.heading}: ${e.title}`),
  )
  const header = `<!-- Generated from ${draft.id}.json — edit in Whetstone; changes here are overwritten. -->\n# ${draft.title}\n\n_${draft.workItemType} · ${draft.template.name} v${draft.template.version} · Draft v${draft.version}_`
  const byField = [...new Set(visible.map((s) => s.target))]
  const body = byField
    .map(
      (field) =>
        `<!-- Azure DevOps field: ${ADO_FIELD_LABELS[field] ?? field} -->\n\n${visible
          .filter((s) => s.target === field)
          .map(sectionMd)
          .join('\n\n')}`,
    )
    .join('\n\n')
  const log = `## ${draft.template.iterationLogHeading}\n\n${draft.iterationLog.map((l) => `${iterationLogLine(l)} — ${l.note}`).join('\n')}`
  const disc = discarded.length ? `\n\n## Discarded (kept, not published)\n\n${discarded.join('\n')}` : ''
  return `${header}\n\n${body}\n\n${log}${disc}\n`
}
