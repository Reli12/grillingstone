import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Template } from '#core/template/templateTypes.ts'
import { defaultPbiTemplate } from '#core/testing/fixtures.ts'

import { endpoints } from '@/api/endpoints/endpoints'
import NewTemplatePage from '@/pages/NewTemplatePage/NewTemplatePage'
import { server } from '@test/mocks/server'
import { render } from '@test/utils/testUtils'

let started: unknown
let created: Template | undefined
const renderPage = () => render(<NewTemplatePage />, { route: '/templates/new', path: '/templates/new' })

describe('NewTemplatePage', () => {
  beforeEach(() => {
    started = created = undefined
    server.use(
      http.get(`*${endpoints.liveTemplateSession}`, () => HttpResponse.json({ session: null })),
      http.post(`*${endpoints.templateSessions}`, async ({ request }) => {
        started = await request.json()
        return HttpResponse.json({ id: 's1' })
      }),
      http.post(`*${endpoints.templates}`, async ({ request }) => {
        created = ((await request.json()) as { template: Template }).template
        return HttpResponse.json({ ...created, id: 't1' })
      }),
    )
  })

  it('grills a described Template with Claude', async () => {
    const { user } = renderPage()
    const grill = await screen.findByRole('button', { name: 'Grill it with Claude' })
    expect(grill).toBeDisabled()

    await user.type(screen.getByRole('textbox', { name: 'What the Template is for' }), ' Spike PBIs ')
    await user.type(screen.getByRole('textbox', { name: /Example work items/ }), 'Example')
    await user.click(grill)

    await screen.findByTestId('navigated')
    expect(started).toEqual({ workItemType: 'PBI', purpose: 'Spike PBIs', examples: 'Example' })
  })

  it('grills from a base Template of another type', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Epic' }))
    await user.click(screen.getByRole('radio', { name: 'PBI' }))
    await user.click(screen.getByRole('radio', { name: /Default PBI/ }))
    await user.type(screen.getByRole('textbox', { name: 'What the Template is for' }), 'Spikes')
    await user.click(screen.getByRole('button', { name: 'Grill it with Claude' }))

    await screen.findByTestId('navigated')
    expect(started).toMatchObject({ workItemType: 'PBI', baseTemplateId: defaultPbiTemplate.id })
  })

  it('builds a blank Template seeded with the purpose', async () => {
    const { user } = renderPage()
    await user.type(
      await screen.findByRole('textbox', { name: 'What the Template is for' }),
      'Spike PBIs for investigations',
    )
    await user.click(screen.getByRole('button', { name: 'Build it myself' }))

    await screen.findByTestId('navigated')
    expect(created).toMatchObject({ name: 'New PBI Template', workItemType: 'PBI', isDefault: false })
    expect(created?.method).toContain('Spike PBIs for investigations')
  })

  it('copies a base Template when building it myself', async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole('radio', { name: /Default PBI/ }))
    await user.click(screen.getByRole('button', { name: 'Build it myself' }))

    await screen.findByTestId('navigated')
    expect(created).toMatchObject({ name: defaultPbiTemplate.name.replace(/^Default /, 'My '), isDefault: false })
  })

  it('points to a running Template Session instead of starting another', async () => {
    server.use(http.get(`*${endpoints.liveTemplateSession}`, () => HttpResponse.json({ session: { id: 'live-1' } })))
    renderPage()
    expect(await screen.findByRole('link', { name: 'Continue it' })).toHaveAttribute(
      'href',
      '/templates/session/live-1',
    )
  })
})
