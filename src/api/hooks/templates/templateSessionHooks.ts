import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/reactQueryKeys'
import { templateSessionsApi, type NewTemplateSessionRequest } from '@/api/templateSessionsApi'

export const useLiveTemplateSession = () => useQuery({ queryKey: queryKeys.liveTemplateSession, queryFn: templateSessionsApi.getLive })

export const useTemplateTranscript = (sessionId: string) =>
  useQuery({ queryKey: queryKeys.templateSession(sessionId), queryFn: () => templateSessionsApi.getTranscript(sessionId) })

export function useStartTemplateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: NewTemplateSessionRequest) => templateSessionsApi.start(body),
    onSuccess: (session) => qc.setQueryData(queryKeys.liveTemplateSession, { session }),
  })
}
