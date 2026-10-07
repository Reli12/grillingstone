// Realistic fixtures for core tests: a PBI "Archive device from device list".
import { newDraft, writeV1 } from '#core/draft/draft.ts'
import type { Draft, DraftContent } from '#core/draft/draftTypes.ts'
import type { Template } from '#core/template/templateTypes.ts'

import bugTemplate from '../../defaults/templates/bug.json' with { type: 'json' }
import pbiTemplate from '../../defaults/templates/pbi.json' with { type: 'json' }
import taskTemplate from '../../defaults/templates/task.json' with { type: 'json' }

export const defaultPbiTemplate = pbiTemplate as Template
export const defaultBugTemplate = bugTemplate as Template
export const defaultTaskTemplate = taskTemplate as Template

// A fresh copy on every call, so a test that mutates its content never leaks into another.
export const validPbiContent = (): DraftContent => ({
  title: 'Archive device from device list',
  sections: [
    {
      key: 'userStory',
      body: 'As a Manager, I want to archive a device, so that it no longer appears on dashboards while its history stays available for billing.',
    },
    {
      key: 'roles',
      body: '| Action | Admin | Manager | Technician |\n|---|---|---|---|\n| Archive device | ✅ | ✅ | ❌ |',
    },
    {
      key: 'scope',
      entries: [
        { title: 'In scope', body: 'Archive a single device from the device detail page' },
        { title: 'Out of scope', body: 'Bulk archive — separate PBI; bulk endpoint not ready' },
      ],
    },
    { key: 'reusedPatterns', entries: [{ title: 'Standard confirm dialog', body: '[wiki] — no deviation' }] },
    {
      key: 'openQuestions',
      entries: [
        {
          title: '1. Do archived devices keep sending telemetry?',
          body: 'Why it matters: storage cost\nProposed default: ingested, alerts muted\nTagged to: @BA\nStatus: Open',
        },
        {
          title: '2. Should archiving notify the site owner?',
          body: 'Why it matters: surprise\nProposed default: no\nStatus: Open',
        },
      ],
    },
    { key: 'dependencies', entries: [{ title: 'Backend API must provide', body: 'PATCH /devices/{id}/archive' }] },
    {
      key: 'technicalNotes',
      body: 'Reuse useDeviceMutation; invalidate device list and dashboard queries on success.',
    },
    { key: 'design', body: 'N/A — no Figma yet; confirm dialog follows the standard pattern.' },
    {
      key: 'acceptanceCriteria',
      entries: [
        {
          title: 'AC01 - Archive single device (ref: Feature BR02)',
          body: 'Given a Manager views an active device\nWhen they choose Archive and confirm\nThen the device disappears from all dashboards',
        },
        {
          title: 'AC02 - Archived device stays billable (ref: Feature BR04)',
          body: 'Given a device was archived mid-month\nWhen the monthly invoice is generated\nThen usage up to the archive timestamp is billed',
        },
      ],
    },
  ],
})

export const meta = { date: '2026-09-22', author: 'dorijan' }

/** A freshly written v1: nothing touched by the human yet. */
export const v1Draft = (): Draft =>
  writeV1(
    newDraft({
      projectId: 'customer-portal',
      workItemType: 'PBI',
      template: defaultPbiTemplate,
      requirement: 'Managers need to archive devices.',
      now: meta.date,
    }),
    validPbiContent(),
    meta,
  )

export const sectionByKey = (draft: Draft, key: string) => draft.sections.find((section) => section.key === key)!

/** The Acceptance Criteria Section of the fixture PBI. */
export const acOf = (draft: Draft) => sectionByKey(draft, 'acceptanceCriteria')
/** A Proposal change rewriting AC02 (billing) — a Conflict once the human has edited AC02. */
export const rewriteAc02 = (draft: Draft) => ({
  kind: 'replaceEntry' as const,
  sectionId: acOf(draft).id,
  entryId: acOf(draft).entries[1].id,
  body: 'Given one or more devices were archived\nWhen invoiced\nThen usage up to each archive timestamp is billed',
})
