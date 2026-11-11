// How it works: the steps, in order (ids are the page anchors).

export const STEPS = [
  { id: 'project', title: 'Create a Project' },
  { id: 'connect', title: 'Connect Azure DevOps' },
  { id: 'backlog', title: 'Bring in the BA’s work items' },
  { id: 'start', title: 'Start a Draft' },
  { id: 'grill', title: 'Get grilled' },
  { id: 'draft', title: 'Shape the Draft' },
  { id: 'refine', title: 'Refine with Proposals' },
  { id: 'publish', title: 'Publish or copy it out' },
  { id: 'templates', title: 'Make it your team’s' },
] as const
