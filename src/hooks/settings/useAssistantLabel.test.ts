// Tests for useAssistantLabel: outside a session the UI names the Assistant chosen in Settings.
import { waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { endpoints } from '@/api/endpoints/endpoints'
import { useAssistantLabel } from '@/hooks/settings/useAssistantLabel'
import { settingsFixture } from '@test/mocks/handlers'
import { server } from '@test/mocks/server'
import { renderHook } from '@test/utils/testUtils'

describe('useAssistantLabel', () => {
  it('names the Assistant chosen in Settings', async () => {
    server.use(http.get(`*${endpoints.settings}`, () => HttpResponse.json({ ...settingsFixture, assistant: 'codex' })))
    const { result } = renderHook(() => useAssistantLabel())
    await waitFor(() => expect(result.current).toBe('Codex'))
  })
})
