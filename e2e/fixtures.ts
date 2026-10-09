// What every smoke spec imports: Playwright's `test` plus a guard that fails the test when the page logs a
// console error or throws, and the steps several journeys share (a new Project, a Draft grilled up to v1).
import { expect, type Page, test as base } from '@playwright/test'

export const test = base.extend<{ failOnPageErrors: void }>({
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

/** A new Project with one PBI Draft grilled until Claude (the fake) has written v1; ends on the Draft. */
export async function writeV1(page: Page, projectName: string) {
  await createProject(page, projectName)
  await page.getByRole('button', { name: 'Grill your first requirement' }).click()
  await page.getByRole('textbox', { name: 'Requirement' }).fill('Managers need to archive devices.')
  await page.getByRole('button', { name: 'Start grilling' }).click()

  // fakeClaude.mjs asks exactly one question card before it is told to write.
  await answerQuestion(page, 'Managers only')
  await page.getByRole('button', { name: 'Enough — write it' }).click()
  await expect(page.getByText('Draft v1', { exact: true })).toBeVisible()
}
