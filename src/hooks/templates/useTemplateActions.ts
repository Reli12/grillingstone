// A Default's copy is "My …"; any other Template's copy is "… (copy)".
import { type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'

import { toast } from 'sonner'

import type { Template } from '#core/template/templateTypes.ts'

import { useCreateTemplate, useExportTemplates } from '@/api/hooks/templates/templateHooks'
import { DEFAULT_NAME_PREFIX } from '@/constants/TemplateConstants'
import { downloadJson } from '@/lib/downloadJson'
import { routesPaths } from '@/routes/routes'

/** A Default's copy is "My …"; any other Template's copy is "… (copy)". */
const copyName = (template: Template) =>
  template.isDefault ? template.name.replace(DEFAULT_NAME_PREFIX, 'My ') : `${template.name} (copy)`

/** The export's file name carries today's date (YYYY-MM-DD), so repeated exports don't overwrite each other. */
const bundleFileName = () => `templates-${new Date().toISOString().slice(0, 10)}.json`

/** Duplicating opens the copy; exporting downloads the ticked Templates; importing opens a file for preview. */
export function useTemplateActions(selected: Set<string>, openBundle: (bundle: unknown) => void) {
  const navigate = useNavigate()
  const duplicate = useCreateTemplate()
  const exportBundle = useExportTemplates()

  const onDuplicate = (template: Template) =>
    duplicate.mutate(
      { ...template, name: copyName(template) },
      { onSuccess: (copy) => void navigate(routesPaths.template(copy.id)) },
    )
  const onExport = () =>
    exportBundle.mutate([...selected], { onSuccess: (exported) => downloadJson(bundleFileName(), exported) })
  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Clear the input so choosing the same file again still fires a change.
    event.target.value = ''
    if (!file) return
    try {
      openBundle(JSON.parse(await file.text()))
    } catch {
      toast.error('That file is not valid JSON.')
    }
  }
  return { onDuplicate, onExport, onImportFile, duplicating: duplicate.isPending, exporting: exportBundle.isPending }
}
