// Template Session seed: what a session that writes a new Template starts from. It belongs to no Project
// and sees no Glossary — a Template is reused across Projects and shared with colleagues — so its only
// material is the purpose, the pasted examples and an optional base Template (read-only).
import { cardProtocol, type Seed, submitUsage } from '#core/session/cardProtocol.ts'
import { ADO_FIELD_LABELS, type SectionTarget } from '#core/shared/adoFields.ts'
import { allowedTargets, defaultIterationLogTarget, type WorkItemType } from '#core/shared/workItemType.ts'
import type { Template } from '#core/template/templateTypes.ts'
import { SKELETON_PARTS } from '#core/template/templateValidator.ts'

export interface TemplateSeedInput {
  workItemType: WorkItemType
  /** What the human wants the Template for, in their words. */
  purpose: string
  /** Example work items pasted by the human ('' for none). */
  examples: string
  base?: Template
  submitCommand: string
}

const templateJson = (template: Pick<Template, 'name' | 'sections'>) =>
  JSON.stringify(
    {
      name: template.name,
      sections: template.sections.map(({ key, heading, shape, locked, guidance, target, entryFormat }) => ({
        key,
        heading,
        shape,
        locked,
        guidance,
        target,
        ...(entryFormat ? { entryFormat } : {}),
      })),
    },
    null,
    2,
  )

function roleSection(workItemType: WorkItemType): string {
  return `# Your role
You run a Template Session: you interrogate how the human's team writes a ${workItemType}, until you can write it down as a new Template for Whetstone. A Template is an ordered list of Sections plus a writing method that Claude follows when it later grills requirements or observed defects into ${workItemType} Drafts for Azure DevOps.
This session belongs to no Project: there is no Glossary, and you must keep the Template free of any one product's terms, because it is reused across Projects and shared with colleagues. You cannot read or write files; everything you need is in this conversation. You may search and fetch the web (e.g. to check an Azure DevOps field or a writing convention).
You always create a new Template. A base Template, if given, is starting material only — it is never changed.`
}

function grillSection(workItemType: WorkItemType, fieldChoice: string): string {
  return `## How you grill
- Ask exactly ONE question per message and wait for the answer. Every question carries your recommended answer.
- Walk the decision tree in this order, resolving each before the next:
  1. purpose and audience — what this ${workItemType} is for and who reads it (BA, developer, tester, product owner);
  2. the Section list — which Sections, in which order;
  3. per Section: its shape (prose, or Entries such as one Acceptance Criterion each), whether it is Locked (can never be empty or discarded), its target field in Azure DevOps (${fieldChoice}), and whether its Entries must be Given / When / Then;
  4. per Section: the rules and examples — what good content looks like and the common mistake to avoid;
  5. the guiding principle — the rules that hold across all Sections.
- Stress-test with concrete scenarios from the examples ("In your second example the ACs mix setup and outcome — should the Template forbid that?").
- Propose a short, clear name for the Template near the end (e.g. "Spike PBI").`
}

const CUT_SHORT_RULE =
  "If the human cuts the session short, decide the open points yourself with sensible defaults and say which in the method's Guiding principle."

function writeSection(): string {
  const skeletonHeadings = SKELETON_PARTS.map((part) => `"## ${part}"`).join(', ')
  return `## What you write
The method is markdown and MUST have these headings, in this order: ${skeletonHeadings}.
- ## Purpose — what the work item is for and who reads it.
- ## Guiding principle — the rules that apply throughout.
- ## Sections — one "### <heading>" per Section, in order, with its rules, at least one line starting "Good example:" and, where a common mistake exists, a line starting "Bad example:" that says why it is wrong.
- ## Working process — the numbered steps Claude follows when writing a Draft with this Template.
Model the depth on a strong method: specific, opinionated, with examples a reader can copy.`
}

function submitSection(input: TemplateSeedInput, targets: SectionTarget[]): string {
  const { workItemType } = input
  const targetValues = targets.map((target) => `"${target}"`).join(' | ')
  const defaultLogField = ADO_FIELD_LABELS[defaultIterationLogTarget(workItemType)]
  const example = `{"name": "Spike ${workItemType}", "sections": [{"key": "question", "heading": "Question", "shape": "prose", "locked": true, "guidance": "…", "target": "${targets[0]}"}], "method": "# Spike ${workItemType} Guide\\n\\n## Purpose\\n…"}`
  return `## How you submit
You never write files. When the human has confirmed, submit the whole Template as JSON by running exactly this Bash command (the quoted heredoc delimiter is required):

${submitUsage(input.submitCommand, '{ …the Template JSON… }')}

JSON shape:
${example}

- "sections": [{ "key": camelCase letters/digits, unique; "heading"; "shape": "prose" | "entries"; "locked": true | false; "guidance": one line; "target": ${targetValues}; "entryFormat": "gherkin" (entries Sections only, optional) }]
- "iterationLogTarget": one of those fields — where the Iteration Log is appended (optional; defaults to ${defaultLogField})
- The Work Item Type is fixed to ${workItemType}; do not include it.

The tool validates the submission. It prints ACCEPTED, or REFUSED with the reasons — then fix every reason and submit again. After ACCEPTED, reply with one short sentence telling the human the Template is saved, and stop.`
}

/** The base Template, shown read-only as starting material for the new one. */
function baseMaterial(base: Template): string {
  return `## Starting material: the Template "${base.name}" (v${base.version})
Read it as a starting point for the new Template; keep what fits, change what the human wants different.

Sections:
\`\`\`json
${templateJson(base)}
\`\`\`

Method:
${base.method.trim()}`
}

export function buildTemplateSeed(input: TemplateSeedInput): Seed {
  const { workItemType } = input
  const targets = allowedTargets(workItemType)
  const targetNames = targets.map((target) => ADO_FIELD_LABELS[target])
  const fieldChoice =
    targetNames.length > 1 ? `${targetNames.slice(0, -1).join(', ')} or ${targetNames.at(-1)}` : targetNames[0]
  const systemPrompt = [
    roleSection(workItemType),
    grillSection(workItemType, fieldChoice),
    cardProtocol('the Template', 'the Template'),
    CUT_SHORT_RULE,
    writeSection(),
    submitSection(input, targets),
  ].join('\n\n')

  const base = input.base ? baseMaterial(input.base) : ''
  const examples = input.examples.trim()
    ? `## Example work items the human pasted (learn the house style from them)
"""
${input.examples.trim()}
"""`
    : ''

  const firstMessage = [
    `Create a new ${workItemType} Template. There is no Project and no Glossary in this session.`,
    `## What the human wants it for\n"""\n${input.purpose.trim()}\n"""`,
    base,
    examples,
    '## Your task\nStart with your first question.',
  ]
    .filter(Boolean)
    .join('\n\n')

  return { systemPrompt, firstMessage }
}
