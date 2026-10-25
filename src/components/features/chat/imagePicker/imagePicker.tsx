// The image button beside Send: opens the file picker so an Image can be added without paste or drop.
import { useRef } from 'react'

import { ImagePlus } from 'lucide-react'

import { IMAGE_MEDIA_TYPES } from '#core/session/images.ts'

import { Button } from '@/components/atoms/button/button'

interface ImagePickerProps {
  disabled?: boolean
  onFiles: (files: File[]) => void
}

const ACCEPTED_TYPES = IMAGE_MEDIA_TYPES.join(',')

/** The image button beside Send: opens the file picker so an Image can be added without paste or drop. */
export function ImagePicker({ disabled, onFiles }: Readonly<ImagePickerProps>) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button
        size="sm"
        variant="quiet"
        disabled={disabled}
        aria-label="Add an Image"
        title="Add an Image: PNG, JPEG, WebP or GIF"
        onClick={() => input.current?.click()}
      >
        <ImagePlus size={14} aria-hidden />
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        aria-label="Image files"
        tabIndex={-1}
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []))
          // Clearing lets the same file be picked again after it was removed.
          event.target.value = ''
        }}
      />
    </>
  )
}
