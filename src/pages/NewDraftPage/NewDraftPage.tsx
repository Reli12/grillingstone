import { useParams } from 'react-router'
import { useDrafts, useProject } from '@/api/hooks/projects/projectHooks'
import { useTemplates } from '@/api/hooks/templates/templateHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { NewDraftForm } from '@/components/features/drafts/newDraftForm/newDraftForm'

export default function NewDraftPage() {
  const { projectId = '' } = useParams()
  const { data: project } = useProject(projectId)
  const { data: templates } = useTemplates()
  const { data: drafts } = useDrafts(projectId)

  if (!project || !templates) return <PageLoading />
  return (
    <div className="h-full overflow-y-auto">
      <NewDraftForm project={project} templates={templates} drafts={drafts ?? []} />
    </div>
  )
}
