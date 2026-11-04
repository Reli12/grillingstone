# Grillingstone: changes to reapply

**Base:** `master` at commit `fbdbeda` ("Merge pull request #19 from Reli12/fix/submit-from-file").
Every step below assumes the files are as they were at that commit.

There are three changes. A and B are independent. **C builds on B**, because both change the Section
heading, so apply B before C:

| # | Change | Files |
|---|---|---|
| A | Hide the harmless `ws proxy error: ECONNRESET` message in the dev console | `vite.config.ts`, `server/hub.ts` |
| B | **Copy** a single Section for Azure DevOps or Jira from its heading | `core/publish/publishRenderer.ts`, `src/lib/clipboard.ts` (new), `src/components/features/draft/publish/copyForTracker/copyForTracker.tsx`, `src/components/features/draft/sheet/rowActions/rowActions.tsx`, `src/components/features/draft/sheet/sectionHeader/sectionHeader.tsx`, plus tests in `core/publish/publishRenderer.test.ts` and `src/pages/DraftPage/DraftPage.test.tsx` |
| C | **Show / hide discarded** parts, for the whole Draft and for each Section | `src/context/DiscardedVisibility/DiscardedVisibility.tsx` (new), `src/hooks/draft/useDiscardedVisibilityValue.ts` (new), `src/components/features/draft/sheet/discardedToggle/discardedToggle.tsx` (new), `src/components/features/draft/layout/draftColumn/draftColumn.tsx`, `src/components/features/draft/layout/draftToolbar/draftToolbar.tsx`, `src/components/features/draft/sheet/sectionHeader/sectionHeader.tsx`, `src/components/features/draft/sheet/sortableSections/sortableSections.tsx`, `src/components/features/draft/sheet/entries/entries.tsx`, plus a test in `src/pages/DraftPage/DraftPage.test.tsx` |

**How to apply:**
- **New file:** create it with the full content shown.
- **Replace whole file:** replace the file's entire content with the block shown.
- **Find → Replace:** find the *Find* block in the file (it occurs exactly once) and put the *Replace* block in its place.

You can also give this file to Claude Code on the other machine and ask it to apply the changes.

---

## A. Hide the harmless WebSocket reset message

**Why:** the backend runs under `node --watch` and restarts whenever `server/` or `core/` changes. Each
restart cuts the browser's WebSocket, and Vite logs `ws proxy error: Error: read ECONNRESET`. The browser
reconnects on its own (`src/api/serverSocket.ts`), so the message is noise. Adding a listener in the
proxy's `configure` hook doesn't help, because Vite always attaches its own logging handler after
`configure` runs. So the message is filtered in Vite's logger instead.

The backend also refuses sockets from unknown origins by dropping the connection, and that shows up as
the same `ECONNRESET`. So the hub now logs each refusal itself, and a real configuration problem stays
visible.

### A1. `vite.config.ts` (Find → Replace)

**Find:**
```ts
import { defineConfig } from 'vitest/config'

const serverPort = Number(process.env.GRILLINGSTONE_SERVER_PORT ?? 5311)

export default defineConfig({
  plugins: [react(), tailwindcss()],
```

**Replace:**
```ts
import { createLogger } from 'vite'
import { defineConfig } from 'vitest/config'

const serverPort = Number(process.env.GRILLINGSTONE_SERVER_PORT ?? 5311)

// The backend restarts under `node --watch` whenever server/ or core/ changes, cutting every open
// websocket. Vite logs each cut as a "ws proxy error: ECONNRESET" although the browser reconnects
// on its own, so those resets are dropped. Every other proxy error is still logged.
const logger = createLogger()
const logError = logger.error.bind(logger)
logger.error = (msg, options) => {
  const code = (options?.error as NodeJS.ErrnoException | null | undefined)?.code
  if (code === 'ECONNRESET' && msg.includes('ws proxy')) return
  logError(msg, options)
}

export default defineConfig({
  customLogger: logger,
  plugins: [react(), tailwindcss()],
```

### A2. `server/hub.ts` (Find → Replace)

**Find:**
```ts
      if (!req.url?.startsWith('/api/ws') || (origin && !ALLOWED_ORIGINS.has(origin))) {
        socket.destroy()
```

**Replace:**
```ts
      if (!req.url?.startsWith('/api/ws') || (origin && !ALLOWED_ORIGINS.has(origin))) {
        // Logged here because the dev proxy hides the resulting connection reset (see vite.config.ts).
        console.warn(`[hub] refused websocket ${req.url ?? ''} from origin ${origin ?? '(none)'}`)
        socket.destroy()
```

The hub test that sends an unknown origin now prints one `[hub] refused…` warning. That's expected.

---

## B. Copy a single Section for the Tracker

**What it does:** each Section heading gets a **Copy** button next to **Grill this**; it appears when you
hover over the heading. It copies just that Section exactly as it appears inside its field in **Copy for
Tracker**:
- A Section that shares a field with others (for example, the Sections in Description) keeps its heading.
- A Section that has a field to itself (for example, Acceptance Criteria in Azure DevOps) is copied
  without a heading, because the field already names it.
