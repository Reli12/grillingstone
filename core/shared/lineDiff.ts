// A line-level diff (longest common subsequence) for short documents such as a pasted work item, so the
// repo needs no diff dependency. Only the added and removed lines are returned, in reading order.

export interface LineChange {
  kind: 'added' | 'removed'
  line: string
}

const linesOf = (text: string) => (text ? text.split('\n') : [])

/** The lines removed from `before` and added in `after`; unchanged lines are left out. */
export function lineChanges(before: string, after: string): LineChange[] {
  const old = linesOf(before)
  const next = linesOf(after)
  // common[i][j]: length of the longest common subsequence of old[i..] and next[j..].
  const common = Array.from({ length: old.length + 1 }, () => new Array<number>(next.length + 1).fill(0))
  for (let i = old.length - 1; i >= 0; i--)
    for (let j = next.length - 1; j >= 0; j--)
      common[i][j] = old[i] === next[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1])

  const changes: LineChange[] = []
  let i = 0
  let j = 0
  while (i < old.length && j < next.length) {
    if (old[i] === next[j]) {
      i++
      j++
    } else if (common[i + 1][j] >= common[i][j + 1]) changes.push({ kind: 'removed', line: old[i++] })
    else changes.push({ kind: 'added', line: next[j++] })
  }
  while (i < old.length) changes.push({ kind: 'removed', line: old[i++] })
  while (j < next.length) changes.push({ kind: 'added', line: next[j++] })
  return changes
}
