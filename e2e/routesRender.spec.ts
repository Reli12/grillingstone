// Smoke check that every top-level page loads in a real browser and logs no errors — the wiring (lazy pages,
// providers, the /api proxy) that jsdom tests never exercise.
import { expect, test } from './fixtures.ts'

// Home greets a first-time user differently from one who already has Projects; either heading is fine here.
const HOME_HEADING = /Grill a requirement into a work item\.|Projects/

const pages = [
  { path: '/', heading: HOME_HEADING },
  { path: '/templates', heading: 'Templates' },
  { path: '/settings', heading: 'Settings' },
  { path: '/how-it-works', heading: 'How it works' },
  { path: '/legal', heading: 'Legal' },
]

for (const { path, heading } of pages) {
  test(`${path} renders its page`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  })
}