- Discarded Entries are left out, and the copy uses what's currently in the editor.

**Clipboard format** (not Markdown):

| Tracker | Rich (`text/html`) | Plain (`text/plain`) |
|---|---|---|
| Azure DevOps | HTML | the HTML's text, one line per block |
| Jira | HTML | **Jira wiki markup**: pastes into Data Center's Text mode |

A notification confirms each copy, for example *Copied "Acceptance Criteria" for Azure DevOps.*

### B1. `core/publish/publishRenderer.ts` (Find → Replace)

Adds `renderSection()` and makes `render()` use the same helpers, so a single Section and the full field
can never disagree.

**Find:**
```ts
export function render(draft: Draft, format: RenderFormat = 'html'): Rendered {
  const emit = EMITTERS[format]
  const visible = draft.sections.filter((section) => !section.discarded)
  const byField = new Map<string, Section[]>()
  for (const section of visible) byField.set(section.target, [...(byField.get(section.target) ?? []), section])

  const fields: Record<string, string> = {}
  for (const [field, sections] of byField) {
    // A field holding a single Section (e.g. Acceptance Criteria) is already named by the field itself.
    const withHeadings = DESCRIPTION_FIELDS.includes(field) || sections.length > 1
    const heading = (section: Section) => (withHeadings ? emit.heading(section.heading) : '')
    fields[field] = sections.map((section) => heading(section) + sectionBody(section, emit)).join(emit.blockGap)
  }
```

**Replace:**
```ts
/** The non-Discarded Sections, grouped by target field in the human's order. */
function sectionsByField(draft: Draft): Map<string, Section[]> {
  const byField = new Map<string, Section[]>()
  for (const section of draft.sections) {
    if (section.discarded) continue
    byField.set(section.target, [...(byField.get(section.target) ?? []), section])
  }
  return byField
}

/** A field holding a single Section (e.g. Acceptance Criteria) is already named by the field itself. */
const fieldShowsHeadings = (field: string, sections: Section[]) =>
  DESCRIPTION_FIELDS.includes(field) || sections.length > 1

/** One Section exactly as it appears inside its field, heading included when the field shows headings. */
function renderedSection(section: Section, withHeading: boolean, emit: Emitter): string {
  return (withHeading ? emit.heading(section.heading) : '') + sectionBody(section, emit)
}

/** One Section on its own, as it reads inside its field's full value; null when it is Discarded or unknown. */
export function renderSection(draft: Draft, sectionId: string, format: RenderFormat = 'html'): string | null {
  const section = draft.sections.find((candidate) => candidate.id === sectionId)
  if (!section || section.discarded) return null
  const siblings = sectionsByField(draft).get(section.target) ?? [section]
  return renderedSection(section, fieldShowsHeadings(section.target, siblings), EMITTERS[format])
}

export function render(draft: Draft, format: RenderFormat = 'html'): Rendered {
  const emit = EMITTERS[format]
  const fields: Record<string, string> = {}
  for (const [field, sections] of sectionsByField(draft)) {
    const withHeadings = fieldShowsHeadings(field, sections)
    fields[field] = sections.map((section) => renderedSection(section, withHeadings, emit)).join(emit.blockGap)
  }
```

The rest of `render()` (the Iteration Log part and `return`) stays unchanged.

### B2. `src/lib/clipboard.ts` (new file)

Shared clipboard helper, moved out of `copyForTracker.tsx` so the dialog and the Section button write
the clipboard the same way.

```ts
// Clipboard writes for "Copy for <Tracker>" and per-Section copy: rich HTML for rich-text boxes, with a
// plain-text flavour beside it for boxes that drop formatting.

const LINE_BREAK_TAG = /<br>/g // every <br> the renderer writes
const BLOCK_END_TAG = /<\/(p|h2|h3|li|tr)>/g // the closing tag of each block that ends a line of text
const THREE_OR_MORE_NEWLINES = /\n{3,}/g // runs of blank lines left between blocks

/** The plain-text version of rendered HTML, one line per block, for pastes that drop formatting. */
export function plainText(html: string) {
  const container = document.createElement('div')
  container.innerHTML = html.replace(LINE_BREAK_TAG, '\n').replace(BLOCK_END_TAG, '$&\n')
  const text = container.textContent ?? ''
  return text.replace(THREE_OR_MORE_NEWLINES, '\n\n').trim()
}

/**
 * Puts rich HTML on the clipboard with `text` as its plain-text flavour (by default, the HTML's own text).
 * Browsers without ClipboardItem get the plain text only.
 */
export async function copyRich(html: string, text = plainText(html)) {
  if (!('ClipboardItem' in window)) return navigator.clipboard.writeText(text)
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ])
}
```

