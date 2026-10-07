import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Template } from '#core/template/templateTypes.ts'

import { queryKeys } from '@/api/reactQueryKeys'
import { templatesApi } from '@/api/templatesApi'

export const useTemplates = () => useQuery({ queryKey: queryKeys.templates, queryFn: templatesApi.getTemplates })

/** Classifies a bundle against the local Templates; read-only on the backend, re-run per bundle. */
export const useImportPreview = (bundle: unknown) =>
  useQuery({
    queryKey: queryKeys.templateImportPreview(bundle),
    queryFn: () => templatesApi.previewImport(bundle),
    enabled: bundle !== null,
    gcTime: 0,
    retry: false,
  })

function useTemplateMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.templates }) })
}

export const useCreateTemplate = () => useTemplateMutation((t: Template) => templatesApi.createTemplate(t))
export const useUpdateTemplate = () => useTemplateMutation((t: Template) => templatesApi.updateTemplate(t))
export const useDeleteTemplate = () => useTemplateMutation((id: string) => templatesApi.deleteTemplate(id))
export const useImportTemplates = () =>
  useTemplateMutation(({ bundle, selected }: { bundle: unknown; selected: number[] }) =>
    templatesApi.importBundle(bundle, selected),
  )

/** Builds a shareable bundle; nothing changes on the backend, so the cache stays as it is. */
export const useExportTemplates = () => useMutation({ mutationFn: (ids: string[]) => templatesApi.exportBundle(ids) })
