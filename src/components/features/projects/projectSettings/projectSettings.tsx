// A Project's Settings tab: one home for its configuration, a side menu of sections with each one's state. The
// Tracker (fixed once the Project has Drafts) and, for Azure DevOps Projects, the Backlog and the Default Tags.
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { Lock } from 'lucide-react'

import type { DraftSummary, Project } from '#core/contract/apiTypes.ts'
import { TRACKER_LABELS, TRACKERS } from '#core/shared/tracker.ts'

import { useConnection, useSetBacklog, useSetDefaultTags } from '@/api/hooks/ado/adoHooks'
import { useChangeTracker } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { Tag } from '@/components/atoms/tag/tag'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { LinkedDrafts } from '@/components/features/projects/linkedDrafts/linkedDrafts'
import { RemoveBacklogDialog } from '@/components/features/projects/removeBacklogDialog/removeBacklogDialog'
import { cn } from '@/lib/cn'
import { routesPaths } from '@/routes/routes'

interface SectionProps {
  project: Project
  drafts: DraftSummary[]
}

function TrackerSection({ project, drafts }: Readonly<SectionProps>) {
  const change = useChangeTracker(project.id)
  const fixed = drafts.length > 0
  return (
    <div>
      <div className="flex gap-2" role="radiogroup" aria-label="Tracker">
        {TRACKERS.map((tracker) => (
          <label
            key={tracker}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              tracker === project.tracker ? 'border-claude bg-claude-wash' : 'border-line',
              fixed && 'opacity-60',
            )}
          >
            <input
              type="radio"
              name="tracker"
              checked={tracker === project.tracker}
              disabled={fixed || change.isPending}
              onChange={() => change.mutate(tracker)}
            />
            {TRACKER_LABELS[tracker]}
          </label>
        ))}
      </div>
      {fixed && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-faint">
          <Lock size={13} /> Fixed now that the Project has Drafts. Create a new Project for the other Tracker.
        </p>
      )}
    </div>
  )
}

function ConnectionLine() {
  const { data: connection } = useConnection()
  if (!connection) return null
  if (connection.state === 'none')
    return (
      <p className="text-sm text-ink-faint">
        No Connection to Azure DevOps ·{' '}
        <Link to={routesPaths.settings} className="underline hover:text-ink">
          set it up in Settings
        </Link>{' '}
        first. Until then, copy Drafts out and paste Backlog Copies in by hand.
      </p>
    )
  return (
    <p className="text-sm text-ink-soft">
      <span
        className={cn(
          'mr-1.5 inline-block size-2 rounded-full',
          connection.state === 'connected' ? 'bg-proof' : 'bg-redpencil',
        )}
      />
      {connection.state === 'connected'
        ? `Connected to ${connection.organization ?? connection.orgUrl} as ${connection.user ?? 'unknown user'}`
        : 'Token rejected'}{' '}
      ·{' '}
      <Link to={routesPaths.settings} className="underline hover:text-ink">
        manage in Settings
      </Link>
    </p>
  )
}

function BacklogForm({ project, onDone }: Readonly<{ project: Project; onDone: () => void }>) {
  const save = useSetBacklog(project.id)
  const [input, setInput] = useState(project.backlog ?? '')
  const submit = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    save.mutate(input, { onSuccess: onDone })
  }
  return (
    <form className="mt-3" onSubmit={submit}>
      <label htmlFor="backlog-name" className="text-sm font-semibold">
        Azure DevOps project
      </label>
      <span className="block text-[13px] text-ink-faint">Its name, or paste any link from it.</span>
      <div className="mt-1.5 flex gap-2">
        <TextInput
          id="backlog-name"
          placeholder="Customer Portal"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <Button type="submit" variant="ink" disabled={save.isPending || !input.trim()}>
          {save.isPending ? 'Checking…' : 'Check & save'}
        </Button>
        {project.backlog && (
          <Button variant="quiet" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
      {save.error && (
        <p role="alert" className="mt-1.5 text-[13px] text-redpencil">
          {save.error.message}
        </p>
      )}
    </form>
  )
}

/** The chosen Backlog, with Change and Remove while no Draft is linked to an item in it. */
function ChosenBacklog({
  project,
  locked,
  usable,
  onChange,
}: Readonly<{ project: Project; locked: boolean; usable: boolean; onChange: () => void }>) {
  const [removing, setRemoving] = useState(false)
  const backlog = project.backlog!
  return (
    <div className="mt-3 flex items-center gap-3 rounded-md border border-line-soft bg-claude-wash px-3 py-2.5">
      <span className="flex-1 font-medium">{backlog}</span>
      <Tag tone="proof">Scrum types found</Tag>
      {!locked && (
        <>
          {usable && (
            <Button size="sm" variant="quiet" onClick={onChange}>
              Change
            </Button>
          )}
          <Button size="sm" variant="quiet" onClick={() => setRemoving(true)}>
            Remove
          </Button>
        </>
      )}
      {removing && <RemoveBacklogDialog projectId={project.id} backlog={backlog} onClose={() => setRemoving(false)} />}
    </div>
  )
}

function BacklogSection({ project, drafts }: Readonly<SectionProps>) {
  const { data: connection } = useConnection()
  const [editing, setEditing] = useState(false)
  const linked = project.backlog ? drafts.filter((draft) => draft.linkedWorkItem) : []
  const usable = connection?.state === 'connected'
  return (
    <div>
      <ConnectionLine />
      <p className="mt-3 text-sm text-ink-soft">
        The Azure DevOps project this Project’s Drafts are Published into and Imported from. It must be Scrum or inherit
        from Scrum.{' '}
        {project.backlog ? 'Publish and Import are on.' : 'Publish and Import stay off until you choose one.'}
      </p>
      {project.backlog && !editing ? (
        <ChosenBacklog project={project} locked={linked.length > 0} usable={usable} onChange={() => setEditing(true)} />
      ) : (
        usable && <BacklogForm project={project} onDone={() => setEditing(false)} />
      )}
      {linked.length > 0 && <LinkedDrafts backlog={project.backlog!} drafts={linked} />}
    </div>
  )
}

/** Azure DevOps separates tags with ";"; Enter or a comma adds what was typed. */
const splitTags = (text: string) =>
  text
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)