### B3. `src/components/features/draft/publish/copyForTracker/copyForTracker.tsx` (two Find → Replace)

Now uses the shared helper. The dialog behaves exactly as before.

**Find (1):**
```ts
import { PasteFormatSwitch } from '@/components/features/draft/publish/pasteFormatSwitch/pasteFormatSwitch'
```

**Replace (1):**
```ts
import { PasteFormatSwitch } from '@/components/features/draft/publish/pasteFormatSwitch/pasteFormatSwitch'
import { copyRich } from '@/lib/clipboard'
```

**Find (2):**
```ts
const LINE_BREAK_TAG = /<br>/g // every <br> the renderer writes
const BLOCK_END_TAG = /<\/(p|h2|h3|li|tr)>/g // the closing tag of each block that ends a line of text
const THREE_OR_MORE_NEWLINES = /\n{3,}/g // runs of blank lines left between blocks

/** The plain-text version of a field's HTML, one line per block, for pastes that drop formatting. */
const plain = (html: string) => {
  const container = document.createElement('div')
  container.innerHTML = html.replace(LINE_BREAK_TAG, '\n').replace(BLOCK_END_TAG, '$&\n')
  const text = container.textContent ?? ''
  return text.replace(THREE_OR_MORE_NEWLINES, '\n\n').trim()
}

/** Puts the field on the clipboard: wiki markup as plain text, or rich HTML with a plain-text fallback. */
async function copy(field: CopyField, format: PasteFormat) {
  if (field.html === null) return navigator.clipboard.writeText(field.text)
  if (format === 'wiki' && field.wiki !== null) return navigator.clipboard.writeText(field.wiki)
  if (!('ClipboardItem' in window)) return navigator.clipboard.writeText(plain(field.html))
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([field.html], { type: 'text/html' }),
      'text/plain': new Blob([plain(field.html)], { type: 'text/plain' }),
    }),
  ])
}
```

**Replace (2):**
```ts
/** Puts the field on the clipboard: wiki markup as plain text, or rich HTML with a plain-text fallback. */
async function copy(field: CopyField, format: PasteFormat) {
  if (field.html === null) return navigator.clipboard.writeText(field.text)
  if (format === 'wiki' && field.wiki !== null) return navigator.clipboard.writeText(field.wiki)
  await copyRich(field.html)
}
```

### B4. `src/components/features/draft/sheet/rowActions/rowActions.tsx` (replace whole file)

Adds the optional **Copy** button. The layout was also tidied to stay under the 40-line function lint
limit.

```tsx
// The hover actions on a Section or Entry: "Grill this", Copy (Sections only) and Discard.
import { Copy, MessageCircleQuestion, X } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'
import { cn } from '@/lib/cn'

interface RowActionsProps {
  onGrill?: () => void
  /** Copies the row for the Tracker. */
  onCopy?: () => void
  /** What lands on the clipboard, shown on hover over Copy. */
  copyTitle?: string
  onDiscard?: () => void
  grillDisabled: boolean
  entry?: boolean
}

/** Hidden until the pointer or focus is on the row: an Entry's own group, or a Section's heading. */
const REVEAL = {
  entry: 'group-focus-within/entry:opacity-100 group-hover/entry:opacity-100',
  section: 'group-focus-within/head:opacity-100 group-hover/head:opacity-100',
}

const DISCARD_TITLE = 'Discard — hidden and not published, restorable any time'

export function RowActions(props: Readonly<RowActionsProps>) {
  const { onGrill, onCopy, copyTitle, onDiscard, grillDisabled, entry = false } = props
  return (
    <span className={cn('flex shrink-0 items-center gap-0.5 opacity-0', entry ? REVEAL.entry : REVEAL.section)}>
      {onGrill && (
        <Button
          size="sm"
          variant="quiet"
          className="text-claude"
          onClick={onGrill}
          disabled={grillDisabled}
          title={grillDisabled ? 'A session is running on this Draft' : 'Start a Focused Session on this part'}
        >
          <MessageCircleQuestion size={14} /> Grill this
        </Button>
      )}
      {onCopy && (
        <Button size="sm" variant="quiet" onClick={onCopy} title={copyTitle}>
          <Copy size={14} /> Copy
        </Button>
      )}
      {onDiscard && (
        <Button size="sm" variant="quiet" onClick={onDiscard} title={DISCARD_TITLE}>
          <X size={14} /> Discard
        </Button>
      )}
    </span>
  )
}
```

### B5. `src/components/features/draft/sheet/sectionHeader/sectionHeader.tsx` (replace whole file)

