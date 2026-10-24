// The Project page's Tracker line: which Tracker the Drafts are written for, switchable until the first Draft.
import type { Project } from '#core/contract/apiTypes.ts'
import { TRACKER_LABELS, TRACKERS } from '#core/shared/tracker.ts'

import { useChangeTracker } from '@/api/hooks/projects/projectHooks'

interface ProjectTrackerProps {
  project: Project
  /** Any Draft, Discarded or Archived included, fixes the Tracker. */
  hasDrafts: boolean
}

export function ProjectTracker({ project, hasDrafts }: Readonly<ProjectTrackerProps>) {
  const change = useChangeTracker(project.id)
  const other = TRACKERS.find((tracker) => tracker !== project.tracker) ?? project.tracker
  return (
    <p className="mt-1 text-sm text-ink-faint">
      Drafts for <span className="font-medium text-ink-soft">{TRACKER_LABELS[project.tracker]}</span>
      {hasDrafts ? (
        <span title="Each Draft keeps a Template written for this Tracker. Create a new Project for the other one.">
          {' '}
          · fixed now that the Project has Drafts
        </span>
      ) : (
        <>
          {' · '}
          <button
            type="button"
            className="underline hover:text-ink disabled:opacity-45"
            disabled={change.isPending}
            onClick={() => change.mutate(other)}
          >
            Switch to {TRACKER_LABELS[other]}
          </button>
        </>
      )}
    </p>
  )
}
