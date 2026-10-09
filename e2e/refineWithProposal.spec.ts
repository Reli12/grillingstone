// A later session on a v1 Draft in a real browser: it proposes instead of overwriting, a change to text the human
// edited arrives as a Conflict, and taking Claude's version makes the next Iteration.
import { answerQuestion, expect, test, writeV1 } from './fixtures.ts'

const HUMAN_EDIT = 'As a Manager, I archive devices that no longer report.'

test("a Conflict on a hand-edited Section is decided in place and taking Claude's makes v2", async ({ page }) => {
  await writeV1(page, 'Refine With Proposal')

  // fakeClaude.mjs always proposes a rewrite of the first prose Section — the User Story — so editing it by hand
  // first is what turns that rewrite into a Conflict.
  const userStory = page.getByRole('region', { name: 'User Story' })
  await userStory.getByTitle('Click to edit').click()
  await userStory.getByRole('textbox', { name: 'Text' }).fill(HUMAN_EDIT)
  await userStory.getByRole('button', { name: 'Save' }).click()
  await expect(userStory).toContainText(HUMAN_EDIT)

  // "Grill this" only appears on hover, as it does for a human.
  await userStory.hover()
  await userStory.getByRole('button', { name: 'Grill this' }).click()
  await page.getByRole('dialog', { name: 'Grill “User Story”' }).getByRole('button', { name: 'Start grilling' }).click()
  await answerQuestion(page, 'Keep it short')
  await page.getByRole('button', { name: 'Enough — write it' }).click()

  await expect(page.getByText('1 Conflict', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept all clean (0)' })).toBeDisabled()
  await expect(userStory.getByText('Conflict', { exact: true })).toBeVisible()

  await userStory.getByRole('button', { name: 'Take Claude’s' }).click()
  await expect(userStory).toContainText(`${HUMAN_EDIT} (revised)`)
  await expect(page.getByText('Draft v2', { exact: true })).toBeVisible()
})
