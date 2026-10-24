// The Jira journey in a real browser: a Jira Project, a Story grilled with Claude (the fake one) until v1 is
// written, and that v1 copied for Jira as rich text or as wiki markup for Jira Data Center.
import { answerQuestion, expect, test, V1_USER_STORY } from './fixtures.ts'

test('a requirement is grilled into a v1 Jira Story that can be copied as rich text or wiki markup', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New Project' }).click()
  const newProject = page.getByRole('dialog', { name: 'New Project' })
  await newProject.getByRole('textbox', { name: 'Project name' }).fill('Jira Path')
  // Picked here, not in Settings, so the other specs keep creating Azure DevOps Projects.
  await newProject.getByRole('radiogroup', { name: 'Tracker' }).getByRole('radio', { name: 'Jira' }).click()
  await newProject.getByRole('button', { name: 'Create Project' }).click()
  await expect(page.getByText('Drafts for Jira')).toBeVisible()

  await page.getByRole('button', { name: 'Grill your first requirement' }).click()
  await expect(page.getByRole('radio', { name: 'Story', exact: true })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: /Default Jira Story Template/ })).toBeChecked()
  await page.getByRole('textbox', { name: 'Requirement' }).fill('Managers need to archive devices.')
  await page.getByRole('button', { name: 'Start grilling' }).click()

  // fakeClaude.mjs asks exactly one question card, then submits the PBI fixture, whose keys the Story shares.
  await answerQuestion(page, 'Managers only')
  await page.getByRole('button', { name: 'Enough — write it' }).click()
  await expect(page.getByText('Draft v1', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Copy for Jira' }).click()
  const copyDialog = page.getByRole('dialog', { name: 'Copy for Jira' })
  await expect(copyDialog.getByRole('button', { name: 'Copy Summary' })).toBeVisible()
  await expect(copyDialog.getByText(V1_USER_STORY)).toBeVisible()
  await copyDialog.getByRole('radio', { name: /Wiki markup/ }).click()
  await expect(copyDialog.getByText(/^h2\. User Story/)).toBeVisible()
  await expect(copyDialog.getByText(/h2\. Acceptance Criteria/)).toBeVisible()
})
