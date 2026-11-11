// The New Draft page: loads the Project, Templates and Drafts the form needs; an Azure DevOps Project with a Backlog
// may also start a Draft by Importing an existing work item.
import { useState } from 'react'
import { useParams } from 'react-router'

import { useConnection } from '@/api/hooks/ado/adoHooks'
import { useDrafts, useProject } from '@/api/hooks/projects/projectHooks'
import { useTemplates } from '@/api/hooks/templates/templateHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { ImportDraftDialog } from '@/components/features/drafts/importDraftDialog/importDraftDialog'
import { NewDraftForm } from '@/components/features/drafts/newDraftForm/newDraftForm'

export default function NewDraftPage() {
  const { projectId = '' } = useParams()
  const { data: project } = useProject(projectId)
  const { data: templates } = useTemplates()
  const { data: drafts } = useDrafts(projectId)
  const { data: connection } = useConnection()
  const [importing, setImporting] = useState(false)

  if (!project || !templates) return <PageLoading />
  const canImport = project.tracker === 'azure-devops' && Boolean(project.backlog) && connection?.state === 'connected'
  return (
    <div className="h-full overflow-y-auto">
      {canImport && (
        <p className="mx-auto max-w-2xl px-4 pt-6 text-sm text-ink-soft">
          Already in Azure DevOps?{' '}
          <button type="button" className="font-medium text-claude hover:underline" onClick={() => setImporting(true)}>
            Import a work item from {project.backlog}
          </button>
        </p>
      )}
      <NewDraftForm project={project} templates={templates} drafts={drafts ?? []} />
      {canImport && <ImportDraftDialog projectId={projectId} open={importing} onClose={() => setImporting(false)} />}
    </div>
  )
}
