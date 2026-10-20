// What every smoke spec imports: Playwright's `test` plus a guard that fails the test when the page logs a
// console error or throws, the Assistant the run uses, and the steps several journeys share (a new Project, a
// Draft grilled up to v1).
import { expect, type Page, test as base } from '@playwright/test'

import { ASSISTANT_LABELS, type AssistantName } from '#core/session/assistantName.ts'

/** What a Playwright project sets: the Assistant its specs run on (the fake one, via GRILLINGSTONE_*_BIN). */
export interface AssistantOptions {
  assistant: AssistantName
}

/** Set once per worker: Playwright gives each project its own, so a project's specs all run on its Assistant. */
interface WorkerFixtures extends AssistantOptions {
  chosenAssistant: void
}

export const test = base.extend<{ failOnPageErrors: void; assistantLabel: string }, WorkerFixtures>({
  assistant: ['claude', { option: true, scope: 'worker' }],
  // Each worker first chooses its project's Assistant in Settings, so the projects share no state. Through the API:
  // the Settings page's own choice has its tests, and every Settings call checks both Assistants can run.
  chosenAssistant: [
    async ({ playwright, assistant }, use, workerInfo) => {
      const request = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL })
      const { availability: _availability, ...settings } = await (await request.get('/api/settings')).json()
      const saved = await request.put('/api/settings', { data: { ...settings, assistant } })
      expect(saved.ok()).toBe(true)
      await request.dispose()
      await use()
    },
    { scope: 'worker', auto: true },
  ],
  assistantLabel: async ({ assistant }, use) => use(ASSISTANT_LABELS[assistant]),
  failOnPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(error.message))
      await use()
      expect(errors, 'the page logged errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Text from the fixture validPbiContent() that fakeClaude.mjs submits as v1: the start of its User Story. */
export const V1_USER_STORY = 'As a Manager, I want to archive a device'

/** Creates a Project with an empty Glossary from Home; ends on the new Project's page. */
export async function createProject(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'New Project' }).click()
  const dialog = page.getByRole('dialog', { name: 'New Project' })
  await dialog.getByRole('textbox', { name: 'Project name' }).fill(name)
  await dialog.getByRole('button', { name: 'Create Project' }).click()
}

/** Answers the session's open question card in the human's own words. */
export async function answerQuestion(page: Page, answer: string) {
  await page.getByRole('textbox', { name: 'Your answer' }).fill(answer)
  await page.getByRole('button', { name: 'Answer', exact: true }).click()
}

/** A new Project with one PBI Draft grilled until the (fake) Assistant has written v1; ends on the Draft. */
export async function writeV1(page: Page, projectName: string) {
  await createProject(page, projectName)
  await page.getByRole('button', { name: 'Grill your first requirement' }).click()
  await page.getByRole('textbox', { name: 'Requirement' }).fill('Managers need to archive devices.')
  await page.getByRole('button', { name: 'Start grilling' }).click()

  // fakeClaude.mjs and fakeCodex.mjs each ask exactly one question card before they are told to write.
  await answerQuestion(page, 'Managers only')
  await page.getByRole('button', { name: 'Enough — write it' }).click()
  await expect(page.getByText('Draft v1', { exact: true })).toBeVisible()
}
