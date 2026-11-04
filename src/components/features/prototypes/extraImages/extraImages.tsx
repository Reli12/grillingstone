// The Images added on the Prototype start form by paste, drop or the picker: the message box's thumbnails and notices.
import { ImageNotices } from '@/components/features/chat/imageNotices/imageNotices'
import { ImagePicker } from '@/components/features/chat/imagePicker/imagePicker'
import { ImageThumbnails } from '@/components/features/chat/imageThumbnails/imageThumbnails'
import type { ImageAttachments } from '@/hooks/chat/useImageAttachments'

/** The Images added on the Prototype start form by paste, drop or the picker. */
export function ExtraImages({ attachments }: Readonly<{ attachments: ImageAttachments }>) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-ink">Add more Images</span>
        <ImagePicker onFiles={attachments.add} />
      </div>
      <p className="text-[13px] text-ink-soft">Paste or drop an Image anywhere on this form, or pick one.</p>
      <ImageThumbnails pending={attachments.pending} onRemove={attachments.remove} />
      {/* The form says for itself when the Images are too big, so the message box's size warning stays out. */}
      <ImageNotices attachments={{ ...attachments, showWarning: false }} />
    </div>
  )
}
