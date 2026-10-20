// A Template Session in a real browser: the (fake) Assistant grills how a team writes a work item until it can be
// written down as a new Template, which then opens in the editor and appears among the Templates.
import { answerQuestion, expect, test } from './fixtures.ts'

// The Template both fakes write in a Template Session. Templates belong to no Project, so a repeat within one
// run saves it again as "Spike PBI (copy)"; the spec takes the saved name from the editor.
const WRITTEN_TEMPLATE = /^Spike PBI/

test('a Template Session writes a new Template that opens in the editor', async ({ page, assistantLabel }) => {
  await page.goto('/templates')
  await page.getByRole('link', { name: 'New Template' }).click()
  await page
    .getByRole('textbox', { name: 'What the Template is for' })
    .fill('Spike PBIs: timeboxed investigations that end in a written recommendation.')
  await page.getByRole('button', { name: `Grill it with ${assistantLabel}` }).click()

  await answerQuestion(page, 'One week at most')
  await page.getByRole('button', { name: 'Enough — write it' }).click()

  // Once the Template is saved, the editor opens on it by itself.
  const title = page.getByRole('heading', { level: 1, name: WRITTEN_TEMPLATE })
  await expect(title).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Heading', exact: true })).toHaveValue('Goal')
  const savedName = await title.textContent()

  await page.getByRole('navigation').getByRole('link', { name: 'Templates' }).click()
  await expect(page.getByRole('checkbox', { name: `Select ${savedName} for export` })).toBeVisible()
})
