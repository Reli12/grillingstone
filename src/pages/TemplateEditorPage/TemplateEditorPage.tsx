// The Template editor page: finds the Template by id and remounts the editor on each new version.
import { useParams } from 'react-router'

import { useTemplates } from '@/api/hooks/templates/templateHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { TemplateEditor } from '@/components/features/templates/templateEditor/templateEditor'

export default function TemplateEditorPage() {
  const { templateId = '' } = useParams()
  const { data: templates } = useTemplates()
  if (!templates) return <PageLoading />
  const template = templates.find((candidate) => candidate.id === templateId)
  if (!template) return <div className="p-10 text-center text-ink-soft">This Template no longer exists.</div>
  return (
    <div className="h-full overflow-y-auto">
      {/* A new key per saved version remounts the editor, so its form starts from that version. */}
      <TemplateEditor key={`${template.id}-${template.version}`} template={template} />
    </div>
  )
}
