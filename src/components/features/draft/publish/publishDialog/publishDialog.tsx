// Publish: exactly what will be written to Azure DevOps — type, Backlog, Parent, area, tags and every field, or for an
// update only what changes (before → after) and which Azure DevOps changes it overwrites. Nothing is written until
// the human confirms; what was shown is what is sent. The parent can be typed here (ID or link), so it need not be
// imported as a Backlog Copy first. A Draft not linked yet can update an existing item instead of creating one, which
// links the Draft to it.
import { useState } from 'react'

import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import type { CreatePlan, PlannedField, UpdatePlan } from '#core/publish/publishPlan.ts'
import { htmlToMarkdown } from '#core/shared/htmlMarkdown.ts'

import type { PlanResult, PublishChoice } from '@/api/adoApi'
import { usePublish, usePublishPlan } from '@/api/hooks/ado/adoHooks'
import { Button } from '@/components/atoms/button/button'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { Thinking } from '@/components/atoms/thinking/thinking'
import { Dialog } from '@/components/composite/dialog/dialog'
import {
  ParentField,
  type PublishTarget,
  TargetField,
} from '@/components/features/draft/publish/publishChoiceFields/publishChoiceFields'

const RICH_PREVIEW =
  'max-h-60 overflow-y-auto rounded-md border border-line px-4 py-3 font-serif text-[14px] leading-6 [&_h2]:mt-3 [&_h2]:font-sans [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_p]:mt-1.5 [&_table]:mt-1.5 [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:bg-fog [&_th]:px-2 [&_ul]:list-disc'
const BEFORE_PREVIEW =
  'max-h-40 overflow-y-auto rounded-md border border-line bg-fog px-4 py-3 text-[13px] leading-5 whitespace-pre-wrap text-ink-soft line-through decoration-redpencil/40'

/** What the tool writes: its own rendering (escaped text), or plain text for the title. */
function Written({ field }: Readonly<{ field: PlannedField }>) {
  if (field.field === 'System.Title')
    return <p className="rounded-md border border-line px-3 py-2 font-serif">{field.value}</p>
  // Rendered by the tool from escaped text (core/publish/publishRenderer.ts).
  return <div className={RICH_PREVIEW} dangerouslySetInnerHTML={{ __html: field.value }} />
}

/** What Azure DevOps holds now: shown as text, never as its HTML. */
function Before({ field }: Readonly<{ field: PlannedField }>) {
  const text = field.field === 'System.Title' ? (field.before ?? '') : htmlToMarkdown(field.before)
  return <pre className={BEFORE_PREVIEW}>{text || '(empty)'}</pre>
}

function Facts({ rows }: Readonly<{ rows: [string, string][] }>) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-faint">{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function TagsField({ tags, onChange }: Readonly<{ tags: string[]; onChange: (tags: string[]) => void }>) {
  const [text, setText] = useState(tags.join('; '))
  return (
    <label className="block">
      <span className="text-sm font-semibold">Tags</span>
      <span className="block text-[13px] text-ink-faint">
        For this item only, prefilled from the Project’s Default Tags. Separate them with “;”.
      </span>
      <TextInput
        className="mt-1.5"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          onChange(
            event.target.value
              .split(';')
              .map((tag) => tag.trim())
              .filter(Boolean),
          )
        }}
      />
    </label>
  )
}

function CreateView({
  plan,
  tags,
  onTags,
}: Readonly<{ plan: CreatePlan; tags: string[]; onTags: (t: string[]) => void }>) {
  return (
    <div className="space-y-5">
      <Facts
        rows={[
          ['Creates', `a ${plan.adoType} in ${plan.backlog}`],
          ['Parent', plan.addParent ? `#${plan.addParent}` : 'none'],
          ['Area', plan.areaPath],
          ['Iteration', `${plan.iterationPath} (no sprint)`],
          ['State', 'New, unassigned'],
        ]}
      />
      <TagsField tags={tags} onChange={onTags} />
      {plan.fields.map((field) => (
        <section key={field.field}>
          <h3 className="mb-1.5 font-semibold">{field.label}</h3>
          <Written field={field} />
        </section>
      ))}
    </div>
  )
}

function parentRow({ addParent, parentId }: UpdatePlan): string {
  if (addParent) return `adds #${addParent}`
  return parentId ? `#${parentId} (kept)` : 'none'
}

function UpdateView({ plan }: Readonly<{ plan: UpdatePlan }>) {
  return (
    <div className="space-y-5">
      <Facts
        rows={[
          ['Updates', `${plan.adoType} #${plan.workItemId}`],
          ['Parent', parentRow(plan)],
          ['Tags, area, iteration, state, assignee', 'unchanged'],
        ]}
      />
      {plan.overwrites.length > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-redpencil-wash px-3 py-2 text-sm text-redpencil"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Someone changed {plan.overwrites.join(', ')} in Azure DevOps since your last Publish, and you kept your
          version. Publishing writes over their change.
        </p>
      )}
      {plan.fields.length === 0 && !plan.addParent && (
        <p className="text-sm text-ink-soft">Nothing changed since the last Publish. Publishing changes nothing.</p>
      )}
      {plan.fields.map((field) => (
        <section key={field.field}>
          <h3 className="mb-1.5 font-semibold">{field.label}</h3>
          <Before field={field} />
          <p className="my-1 text-center text-ink-faint">↓</p>
          <Written field={field} />
        </section>
      ))}
    </div>
  )
}

