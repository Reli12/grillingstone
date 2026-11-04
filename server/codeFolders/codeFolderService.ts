// Code Folder service: checks a proposed folder against the linking rules, links, edits and unlinks Code Folders,
// and reports their current branch state and what they exclude. Paths are stored as the human chose them and
// resolved whenever they are used.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type {
  CodeFolder,
  CodeFolderCheck,
  CodeFolderState,
  ExclusionPreview,
} from '#core/codeFolder/codeFolderTypes.ts'
import { checkCodeFolderPath, checkLabel, type FolderFacts } from '#core/codeFolder/linkingRules.ts'
import type { Project } from '#core/contract/apiTypes.ts'
import { newId } from '#core/shared/ids.ts'

import { DATA_DIR } from '../config.ts'
import { CodeFolderError } from '../http/errors.ts'
import { NotFound } from '../storage/errors.ts'
import { getProject, saveCodeFolders } from '../storage/projects.ts'
import { openCodeFolder, previewExclusions } from './codeFolderReader.ts'
import { type GitOptions, gitState } from './gitFacts.ts'

export interface NewCodeFolder {
  path: string
  label: string
  defaultBranch: string
  extraExclusions: string[]
}

export type CodeFolderChange = Partial<Pick<CodeFolder, 'label' | 'defaultBranch' | 'extraExclusions'>>

const MAX_SUGGESTED_LABEL = 24

/** A label suggestion from the folder's name: lowercase letters, digits and dashes, made unique. */
function suggestLabel(folderPath: string, taken: string[]) {
  const base =
    path
      .basename(folderPath)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SUGGESTED_LABEL - 2) || 'code'
  let n = 1
  let label = base
  while (taken.includes(label)) label = `${base}-${++n}`
  return label
}

const cleanPatterns = (patterns: string[]) => patterns.map((pattern) => pattern.trim()).filter(Boolean)

/** The folder's real path when it exists, so a symlink can't hide where it leads; else the path as resolved. */
async function realOrResolved(folderPath: string) {
  const resolved = path.resolve(folderPath.trim())
  return fs.realpath(resolved).catch(() => resolved)
}

export class CodeFolderService {
  /** One change at a time per Project, so two quick edits can't overwrite each other. */
  private queues = new Map<string, Promise<unknown>>()
  private git: GitOptions

  constructor(git: GitOptions = {}) {
    this.git = git
  }

  private serial<T>(projectId: string, change: () => Promise<T>): Promise<T> {
    const next = (this.queues.get(projectId) ?? Promise.resolve()).then(change, change)
    this.queues.set(
      projectId,
      next.catch(() => undefined),
    )
    return next
  }

  /** The linking rules' verdict on a path, with what the Link step prefills. */
  async check(projectId: string, folderPath: string): Promise<CodeFolderCheck> {
    const project = await getProject(projectId)
    const resolved = await realOrResolved(folderPath)
    const stat = await fs.stat(resolved).catch(() => null)
    const state = stat?.isDirectory() ? await gitState(resolved, this.git) : null
    const facts: FolderFacts = {
      path: resolved,
      platform: process.platform === 'win32' ? 'win32' : 'posix',
      homeDir: os.homedir(),
      dataDir: await realOrResolved(DATA_DIR),
      exists: !!stat,
      isDirectory: !!stat?.isDirectory(),
      git: state ?? { available: true, inGit: false, hasIgnoreRules: false },
      fileCount: 0,
    }
    // Counting files means walking the folder, so a folder refused anyway is not counted.
    if (checkCodeFolderPath(facts).status !== 'rejected') {
      const open = await openCodeFolder({ label: 'check', path: resolved, extraExclusions: [] }, this.git)
      facts.fileCount = (await previewExclusions(open, this.git)).readable
    }
    const labels = (project.codeFolders ?? []).map((folder) => folder.label)
    return {
      path: resolved,
      check: checkCodeFolderPath(facts),
      suggestedLabel: suggestLabel(resolved, labels),
      suggestedDefaultBranch: state?.inGit ? (state.suggestedDefaultBranch ?? state.branch ?? '') : '',
      inGit: !!state?.inGit,
    }
  }