```tsx
// The Section's heading line: name, lock, the Tracker field it is copied into, and its actions.
import { Lock } from 'lucide-react'
import { toast } from 'sonner'

import type { Draft } from '#core/draft/draftTypes.ts'
import { renderSection } from '#core/publish/publishRenderer.ts'
import { type Tracker, TRACKER_LABELS } from '#core/shared/tracker.ts'
import { fieldLabel } from '#core/shared/trackerFields.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

import { Tag } from '@/components/atoms/tag/tag'
import { RowActions } from '@/components/features/draft/sheet/rowActions/rowActions'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import { copyRich } from '@/lib/clipboard'
import type { SectionProps } from '@/types/draft'

/**
 * Copies one Section exactly as the Publish Renderer writes it into its field. For Jira the plain-text
 * flavour is wiki markup, so the same copy pastes as rich text in Cloud or Visual mode and as wiki markup
 * into Data Center's Text mode.
 */
async function copySection(draft: Draft, sectionId: string) {
  const html = renderSection(draft, sectionId)
  if (html === null) return
  const wiki = templateTracker(draft.template) === 'jira' ? renderSection(draft, sectionId, 'jira-wiki') : null
  await copyRich(html, wiki ?? undefined)
}

/** The Copy button's tooltip: which field the Section goes into, and for Jira, the two paste modes. */
function copyTitle(tracker: Tracker, target: string) {
  const base = `Copy this Section for the ${fieldLabel(target)} field`
  return tracker === 'jira' ? `${base} — rich text, or wiki markup in Text mode` : base
}

/** The Section's heading line: name, lock, the Tracker field it is copied into, and its actions. */
export function SectionHeader({ section }: Readonly<SectionProps>) {
  const { draft, apply, grill, sessionRunning } = useDraftEditor()
  const tracker = templateTracker(draft.template)
  // A locked Section can never be discarded, so it offers no Discard action.
  const discard = section.locked ? undefined : () => apply({ op: 'discardSection', sectionId: section.id })
  const copy = () =>
    copySection(draft, section.id).then(
      () => toast.success(`Copied “${section.heading}” for ${TRACKER_LABELS[tracker]}.`),
      () => toast.error('The browser refused clipboard access.'),
    )
  return (
    <header className="group/head flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
      <h2 className="font-serif text-[19px] font-semibold tracking-tight text-ink">{section.heading}</h2>
      {section.locked && (
        <span className="text-ink-faint" title="Locked Section — you can edit and move it, never discard it">
          <Lock size={14} aria-label="Locked" />
        </span>
      )}
      <Tag tone="claude" title="The field this Section is copied into">
        {fieldLabel(section.target)}
      </Tag>
      <span className="ml-auto" />
      <RowActions
        grillDisabled={sessionRunning}
        onGrill={() => grill({ sectionId: section.id, heading: section.heading })}
        onCopy={() => void copy()}
        copyTitle={copyTitle(tracker, section.target)}
        onDiscard={discard}
      />
    </header>
  )
}
```

### B6. Tests: `core/publish/publishRenderer.test.ts` (three Find → Replace)

**Find (1):**
```ts
import { render } from '#core/publish/publishRenderer.ts'
```
**Replace (1):**
```ts
import { render, renderSection } from '#core/publish/publishRenderer.ts'
```

**Find (2):**
```ts
import { sectionByKey, v1Draft } from '#core/testing/fixtures.ts'
```
**Replace (2):**
```ts
import { acOf, sectionByKey, v1Draft } from '#core/testing/fixtures.ts'
```

**Find (3)**, the end of the file:
```ts
      expect(description.trimEnd()).toMatch(/h2\. PBI Iteration Log\n22\.09\.2026 - @dorijan v1$/)
      expect(description).not.toContain('<')
    })
  })
})
```
**Replace (3):**
```ts
      expect(description.trimEnd()).toMatch(/h2\. PBI Iteration Log\n22\.09\.2026 - @dorijan v1$/)
      expect(description).not.toContain('<')
    })

    it('renders one Section as wiki markup, with its heading in the Description', () => {
      const draft = jiraDraft()
      const section = renderSection(draft, sectionByKey(draft, 'acceptanceCriteria').id, 'jira-wiki')
      expect(section).toMatch(/^h2\. Acceptance Criteria\n\*AC01 - Archive single device/)
      expect(section).not.toContain('User Story')
    })
  })

  describe('one Section', () => {
    it('is the exact slice of its field, heading included in the Description', () => {
      const draft = v1Draft()
      const section = renderSection(draft, sectionByKey(draft, 'userStory').id)
      expect(section).toMatch(/^<h2>User Story<\/h2>\n/)
      expect(render(draft).fields[ADO_FIELDS.description]).toContain(section)
      expect(section).not.toContain('Technical Notes')
    })

    it('has no heading when it is the only Section in its field', () => {
      const draft = v1Draft()
      const section = renderSection(draft, acOf(draft).id)
      expect(section).toMatch(/^<p><strong>AC01 - Archive single device/)
      expect(section).toBe(render(draft).fields[ADO_FIELDS.acceptanceCriteria])
    })

    it('leaves out Discarded Entries, and is null once the Section itself is Discarded or unknown', () => {
      let draft = v1Draft()
      const oq = sectionByKey(draft, 'openQuestions')
      draft = applyHumanOp(draft, { op: 'discardEntry', sectionId: oq.id, entryId: oq.entries[1].id })
      expect(renderSection(draft, oq.id)).not.toContain('notify the site owner')
      expect(renderSection(draft, oq.id)).toContain('keep sending telemetry')
      draft = applyHumanOp(draft, { op: 'discardSection', sectionId: oq.id })
      expect(renderSection(draft, oq.id)).toBeNull()
      expect(renderSection(draft, 'no-such-section')).toBeNull()
    })
  })
})
```

