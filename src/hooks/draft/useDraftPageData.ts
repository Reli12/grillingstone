// Everything the page reads: the Draft with its live session, its Transcripts, the Project and the Templates.
import { useDraft, useTranscripts } from '@/api/hooks/drafts/draftHooks'
import { useProject } from '@/api/hooks/projects/projectHooks'
import { useTemplates } from '@/api/hooks/templates/templateHooks'

/** Everything the page reads: the Draft with its live session, its Transcripts, the Project and the Templates. */
export function useDraftPageData(projectId: string, draftId: string) {
  const { data, error } = useDraft(projectId, draftId)
  const { data: transcripts } = useTranscripts(projectId, draftId)
  const { data: project } = useProject(projectId)
  const { data: templates } = useTemplates()
  return { data, error, transcripts, project, templates }
}
