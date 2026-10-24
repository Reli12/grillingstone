// The Tracker: the work-tracking system a Project's Drafts are written for and copied into.
// Anything stored before Trackers existed (Projects, Templates, Draft snapshots, bundles) is Azure DevOps.

export const TRACKERS = ['azure-devops', 'jira'] as const
export type Tracker = (typeof TRACKERS)[number]

/** Where every install starts, and what data without a Tracker means. */
export const DEFAULT_TRACKER: Tracker = 'azure-devops'

export const TRACKER_LABELS: Record<Tracker, string> = {
  'azure-devops': 'Azure DevOps',
  jira: 'Jira',
}

export const isTracker = (value: unknown): value is Tracker => TRACKERS.includes(value as Tracker)

/** The stored Tracker, or Azure DevOps for data written before Trackers existed. */
export const trackerOrDefault = (value: unknown): Tracker => (isTracker(value) ? value : DEFAULT_TRACKER)
