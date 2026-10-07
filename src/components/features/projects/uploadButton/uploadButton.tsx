// Reads an uploaded Markdown or text file as the Glossary body, dropping its own title.
import { type ChangeEvent } from 'react'

import { Upload } from 'lucide-react'

import { withoutTitle } from '#core/glossary/glossary.ts'

/** Reads an uploaded Markdown or text file as the Glossary body, dropping its own title. */
export function UploadButton({ onText }: Readonly<{ onText: (text: string) => void }>) {
  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onText(withoutTitle(await file.text()))
  }
  return (
    <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-sheet px-2.5 text-[13px] hover:border-ink-faint">
      <Upload size={13} /> Upload .md
      <input type="file" accept=".md,.markdown,.txt,text/*" className="sr-only" onChange={onChange} />
    </label>
  )
}
