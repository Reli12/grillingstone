import { useTemplates } from '@/api/hooks/templates/templateHooks'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { NewTemplateForm } from '@/components/features/templates/newTemplateForm/newTemplateForm'

export default function NewTemplatePage() {
  const { data: templates } = useTemplates()
  if (!templates) return <PageLoading />
  return <NewTemplateForm templates={templates} />
}