### B7. Tests: `src/pages/DraftPage/DraftPage.test.tsx` (Find → Replace)

Adds one page test just before the existing Jira copy test.

**Find:**
```ts
  it('copies a Jira Draft as Summary and Description, as rich text or wiki markup', async () => {
```

**Replace:**
```ts
  it('copies a single Section from its heading', async () => {
    const draft = v1Draft()
    draftBackend(draft)
    const { user } = renderPage(draft)

    const ac = await screen.findByRole('region', { name: 'Acceptance Criteria' })
    await user.click(within(ac).getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText('Copied “Acceptance Criteria” for Azure DevOps.')).toBeInTheDocument()
    const copied = await navigator.clipboard.readText()
    expect(copied).toMatch(/^AC01 - Archive single device/)
    expect(copied).not.toContain('User Story')
  })

  it('copies a Jira Draft as Summary and Description, as rich text or wiki markup', async () => {
```

---

## C. Show / hide discarded parts

**Requires B** (C5 and C9 build on B's files).

**What it does:**
- **Whole Draft:** the Draft toolbar gets a **Hide N discarded** / **Show N discarded** button. N counts
  discarded Sections plus discarded Entries inside Sections that are kept. Hiding removes all of them
  from the sheet.
- **Each Section:** a Section with discarded Entries gets its own **Hide N discarded** / **Show N
  discarded** button in its heading. Unlike Copy and Grill this, it's always visible, so you can tell
  when something is hidden. It overrides the Draft-wide setting for that Section only.
- **Changing the Draft-wide setting resets every Section** to match it.
- **A discarded part with a pending Proposal change always stays visible**, so a change waiting for
  your decision can't be hidden.
- A button only appears when there is something discarded to show or hide.

**How it behaves:**
- **Discarded parts show by default**, as before, so nothing changes until you click.
- **The setting isn't saved.** It lasts while you're on the page and resets to "show" after a reload.
- A discarded Section only follows the Draft-wide button: once discarded it's a single line with no
  heading, so it has no per-Section button.
- Hiding only changes what you see. Restore still works whenever the part is shown, and copying already
  leaves discarded parts out.

The setting follows the same pattern as `DraftEditor`: a context file holding only the context and its
hook, with the state in a hook under `src/hooks/draft/`. Keeping them apart avoids the
`react-refresh/only-export-components` lint warning.

### C1. `src/context/DiscardedVisibility/DiscardedVisibility.tsx` (new file)

```tsx
// Whether Discarded Sections and Entries show on the Draft sheet: one Draft-wide setting, which each Section
// can override for its own Entries. The value comes from useDiscardedVisibilityValue.
import { createContext, useContext } from 'react'

export interface DiscardedVisibilityValue {
  /** The Draft-wide setting: Discarded Sections, and the Entries of Sections without an override. */
  showAll: boolean
  /** Sets the Draft-wide setting and clears every Section's override. */
  setShowAll: (show: boolean) => void
  /** Whether this Section's Discarded Entries show: its own override, else the Draft-wide setting. */
  showsInSection: (sectionId: string) => boolean
  setShowsInSection: (sectionId: string, show: boolean) => void
}

export const DiscardedVisibilityContext = createContext<DiscardedVisibilityValue | null>(null)

export function useDiscardedVisibility() {
  const value = useContext(DiscardedVisibilityContext)
  if (!value) throw new Error('useDiscardedVisibility outside DiscardedVisibilityContext')
  return value
}
```

### C2. `src/hooks/draft/useDiscardedVisibilityValue.ts` (new file)

```ts
// What DiscardedVisibilityContext holds. Kept in memory for this page only; Discarded parts show by default.
import { useMemo, useState } from 'react'

import type { DiscardedVisibilityValue } from '@/context/DiscardedVisibility/DiscardedVisibility'

export function useDiscardedVisibilityValue(): DiscardedVisibilityValue {
  const [showAll, setShowAllState] = useState(true)
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map())

  return useMemo(
    () => ({
      showAll,
      setShowAll: (show: boolean) => {
        setShowAllState(show)
        setOverrides(new Map())
      },
      showsInSection: (sectionId: string) => overrides.get(sectionId) ?? showAll,
      setShowsInSection: (sectionId: string, show: boolean) =>
        setOverrides((current) => new Map(current).set(sectionId, show)),
    }),
    [showAll, overrides],
  )
}
```

### C3. `src/components/features/draft/sheet/discardedToggle/discardedToggle.tsx` (new file)

The one button used in both places.

```tsx
// Shows or hides Discarded parts: Draft-wide in the toolbar, or one Section's Entries in its heading.
import { Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/atoms/button/button'

interface DiscardedToggleProps {
  /** Whether the Discarded parts show now. */
  shown: boolean
  /** How many Discarded parts the toggle covers; it renders nothing when there are none. */
  count: number
  onChange: (shown: boolean) => void
  /** What the toggle covers, for its tooltip: "in this Draft" or "in this Section". */
  scope: string
}

export function DiscardedToggle({ shown, count, onChange, scope }: Readonly<DiscardedToggleProps>) {
  if (count === 0) return null
  const label = `${shown ? 'Hide' : 'Show'} ${count} discarded`
  return (
    <Button
      size="sm"
      variant="quiet"
      onClick={() => onChange(!shown)}
      title={`${shown ? 'Hide' : 'Show'} the Discarded parts ${scope}. Parts with a pending change always show.`}
      className="text-ink-faint"
    >
      {shown ? <EyeOff size={14} /> : <Eye size={14} />} {label}
    </Button>
  )
}
```

### C4. `src/components/features/draft/layout/draftColumn/draftColumn.tsx` (replace whole file)

Holds the setting and makes it available to the toolbar and the sheet.

```tsx
// From v1 on: the chat (or Glossary) on the left, the live Draft on the right.
import { DraftToolbar } from '@/components/features/draft/layout/draftToolbar/draftToolbar'
import { UpgradeBanner } from '@/components/features/draft/layout/upgradeBanner/upgradeBanner'
import { ProposalBar } from '@/components/features/draft/proposal/proposalBar/proposalBar'
import { DraftSheet } from '@/components/features/draft/sheet/draftSheet/draftSheet'
import { DiscardedVisibilityContext } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { useDiscardedVisibilityValue } from '@/hooks/draft/useDiscardedVisibilityValue'
import { cn } from '@/lib/cn'
import type { DraftWorkspaceLayoutProps } from '@/types/draftPage'

/** From v1 on: the chat (or Glossary) on the left, the live Draft on the right. */
/** The right column: the toolbar, the upgrade offer, the open Proposal's bar, and the Draft sheet. */
export function DraftColumn({
  projectId,
  projectName,
  draft,
  live,
  ui,
  upgradeTo,
  busy,
  onAcceptClean,
}: Readonly<Omit<DraftWorkspaceLayoutProps, 'dialogs' | 'chat'>>) {
  const running = !!live
  const discardedVisibility = useDiscardedVisibilityValue()
  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto bg-sheet lg:block', ui.mobileView === 'draft' ? 'block' : 'hidden')}
    >
      <DiscardedVisibilityContext.Provider value={discardedVisibility}>
        <div className="px-4 pb-16 sm:px-10">
          <DraftToolbar
            projectId={projectId}
            projectName={projectName}
            draft={draft}
            running={running}
            onReferences={() => ui.setRefsOpen(true)}
            onDelete={() => ui.setDeleteOpen(true)}
            onCopy={() => ui.setCopyOpen(true)}
          />
          {upgradeTo && (
            <UpgradeBanner latest={upgradeTo} draft={draft} onUpgrade={() => ui.setIntent({ kind: 'upgrade' })} />
          )}
          {draft.proposal && <ProposalBar proposal={draft.proposal} busy={busy} onAcceptClean={onAcceptClean} />}
          <div className="pt-6">
            <DraftSheet />
          </div>
        </div>
      </DiscardedVisibilityContext.Provider>
    </div>
  )
}
```

### C5. `src/components/features/draft/layout/draftToolbar/draftToolbar.tsx` (replace whole file)

Adds the Draft-wide button before **References**.

```tsx
// Above the sheet: where this Draft sits, show/hide Discarded parts, and References, Delete and Copy for the
// Draft's Tracker.
import { Link } from 'react-router'

import { ClipboardCopy, Link2, Trash2 } from 'lucide-react'

import type { Draft } from '#core/draft/draftTypes.ts'
import { TRACKER_LABELS } from '#core/shared/tracker.ts'
import { templateTracker } from '#core/template/templateTypes.ts'

import { Button } from '@/components/atoms/button/button'
import { DiscardedToggle } from '@/components/features/draft/sheet/discardedToggle/discardedToggle'
import { useDiscardedVisibility } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { routesPaths } from '@/routes/routes'

/** Discarded Sections, plus Discarded Entries in the Sections that are still there. */
function discardedCount(draft: Draft) {
  return draft.sections.reduce(
    (count, section) => count + (section.discarded ? 1 : section.entries.filter((entry) => entry.discarded).length),
    0,
  )
}

interface DraftToolbarProps {
  projectId: string
  projectName?: string
  draft: Draft
  running: boolean
  onReferences: () => void
  onDelete: () => void
  onCopy: () => void
}

/** Above the sheet: where this Draft sits, and References, Delete and Copy for the Draft's Tracker. */
export function DraftToolbar({
  projectId,
  projectName,
  draft,
  running,
  onReferences,
  onDelete,
  onCopy,
}: Readonly<DraftToolbarProps>) {
  const referenceCount = draft.references.length
  const { showAll, setShowAll } = useDiscardedVisibility()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <p className="text-[13px] text-ink-faint">
        <Link to={routesPaths.project(projectId)} className="hover:text-ink">
          {projectName}
        </Link>
        , {draft.workItemType} in the {draft.template.name} v{draft.template.version},{' '}
        <span className="font-medium text-ink">Draft v{draft.version}</span>
      </p>
      <span className="ml-auto" />
      <DiscardedToggle shown={showAll} count={discardedCount(draft)} onChange={setShowAll} scope="in this Draft" />
      <Button size="sm" variant="quiet" onClick={onReferences}>
        <Link2 size={14} /> References{referenceCount ? ` (${referenceCount})` : ''}
      </Button>
      <Button size="sm" variant="quiet" onClick={onDelete} disabled={running} aria-label="Delete Draft">
        <Trash2 size={14} />
      </Button>
      <Button size="sm" variant="ink" onClick={onCopy}>
        <ClipboardCopy size={14} /> Copy for {TRACKER_LABELS[templateTracker(draft.template)]}
      </Button>
    </div>
  )
}
```

### C6. `src/components/features/draft/sheet/sectionHeader/sectionHeader.tsx` (three Find → Replace, on top of B5)

Adds the Section's own button, before the hover actions.

**Find (1):**
```ts
import { RowActions } from '@/components/features/draft/sheet/rowActions/rowActions'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
```
**Replace (1):**
```ts
import { DiscardedToggle } from '@/components/features/draft/sheet/discardedToggle/discardedToggle'
import { RowActions } from '@/components/features/draft/sheet/rowActions/rowActions'
import { useDiscardedVisibility } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
```

**Find (2):**
```ts
/** The Section's heading line: name, lock, the Tracker field it is copied into, and its actions. */
export function SectionHeader({ section }: Readonly<SectionProps>) {
```
**Replace (2):**
```ts
/** Shows or hides this Section's Discarded Entries; renders nothing when it has none. */
function SectionDiscardedToggle({ section }: Readonly<SectionProps>) {
  const { showsInSection, setShowsInSection } = useDiscardedVisibility()
  return (
    <DiscardedToggle
      shown={showsInSection(section.id)}
      count={section.entries.filter((entry) => entry.discarded).length}
      onChange={(show) => setShowsInSection(section.id, show)}
      scope="in this Section"
    />
  )
}

/** The Section's heading line: name, lock, the Tracker field it is copied into, and its actions. */
export function SectionHeader({ section }: Readonly<SectionProps>) {
```

**Find (3):**
```tsx
      <span className="ml-auto" />
      <RowActions
```
**Replace (3):**
```tsx
      <span className="ml-auto" />
      <SectionDiscardedToggle section={section} />
      <RowActions
```

### C7. `src/components/features/draft/sheet/sortableSections/sortableSections.tsx` (replace whole file)

Leaves out discarded Sections while the Draft-wide setting hides them.

```tsx
// The Sections in the human's order; dragging one by its handle moves it.
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { SectionBlock } from '@/components/features/draft/sheet/sectionBlock/sectionBlock'
import { DRAG_START_DISTANCE_PX } from '@/constants/DragConstants'
import { useDiscardedVisibility } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'

/** The Sections in the human's order; dragging one by its handle moves it. */
export function SortableSections() {
  const { draft, apply, pending } = useDraftEditor()
  const { showAll } = useDiscardedVisibility()
  // A hidden Discarded Section still shows while a change waits on it, so no decision is ever out of sight.
  const shown = draft.sections.filter(
    (section) => !section.discarded || showAll || pending.some((change) => change.sectionId === section.id),
  )
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = draft.sections.findIndex((section) => section.id === over.id)
    apply({ op: 'moveSection', sectionId: String(active.id), toIndex })
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={shown.map((section) => section.id)} strategy={verticalListSortingStrategy}>
        <div className="mt-8 space-y-8">
          {shown.map((section) => (
            <SectionBlock key={section.id} section={section} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
```

Dragging still works with hidden Sections: the drop position is looked up in the full Section list,
so a move lands in the right place among the hidden ones too.

### C8. `src/components/features/draft/sheet/entries/entries.tsx` (replace whole file)

Leaves out a Section's discarded Entries while that Section hides them.

```tsx
// A Section's Entries as a drag-and-drop list, with "Add Entry" at the end.
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'

import { RichText } from '@/components/atoms/richText/richText'
import { AddEntry } from '@/components/features/draft/sheet/addEntry/addEntry'
import { EntryRow } from '@/components/features/draft/sheet/entryRow/entryRow'
import { DRAG_START_DISTANCE_PX } from '@/constants/DragConstants'
import { useDiscardedVisibility } from '@/context/DiscardedVisibility/DiscardedVisibility'
import { useDraftEditor } from '@/context/DraftEditor/DraftEditor'
import type { EntriesProps } from '@/types/draft'

export function Entries({ section, pending }: Readonly<EntriesProps>) {
  const { apply } = useDraftEditor()
  const showDiscarded = useDiscardedVisibility().showsInSection(section.id)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_START_DISTANCE_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const toIndex = section.entries.findIndex((entry) => entry.id === over.id)
    apply({ op: 'moveEntry', sectionId: section.id, entryId: String(active.id), toIndex })
  }
  const live = section.entries.filter((entry) => !entry.discarded)
  const changesOf = (entryId: string) => pending.filter((change) => change.entryId === entryId)
  // A hidden Discarded Entry still shows while a change waits on it, so no decision is ever out of sight.
  const shown = section.entries.filter((entry) => !entry.discarded || showDiscarded || changesOf(entry.id).length > 0)
  return (
    <>
      {live.length === 0 && section.body && (
        <RichText text={section.body} className="ml-6 font-serif text-[15px] leading-7 text-ink-soft italic" />
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {shown.map((entry) => (
              <EntryRow key={entry.id} section={section} entry={entry} changes={changesOf(entry.id)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <AddEntry section={section} />
    </>
  )
}
```

### C9. Tests: `src/pages/DraftPage/DraftPage.test.tsx` (Find → Replace, on top of B7)

Adds one page test just before B7's "copies a single Section" test.

**Find:**
```ts
  it('copies a single Section from its heading', async () => {
```

**Replace:**
```ts
  it('hides Discarded parts for the whole Draft, and shows them again for one Section', async () => {
    let draft = v1Draft()
    const oq = sectionByKey(draft, 'openQuestions')
    draft = applyHumanOp(draft, { op: 'discardSection', sectionId: sectionByKey(draft, 'design').id })
    draft = applyHumanOp(draft, { op: 'discardEntry', sectionId: oq.id, entryId: oq.entries[1].id })
    draftBackend(draft)
    const { user } = renderPage(draft)

    const discardedSection = 'Design'
    const discardedEntry = '2. Should archiving notify the site owner?'
    expect(await screen.findByText(discardedSection)).toBeInTheDocument()
    expect(screen.getByText(discardedEntry)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide 2 discarded' }))
    expect(screen.queryByText(discardedSection)).not.toBeInTheDocument()
    expect(screen.queryByText(discardedEntry)).not.toBeInTheDocument()
    expect(screen.getByText('1. Do archived devices keep sending telemetry?')).toBeInTheDocument()

    const questions = screen.getByRole('region', { name: 'Open Questions / Risks' })
    await user.click(within(questions).getByRole('button', { name: 'Show 1 discarded' }))
    expect(screen.getByText(discardedEntry)).toBeInTheDocument()
    expect(screen.queryByText(discardedSection)).not.toBeInTheDocument()

    // The Draft-wide setting clears the Section's own choice.
    await user.click(screen.getByRole('button', { name: 'Show 2 discarded' }))
    await user.click(screen.getByRole('button', { name: 'Hide 2 discarded' }))
    expect(screen.queryByText(discardedEntry)).not.toBeInTheDocument()
  })

  it('copies a single Section from its heading', async () => {
```

The rule that a discarded part with a pending Proposal change always shows has no test yet.

---

## Checking after applying

```
npm run typecheck
npx eslint vite.config.ts server/hub.ts core/publish src/lib src/context src/hooks/draft src/components/features/draft src/pages/DraftPage
npx vitest run core/publish server/hub.test.ts
npx vitest run --project web
```

Results on the original machine (Windows), with A, B and C applied:
- **Typecheck:** clean.
- **Lint:** no errors. Three warnings, all there before these changes: `max-lines-per-function` on
  `CopyForTracker`, and `react-refresh/only-export-components` in `src/context/ServerEvents/ServerEvents.tsx`
  and `src/context/Theme/Theme.tsx`.
- **Tests:** `core/publish` passed, including the 4 new renderer tests. `server/hub.test.ts` passed (2
  tests). All frontend tests passed (43 files, 232 tests), including the 2 new page tests.
- Other tests already failed on Windows before these changes: `core/session/permissionGuard.test.ts`,
  `server/sessions/streamEvents.test.ts` and the server session tests (path separators, and
  `spawn EFTYPE` when starting the fake `claude` script). These changes don't affect them.

**Manual check:** run `npm run dev` and open a Draft.
- **B:** hover over a Section heading and click **Copy**, then paste into the Azure DevOps or Jira field.
- **C:** discard a Section and an Entry, then use **Hide 2 discarded** in the toolbar and the Section's
  own **Show 1 discarded** button.
