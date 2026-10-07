// One run of a word diff: unchanged, struck out (deleted) or highlighted (added).
import { type DiffPart } from '@/lib/wordDiff'

export function DiffRun({ part }: Readonly<{ part: DiffPart }>) {
  switch (part.op) {
    case 'same':
      return <span>{part.text}</span>
    case 'del':
      return <del className="text-redpencil decoration-redpencil decoration-2">{part.text}</del>
    case 'add':
      return <ins className="bg-proof-wash text-proof no-underline decoration-proof">{part.text}</ins>
  }
}
