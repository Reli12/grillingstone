// The Glossary is maintained on the Project's Glossary tab; the preview beside the Drafts links into it.
import { createProject, expect, test } from './fixtures.ts'

test('a term added on the Glossary tab shows in the preview and links back to its row', async ({ page }) => {
  await createProject(page, 'Glossary Tab Project')
  await page.getByRole('tab', { name: 'Glossary' }).click()
  await expect(page).toHaveURL(/\/glossary$/)

  await page.getByRole('button', { name: 'Add term' }).click()
  await page.getByRole('textbox', { name: 'Term' }).fill('Archived Device')
  await page.getByRole('textbox', { name: 'Definition' }).fill('A device hidden from dashboards, still billed.')
  await page.getByRole('button', { name: 'Save term' }).click()
  await expect(page.getByText('1 term')).toBeVisible()

  await page.getByRole('tab', { name: 'Drafts' }).click()
  await page.getByRole('link', { name: 'Archived Device' }).click()
  await expect(page).toHaveURL(/\/glossary\?term=Archived%20Device$/)
  await expect(page.getByRole('button', { name: /^Archived Device/ })).toHaveAttribute('data-highlighted', 'true')
})
