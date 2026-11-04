// Code Folders: folders of source code on the human's machine that a Project links, and what the API says about
// them — a link check, the current branch state, and the exclusion preview.
import type { ExclusionRule } from '#core/codeFolder/excludedFiles.ts'
import type { LinkCheck } from '#core/codeFolder/linkingRules.ts'

/** A Code Folder as the Project stores it. The path is kept as the human chose it and resolved when used. */
export interface CodeFolder {
  id: string
  /** Short, unique in the Project; Claude cites code as "label: path". */
  label: string
  path: string
  defaultBranch: string
  extraExclusions: string[]
}

/** What the Check step reports for a proposed folder. */
export interface CodeFolderCheck {
  /** The path as resolved. */
  path: string
  check: LinkCheck
  suggestedLabel: string
  /** From the remote's HEAD, else the current branch; '' outside git. */
  suggestedDefaultBranch: string
  inGit: boolean
}

/** A Code Folder as it is right now: what the Code Folders tab and the session-start block show. */
export interface CodeFolderState extends CodeFolder {
  missing: boolean
  inGit: boolean
  /** null when HEAD is detached or the folder is not in git. */
  branch: string | null
  commit: string
  uncommitted: number
  /** False when off the default branch (a detached HEAD counts as off). Always true outside git. */
  onDefaultBranch: boolean
}

export interface ExclusionGroup {
  rule: ExclusionRule
  label: string
  /** A fixed exclusion, which can't be lifted. */
  fixed: boolean
  count: number
  examples: string[]
}

/** Which files of a Code Folder are excluded, and how many stay readable. */
export interface ExclusionPreview {
  readable: number
  groups: ExclusionGroup[]
  /** Committed examples and settings that stay readable on purpose, when the folder has them. */
  stillReadable: string[]
}

/** The branch state of each Code Folder a session reads, kept on its Transcript. */
export interface CodeFolderSnapshot {
  label: string
  branch: string | null
  commit: string
  uncommitted: number
  onDefaultBranch: boolean
  defaultBranch: string
  inGit: boolean
}
