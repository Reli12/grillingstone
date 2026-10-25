// What the message box tells the human about Images: why a file was refused, the one-time hint, the size warning.
import type { ImageAttachments } from '@/hooks/chat/useImageAttachments'

const HINT = 'Images are sent to Claude. Crop out anything confidential before you send.'
const WARNING = 'This session’s Images add up to about 20 MB, close to Claude’s request size limit.'

/** What the message box tells the human about Images: why a file was refused, the one-time hint, the size warning. */
export function ImageNotices({
  attachments: { refusals, showHint, showWarning },
}: Readonly<{ attachments: ImageAttachments }>) {
  if (!refusals.length && !showHint && !showWarning) return null
  return (
    <div className="space-y-0.5 px-3 pt-2 text-[13px]">
      {refusals.map(({ id, text }) => (
        <p key={id} role="alert" className="text-redpencil">
          {text}
        </p>
      ))}
      {showWarning && (
        <p role="status" className="text-redpencil">
          {WARNING}
        </p>
      )}
      {showHint && (
        <p role="status" className="text-ink-faint">
          {HINT}
        </p>
      )}
    </div>
  )
}
