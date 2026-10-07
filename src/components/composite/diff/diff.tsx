// Inline word diff between two texts: deletions struck out, additions highlighted.
import { DiffRun } from '@/components/atoms/diffRun/diffRun'
import { wordDiff } from '@/lib/wordDiff'

interface DiffProps {
  before: string
  after: string
}

export function Diff({ before, after }: Readonly<DiffProps>) {
  return (
    <p className="font-serif text-[15px] leading-7 whitespace-pre-wrap">
      {wordDiff(before, after).map((part, i) => (
        <DiffRun key={i} part={part} />
      ))}
    </p>
  )
}
