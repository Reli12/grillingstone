// The Images of the message being written: paste, drop and picker add them, with the limits, the one-time
// hint and the warning near 20 MB. Used by both message boxes.
import { type ClipboardEvent, type DragEvent, useRef, useState } from 'react'

import {
  base64ByteLength,
  checkImageCount,
  type ImageUpload,
  isImageMediaType,
  SESSION_IMAGE_WARNING_BYTES,
} from '#core/session/images.ts'

import { prepareImage } from '@/lib/imagePreparation'
import { markHinted, recordSentImageBytes, sessionImageBytes, transferHint, wasHinted } from '@/lib/imageSessionMemory'
import type { ImageRefusal, PendingImage } from '@/types/chat'

/** The Images a send takes along; they leave the list only once the send has worked. */
export interface ImageBatch {
  uploads: ImageUpload[]
  ids: string[]
  bytes: number
}

/** Only files the browser says are images are taken from a paste; anything else is left to paste as text. */
const pastedImages = (files: FileList) => Array.from(files).filter((file) => file.type.startsWith('image/'))

const totalBytes = (items: PendingImage[]) => items.reduce((sum, { image }) => sum + image.size, 0)

/** Images that were attached before (a session's start form, tried again), back in the box without a file name. */
const restoredImages = (images: ImageUpload[]): PendingImage[] =>
  images.flatMap(({ mediaType, data }, i) =>
    isImageMediaType(mediaType)
      ? [{ id: `restored-${i + 1}`, fileName: '', image: { mediaType, data, size: base64ByteLength(data) } }]
      : [],
  )

/** `restored` fills the box at first, for a form that reopens with the Images it was given before. */
export function useImageAttachments(sessionKey: string, restored: ImageUpload[] = []) {
  const [pending, setPending] = useState<PendingImage[]>(() => restoredImages(restored))
  const [refusals, setRefusals] = useState<ImageRefusal[]>([])
  const [hintOpen, setHintOpen] = useState(false)
  // Files are prepared one after another; this keeps the list right between awaits.
  const latest = useRef<PendingImage[]>(pending)
  const counter = useRef(0)
  const nextId = (prefix: string) => `${prefix}-${++counter.current}`

  const commit = (next: PendingImage[]) => {
    latest.current = next
    setPending(next)
    if (!next.length) setHintOpen(false)
  }

  const add = async (files: File[]) => {
    const problems: ImageRefusal[] = []
    const refuse = (text: string) => problems.push({ id: nextId('refusal'), text })
    for (const file of files) {
      const prepared = await prepareImage(file)
      if (!prepared.ok) {
        refuse(`${file.name || 'This file'}: ${prepared.reason}`)
        continue
      }
      const countReason = checkImageCount(latest.current.length + 1)
      if (countReason) {
        refuse(countReason.message)
        break
      }
      commit([...latest.current, { id: nextId('image'), fileName: file.name, image: prepared.image }])
      if (!wasHinted(sessionKey)) {
        markHinted(sessionKey)
        setHintOpen(true)
      }
    }
    setRefusals(problems)
  }

  const remove = (id: string) => {
    commit(latest.current.filter((candidate) => candidate.id !== id))
    setRefusals([])
  }

  /** The Images to send now. They stay in the box until `markSent`, so a failed send loses nothing. */
  const batch = (): ImageBatch => ({
    uploads: latest.current.map(({ image }) => ({ mediaType: image.mediaType, data: image.data })),
    ids: latest.current.map(({ id }) => id),
    bytes: totalBytes(latest.current),
  })

  /**
   * The send worked: those Images leave the box and count towards the session's total. When a new session was
   * started, `startedSessionKey` is its id: the total and the hint already shown move over to it.
   */
  const markSent = (sent: ImageBatch, startedSessionKey?: string) => {
    const finalKey = startedSessionKey ?? sessionKey
    recordSentImageBytes(finalKey, sent.bytes)
    if (finalKey !== sessionKey) transferHint(sessionKey, finalKey)
    commit(latest.current.filter(({ id }) => !sent.ids.includes(id)))
    setRefusals([])
  }

  const warn = sessionImageBytes(sessionKey) + totalBytes(pending) >= SESSION_IMAGE_WARNING_BYTES

  // The handlers fit any element that takes text or Images: the message box, or the Prototype start form.
  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    const files = pastedImages(event.clipboardData.files)
    if (!files.length) return
    event.preventDefault()
    void add(files)
  }
  // Whatever files are dropped are taken in, so one that is not an Image is refused with its reason instead of
  // the browser opening it in place of the app.
  const onDrop = (event: DragEvent<HTMLElement>) => {
    const files = Array.from(event.dataTransfer.files)
    if (!files.length) return
    event.preventDefault()
    void add(files)
  }
  // Without this the browser doesn't treat the box as a place to drop.
  const onDragOver = (event: DragEvent<HTMLElement>) => event.preventDefault()

  return {
    pending,
    pendingBytes: totalBytes(pending),
    refusals,
    showHint: hintOpen && pending.length > 0,
    showWarning: warn,
    add: (files: File[]) => void add(files),
    remove,
    batch,
    markSent,
    textareaProps: { onPaste, onDrop, onDragOver },
  }
}

export type ImageAttachments = ReturnType<typeof useImageAttachments>
