// Prototypes in a real browser, with the fake Claude: one is started from the Draft's Prototypes tab, seen running
// while grilling goes on, opened in its own tab, clicked through, shown unable to reach the API or the internet
// (the only real-browser check of the sandbox and the Content-Security-Policy), and downloaded.
import type { APIRequestContext, Page } from '@playwright/test'

import { answerQuestion, expect, test, writeV1 } from './fixtures.ts'

/** The backend the web app talks to (playwright.config.ts): a Prototype must not be able to reach it. */
const API_URL = 'http://127.0.0.1:5398/api/projects'
const EXTERNAL_URL = 'https://example.com/'
const DOWNLOAD_NAME = /^(.+) – v1 – \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.html$/

/** Adds the fake:hold marker to the open Draft's text, so fakeClaude.mjs holds this spec's Prototype turn open. */
async function holdPrototypeTurn(page: Page, request: APIRequestContext) {
  const ids = /\/p\/([^/]+)\/d\/([^/?#]+)/.exec(page.url())
  if (!ids) throw new Error(`Not on a Draft page: ${page.url()}`)
  const draftUrl = `${API_URL}/${ids[1]}/drafts/${ids[2]}`
  const draft = (await (await request.get(draftUrl)).json()) as {
    draft: { sections: { id: string; shape: string; body: string }[] }
  }
  const section = draft.draft.sections.find((candidate) => candidate.shape === 'prose')
  if (!section) throw new Error('The Draft has no prose section to carry the marker')
  const edited = await request.post(`${draftUrl}/ops`, {
    data: { op: 'editSection', sectionId: section.id, body: `${section.body} fake:hold` },
  })
  expect(edited.ok()).toBe(true)
}

test('a Prototype is written while grilling goes on, opens sandboxed in a new tab and downloads', async ({
  page,
  context,
  request,
}) => {
  await writeV1(page, 'Prototypes')
  await holdPrototypeTurn(page, request)

  // Start one from the Draft's Prototypes tab. The fake:hold marker makes fakeClaude.mjs hold its turn open.
  await page.getByRole('tab', { name: 'Prototypes' }).click()
  await page.getByRole('button', { name: 'New Prototype' }).click()
  await page.getByRole('form', { name: 'New Prototype' }).getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('Being written for Draft v1')).toBeVisible()

  // Grilling continues meanwhile: a Grilling Session on the same Draft runs beside the Prototype Session.
  const userStory = page.getByRole('region', { name: 'User Story' })
  await userStory.hover()
  await userStory.getByRole('button', { name: 'Grill this' }).click()
  await page.getByRole('dialog', { name: 'Grill “User Story”' }).getByRole('button', { name: 'Start grilling' }).click()
  await page.getByRole('tab', { name: 'Sessions' }).click()
  await answerQuestion(page, 'Keep it short')

  // The row finishes by itself.
  await page.getByRole('tab', { name: 'Prototypes' }).click()
  const row = page.getByRole('list', { name: 'Prototypes' }).getByRole('link', { name: /^v1 · / })
  await expect(row).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Being written for Draft v1')).toBeHidden()

  // It opens in a new browser tab.
  const [viewer] = await Promise.all([context.waitForEvent('page'), row.click()])
  const draftTitle = (await viewer.getByRole('heading', { level: 1 }).textContent()) ?? ''
  expect(draftTitle).not.toBe('')

  // A click inside the Prototype's frame works.
  const prototype = viewer.frameLocator('iframe[title="Prototype"]')
  await prototype.getByRole('button', { name: 'Go' }).click()
  await expect(prototype.locator('#out')).toHaveText('Done')

  // Inside the frame, a fetch to the Grilling Stone API and one to an external host are both refused.
  const frameHandle = await viewer.locator('iframe[title="Prototype"]').elementHandle()
  const frame = await frameHandle?.contentFrame()
  if (!frame) throw new Error('The Prototype frame has no content frame')
  const outcomes = await frame.evaluate(
    async (urls) => {
      const results = await Promise.allSettled(urls.map((url) => fetch(url)))
      return results.map((result) => (result.status === 'rejected' ? 'blocked' : `reached (${result.value.status})`))
    },
    [API_URL, EXTERNAL_URL],
  )
  expect(outcomes).toEqual(['blocked', 'blocked'])

  // Download names the file after the Draft, version and time.
  const [download] = await Promise.all([
    viewer.waitForEvent('download'),
    viewer.getByRole('link', { name: 'Download' }).click(),
  ])
  const match = DOWNLOAD_NAME.exec(download.suggestedFilename())
  expect(match, `file name "${download.suggestedFilename()}"`).not.toBeNull()
  expect(match?.[1]).toBe(draftTitle.replace(/\s+/g, ' ').trim())
})