  /** Links a folder. Rejections refuse it; warnings don't — the human saw them and chose to link anyway. */
  add(projectId: string, input: NewCodeFolder): Promise<Project> {
    return this.serial(projectId, async () => {
      const project = await getProject(projectId)
      const folders = project.codeFolders ?? []
      const { check } = await this.check(projectId, input.path)
      if (check.status === 'rejected') throw new CodeFolderError(check.reasons)
      const label = input.label.trim()
      const labelProblem = checkLabel(
        label,
        folders.map((folder) => folder.label),
      )
      if (labelProblem) throw new CodeFolderError([labelProblem])
      const folder: CodeFolder = {
        id: newId('cf'),
        label,
        path: input.path.trim(),
        defaultBranch: input.defaultBranch.trim(),
        extraExclusions: cleanPatterns(input.extraExclusions),
      }
      return saveCodeFolders(projectId, [...folders, folder])
    })
  }

  update(projectId: string, folderId: string, change: CodeFolderChange): Promise<Project> {
    return this.serial(projectId, async () => {
      const folders = (await getProject(projectId)).codeFolders ?? []
      const current = folders.find((folder) => folder.id === folderId)
      if (!current) throw new NotFound(`No Code Folder ${folderId} in this Project`)
      const label = change.label?.trim() ?? current.label
      const others = folders.filter((folder) => folder.id !== folderId).map((folder) => folder.label)
      const labelProblem = checkLabel(label, others)
      if (labelProblem) throw new CodeFolderError([labelProblem])
      const updated: CodeFolder = {
        ...current,
        label,
        defaultBranch: change.defaultBranch?.trim() ?? current.defaultBranch,
        extraExclusions: change.extraExclusions ? cleanPatterns(change.extraExclusions) : current.extraExclusions,
      }
      return saveCodeFolders(
        projectId,
        folders.map((folder) => (folder.id === folderId ? updated : folder)),
      )
    })
  }

  /** Unlinks a folder; the folder itself is never touched. */
  remove(projectId: string, folderId: string): Promise<Project> {
    return this.serial(projectId, async () => {
      const folders = (await getProject(projectId)).codeFolders ?? []
      if (!folders.some((folder) => folder.id === folderId))
        throw new NotFound(`No Code Folder ${folderId} in this Project`)
      return saveCodeFolders(
        projectId,
        folders.filter((folder) => folder.id !== folderId),
      )
    })
  }

  /** Each Code Folder as it is right now: missing or not, and its branch, commit and uncommitted changes. */
  async states(projectId: string): Promise<CodeFolderState[]> {
    const folders = (await getProject(projectId)).codeFolders ?? []
    return Promise.all(folders.map((folder) => this.stateOf(folder)))
  }

  async stateOf(folder: CodeFolder): Promise<CodeFolderState> {
    const resolved = await realOrResolved(folder.path)
    const stat = await fs.stat(resolved).catch(() => null)
    if (!stat?.isDirectory())
      return { ...folder, missing: true, inGit: false, branch: null, commit: '', uncommitted: 0, onDefaultBranch: true }
    const state = await gitState(resolved, this.git)
    if (!state.inGit)
      return {
        ...folder,
        missing: false,
        inGit: false,
        branch: null,
        commit: '',
        uncommitted: 0,
        onDefaultBranch: true,
      }
    return {
      ...folder,
      missing: false,
      inGit: true,
      branch: state.branch,
      commit: state.commit,
      uncommitted: state.uncommitted,
      onDefaultBranch: !folder.defaultBranch || state.branch === folder.defaultBranch,
    }
  }

  async preview(projectId: string, folderId: string): Promise<ExclusionPreview> {
    const folder = ((await getProject(projectId)).codeFolders ?? []).find((candidate) => candidate.id === folderId)
    if (!folder) throw new NotFound(`No Code Folder ${folderId} in this Project`)
    const open = await openCodeFolder(folder, this.git).catch((error: Error) => {
      throw new NotFound(error.message)
    })
    return previewExclusions(open, this.git)
  }
}
