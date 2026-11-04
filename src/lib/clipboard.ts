// Clipboard writes for "Copy for <Tracker>" and per-Section copy: rich HTML for rich-text boxes, with a
// plain-text flavour beside it for boxes that drop formatting.

const LINE_BREAK_TAG = /<br>/g // every <br> the renderer writes
const BLOCK_END_TAG = /<\/(p|h2|h3|li|tr)>/g // the closing tag of each block that ends a line of text
const THREE_OR_MORE_NEWLINES = /\n{3,}/g // runs of blank lines left between blocks

/** The plain-text version of rendered HTML, one line per block, for pastes that drop formatting. */
export function plainText(html: string) {
  const container = document.createElement('div')
  container.innerHTML = html.replace(LINE_BREAK_TAG, '\n').replace(BLOCK_END_TAG, '$&\n')
  const text = container.textContent ?? ''
  return text.replace(THREE_OR_MORE_NEWLINES, '\n\n').trim()
}

/**
 * Puts rich HTML on the clipboard with `text` as its plain-text flavour (by default, the HTML's own text).
 * Browsers without ClipboardItem get the plain text only.
 */
export async function copyRich(html: string, text = plainText(html)) {
  if (!('ClipboardItem' in window)) return navigator.clipboard.writeText(text)
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ])
}
