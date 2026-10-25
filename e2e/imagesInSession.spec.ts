// Images in a Grilling Session in a real browser: an Image pasted into the message box is prepared, sent, shown as a
// thumbnail in the live thread and, after a reload, in the Transcript; the fake Claude reports the image block it got.
import { createProject, expect, test } from './fixtures.ts'

/** A real 1×1 PNG: small enough to need no shrinking, so the saved Image is the pasted one. */
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

test('an Image pasted into the message box reaches Claude and stays in the Transcript', async ({ page }) => {
  await createProject(page, 'Images')
  await page.getByRole('button', { name: 'Grill your first requirement' }).click()
  await page.getByRole('textbox', { name: 'Requirement' }).fill('Managers need to archive devices.')
  await page.getByRole('button', { name: 'Start grilling' }).click()

  // fakeClaude.mjs asks exactly one question card, then waits for the human.
  const box = page.getByRole('textbox', { name: 'Message Claude' })
  await expect(page.getByRole('textbox', { name: 'Your answer' })).toBeVisible()

  // Paste a PNG the way a screenshot arrives: as a file on the clipboard.
  await box.evaluate((textarea, base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
    const clipboardData = new DataTransfer()
    clipboardData.items.add(new File([bytes], 'screen.png', { type: 'image/png' }))
    textarea.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
  }, PNG_BASE64)

  const pending = page.getByRole('list', { name: 'Images to send' })
  await expect(pending.getByRole('img', { name: 'screen.png' })).toBeVisible()
  await expect(page.getByText(/Images are sent to Claude/)).toBeVisible()

  await page.getByRole('button', { name: 'Send', exact: true }).click()

  // The live thread shows the saved Image, served by the backend, and the fake says what reached it.
  const sent = page.getByRole('list', { name: 'Images sent' })
  await expect(sent.getByRole('img', { name: 'Image 1' })).toHaveJSProperty('naturalWidth', 1)
  await expect(page.getByText('Received image blocks: Image 1 (image/png')).toBeVisible()
  await expect(pending).toBeHidden()

  // After a reload the Transcript still shows it.
  await page.reload()
  const reloaded = page.getByRole('list', { name: 'Images sent' }).getByRole('img', { name: 'Image 1' })
  await expect(reloaded).toHaveJSProperty('naturalWidth', 1)
})
