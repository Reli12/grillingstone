// New Project: choose which Project's Glossary to copy.
import type { ProjectSummary } from '#core/contract/apiTypes.ts'

interface CopySourceSelectProps {
  projects: ProjectSummary[]
  copyFrom: string
  onCopy: (projectId: string) => void
}

export function CopySourceSelect({ projects, copyFrom, onCopy }: Readonly<CopySourceSelectProps>) {
  return (
    <select
      value={copyFrom}
      onChange={(event) => onCopy(event.target.value)}
      aria-label="Copy from Project"
      className="h-8 rounded-md border border-line bg-sheet px-2 text-sm"
    >
      <option value="" disabled>
        Choose a Project…
      </option>
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  )
}