function TagsSection({ project }: Readonly<SectionProps>) {
  const save = useSetDefaultTags(project.id)
  const [input, setInput] = useState('')
  const tags = project.defaultTags ?? []
  const add = () => {
    const fresh = splitTags(input).filter(
      (tag) => !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase()),
    )
    if (fresh.length) save.mutate([...tags, ...fresh])
    setInput('')
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-[13px] text-ink-faint">No Default Tags.</span>}
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded bg-fog-deep px-2 py-0.5 text-[13px]">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="text-ink-faint hover:text-redpencil"
              onClick={() => save.mutate(tags.filter((other) => other !== tag))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <TextInput
          aria-label="Add a Default Tag"
          placeholder="Add a tag"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add()
            }
          }}
        />
        <Button onClick={add} disabled={!input.trim() || save.isPending}>
          Add
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-ink-faint">
        Offered for each work item Publish creates; you can change them for that one item. Items already created keep
        their tags. New items are created unassigned, in State New, under their Parent’s area.
      </p>
    </div>
  )
}

interface SectionDef {
  key: 'tracker' | 'backlog' | 'defaultTags'
  title: string
  hint: string
  render: (props: SectionProps) => ReactNode
  status: (props: SectionProps) => ReactNode
  /** Azure DevOps Projects only. */
  adoOnly?: boolean
}

const SECTIONS: SectionDef[] = [
  {
    key: 'tracker',
    title: 'Tracker',
    hint: 'The work-tracking system this Project’s Drafts are written for.',
    render: (props) => <TrackerSection {...props} />,
    status: ({ project }) => <span className="text-ink-faint">{TRACKER_LABELS[project.tracker]}</span>,
  },
  {
    key: 'backlog',
    title: 'Backlog',
    hint: 'Where Drafts are Published and Imported.',
    render: (props) => <BacklogSection {...props} />,
    status: ({ project }) =>
      project.backlog ? <span className="text-ink-faint">{project.backlog}</span> : <Tag tone="mark">Not set</Tag>,
    adoOnly: true,
  },
  {
    key: 'defaultTags',
    title: 'Default Tags',
    hint: 'Offered for every work item Publish creates. Existing items are never changed.',
    render: (props) => <TagsSection {...props} />,
    status: ({ project }) => <span className="text-ink-faint">{project.defaultTags?.length ?? 0}</span>,
    adoOnly: true,
  },
]

export function ProjectSettings(props: Readonly<SectionProps>) {
  const sections = SECTIONS.filter((section) => !section.adoOnly || props.project.tracker === 'azure-devops')
  const [current, setCurrent] = useState(sections[0].key)
  const section = sections.find((candidate) => candidate.key === current) ?? sections[0]
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <nav aria-label="Project settings" className="flex shrink-0 flex-row gap-1 sm:w-56 sm:flex-col">
        {sections.map((candidate) => (
          <button
            key={candidate.key}
            type="button"
            aria-current={candidate.key === section.key ? 'page' : undefined}
            onClick={() => setCurrent(candidate.key)}
            className={cn(
              'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm',
              candidate.key === section.key ? 'bg-fog-deep font-medium text-ink' : 'text-ink-soft hover:bg-fog',
            )}
          >
            {candidate.title}
            <span className="text-[12px] font-normal">{candidate.status(props)}</span>
          </button>
        ))}
      </nav>
      <section className="min-w-0 flex-1 rounded-lg border border-line bg-sheet p-5">
        <h2 className="font-serif text-lg font-semibold">{section.title}</h2>
        <p className="mb-4 text-[13px] text-ink-faint">{section.hint}</p>
        {section.render(props)}
      </section>
    </div>
  )
}