function PlanView({
  data,
  tags,
  onTags,
}: Readonly<{ data: PlanResult; tags: string[]; onTags: (t: string[]) => void }>) {
  const { plan, drift } = data
  if (!plan.ok)
    return (
      <div className="space-y-3">
        {drift?.changes.length ? (
          <p className="text-sm text-ink-soft">
            Azure DevOps changed this work item since your last Publish ({drift.fields.join(', ')}). Those changes are
            now a Proposal on the Draft.
          </p>
        ) : null}
        <p className="font-medium">Publish is not possible yet:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {plan.reasons.map((reason) => (
            <li key={reason.code}>{reason.message}</li>
          ))}
        </ul>
      </div>
    )
  return plan.mode === 'create' ? <CreateView plan={plan} tags={tags} onTags={onTags} /> : <UpdateView plan={plan} />
}

interface PublishDialogProps {
  projectId: string
  draftId: string
  open: boolean
  onClose: () => void
}

interface PublishBodyProps extends Omit<PublishDialogProps, 'open'> {
  data: PlanResult
  tags: string[]
  onTags: (tags: string[]) => void
  /** What was typed in the dialog, sent with the Publish so it is made with the plan shown. */
  choice: PublishChoice
  /** A plan for a new choice is loading: what is shown is not yet what would be sent. */
  stale: boolean
}

function PublishBody({ projectId, draftId, onClose, data, tags, onTags, choice, stale }: Readonly<PublishBodyProps>) {
  const publish = usePublish(projectId, draftId)
  const { plan } = data
  const confirm = () => {
    if (!plan.ok) return
    const expectedRev = plan.mode === 'update' ? plan.expectedRev : null
    publish.mutate(
      { tags, expectedRev, choice },
      {
        onSuccess: (published) => {
          toast.success(`${published.created ? 'Created' : 'Updated'} #${published.workItemId} in Azure DevOps.`, {
            action: { label: 'Open', onClick: () => window.open(published.url, '_blank', 'noopener') },
          })
          onClose()
        },
      },
    )
  }
  return (
    <>
      <PlanView data={data} tags={tags} onTags={onTags} />
      {publish.error && (
        <p role="alert" className="mt-4 text-sm text-redpencil">
          {publish.error.message}
        </p>
      )}
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-line-soft pt-3">
        {plan.ok && plan.mode === 'update' && (
          <a
            href={plan.url}
            target="_blank"
            rel="noreferrer"
            className="mr-auto flex items-center gap-1 text-[13px] text-claude hover:underline"
          >
            <ExternalLink size={13} /> #{plan.workItemId} in Azure DevOps
          </a>
        )}
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="ink" disabled={!plan.ok || stale || publish.isPending} onClick={confirm}>
          {publish.isPending && <Loader2 size={15} className="animate-spin" />}
          {plan.ok && plan.mode === 'update' ? 'Publish update' : 'Publish'}
        </Button>
      </div>
    </>
  )
}

/** "Update an existing work item" chosen, none named yet: nothing to plan, nothing to Publish. */
function AwaitingExisting({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
      <Button variant="quiet" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="ink" disabled>
        Publish update
      </Button>
    </div>
  )
}

/** Holds what was typed and the tags chosen until the dialog closes; tags start from the Project's Default Tags. */
export function PublishDialog({ projectId, draftId, open, onClose }: Readonly<PublishDialogProps>) {
  const [target, setTarget] = useState<PublishTarget>('new')
  const [choice, setChoice] = useState<PublishChoice>({})
  const [tags, setTags] = useState<string[] | null>(null)
  const { data, error, isFetching, isPlaceholderData } = usePublishPlan(projectId, draftId, open, choice)
  const close = () => (setTarget('new'), setChoice({}), setTags(null), onClose())
  // Back to a new item: the existing one named is dropped, the parent typed is kept.
  const chooseTarget = (next: PublishTarget) => (setTarget(next), setChoice({ parent: choice.parent }))
  const loading = !data || (isFetching && !isPlaceholderData)
  const awaiting = target === 'existing' && !choice.existing
  return (
    <Dialog open={open} onClose={close} title="Publish to Azure DevOps" className="w-[min(860px,calc(100vw-32px))]">
      {error && (
        <p role="alert" className="text-sm text-redpencil">
          {error.message}
        </p>
      )}
      {loading ? (
        !error && <Thinking label="Checking Azure DevOps" />
      ) : (
        <div className="space-y-5">
          {data.choosesTarget && (
            <TargetField
              target={target}
              onTarget={chooseTarget}
              existing={choice.existing ?? ''}
              checking={isPlaceholderData}
              onExisting={(existing) => setChoice({ ...choice, existing })}
            />
          )}
          {!awaiting && data.parent && (
            <ParentField
              choice={data.parent}
              applied={choice.parent ?? ''}
              checking={isPlaceholderData}
              onApply={(parent) => setChoice({ ...choice, parent })}
            />
          )}
          {awaiting ? (
            <AwaitingExisting onClose={close} />
          ) : (
            // key: a fresh plan (after a refetch) shows its own fields; the tags chosen are kept.
            <PublishBody
              key={JSON.stringify(data.plan)}
              projectId={projectId}
              draftId={draftId}
              onClose={close}
              data={data}
              tags={tags ?? data.defaultTags}
              onTags={setTags}
              choice={choice}
              stale={isPlaceholderData}
            />
          )}
        </div>
      )}
    </Dialog>
  )
}
