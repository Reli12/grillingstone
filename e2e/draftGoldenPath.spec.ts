// The main journey in a real browser: a new Project, a PBI grilled with the (fake) Assistant until v1 is written,
// and that v1 ready to copy into Azure DevOps.
import { expect, test, V1_USER_STORY, writeV1 } from './fixtures.ts'

test('a requirement is grilled into a v1 PBI that can be copied for Azure DevOps', async ({ page, assistantLabel }) => {
  await writeV1(page, 'Golden Path')
  // The session ran on the run's Assistant: its intro says which one had the requirement.
  await expect(page.getByText(`${assistantLabel} has the requirement`)).toBeVisible()

  const userStory = page.getByRole('region', { name: 'User Story' })
  await expect(userStory).toContainText(V1_USER_STORY)
  await expect(page.getByRole('region', { name: 'Acceptance Criteria' })).toBeVisible()

  await page.getByRole('button', { name: 'Copy for Azure DevOps' }).click()
  const copyDialog = page.getByRole('dialog', { name: 'Copy for Azure DevOps' })
  await expect(copyDialog.getByText(V1_USER_STORY)).toBeVisible()
})
