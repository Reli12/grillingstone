// "How it works": one page that walks through working with the tool, in the order you meet it.
// The examples are the real components with sample content, so the page matches what you will see.
import { Lock } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { Change } from '#core/proposal/proposalTypes.ts'
import { Tag } from '@/components/atoms/tag/tag'
import { ExampleFrame } from '@/components/composite/exampleFrame/exampleFrame'
import { NumberedStep } from '@/components/composite/numberedStep/numberedStep'
import { QuestionCard } from '@/components/features/chat/questionCard/questionCard'
import { ChangeCard } from '@/components/features/draft/changeCard/changeCard'
import { Gutter } from '@/components/features/draft/gutter/gutter'
import { GutterLegend } from '@/components/features/draft/gutterLegend/gutterLegend'
import { routesPaths } from '@/routes/routes'

const STEPS = [
  { id: 'project', title: 'Create a Project' },
  { id: 'start', title: 'Start a Draft' },
  { id: 'grill', title: 'Get grilled' },
  { id: 'draft', title: 'Shape the Draft' },
  { id: 'refine', title: 'Refine with Proposals' },
  { id: 'publish', title: 'Copy into Azure DevOps' },
  { id: 'templates', title: 'Make it your team’s' },
] as const

const exampleOnly = () => toast('Example only — in a real session this goes to Claude.')

const cleanExample: Change = {
  id: 'ex-clean',
  kind: 'replaceEntry',
  label: 'Scope · add the invoice list',
  before: 'In scope\nExport a single invoice as PDF from the invoice detail page',
  after: 'In scope\nExport a single invoice as PDF from the invoice detail page or the invoice list',
  conflict: false,
  status: 'pending',
}

const conflictExample: Change = {
  id: 'ex-conflict',
  kind: 'replaceEntry',
  label: 'AC02 · cover the list page',
  before: 'Given a Member opens an invoice\nThen the Export PDF action is hidden',
  after: 'Given a Member views one or more invoices\nWhen the invoice list or detail page is shown\nThen no export action is available',
  conflict: true,
  conflictReason: 'You hand-edited this',
  status: 'pending',
}

export default function GuidePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-12 px-4 py-12 lg:grid-cols-[200px_1fr]">
        <nav className="hidden lg:block" aria-label="Steps">
          <ol className="sticky top-8 space-y-1.5 text-sm">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-2.5 rounded px-2 py-1 text-ink-soft hover:bg-fog-deep hover:text-ink">
                  <span className="w-3 text-ink-faint tabular-nums">{i + 1}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-[680px]">
          <header className="mb-12">
            <h1 className="font-serif text-[36px] leading-tight font-semibold tracking-tight">How it works</h1>
            <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">
              You describe a requirement or a bug you saw; Claude interrogates it one question at a time until it is clear, then writes it as an Epic, Feature, PBI, Task or Bug in your Template. You edit the result
              like a document, ask Claude to rework any part, and copy it into Azure DevOps. Claude writes the copy — you stay the editor.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              <strong className="text-ink">Why “Whetstone”?</strong> A whetstone doesn’t cut anything itself; you sharpen your own blade against it. Here the blade is your
              requirement and Claude’s questions are the stone. The edge you end up with is yours.
            </p>
          </header>

          <div className="space-y-12">
            <NumberedStep n={1} id="project" title={STEPS[0].title}>
              <p>
                A <strong>Project</strong> is one product or body of work — say, “Customer Portal”. It keeps its Drafts together and owns one <strong>Glossary</strong>: the domain terms
                you and Claude settle while grilling, like what exactly an “Invoice” or an “Account Admin” is.
              </p>
              <p>
                Every session in the Project is challenged against that Glossary, so a term decided in an Epic is known when you grill its PBIs. You can read and edit it on the Project
                page and beside any Draft.
              </p>
              <p>
                When you create a Project you choose how its Glossary starts: <strong>empty</strong>, <strong>from text you have</strong> (paste or upload any glossary), or{' '}
                <strong>as a copy of another Project’s</strong>. A copy is taken once; after that the two Glossaries change independently.{' '}
                <Link to={routesPaths.home} className="text-claude underline">
                  Go to Projects
                </Link>
              </p>
            </NumberedStep>

            <NumberedStep n={2} id="start" title={STEPS[1].title}>
              <p>
                Press <strong>New Draft</strong>, pick the <strong>Work Item Type</strong> (Epic, Feature, PBI, Task or Bug) and a <strong>Template</strong> — the Default one is preselected —
                then describe the requirement in your own words. A sentence is enough; paste the BA’s Feature text or business rules if you have them.
              </p>
              <p>
                Optionally tick <strong>References</strong>: other Drafts in the Project Claude may read as context, such as the Feature a PBI implements. They add context, not
                hierarchy.
              </p>
            </NumberedStep>

            <NumberedStep n={3} id="grill" title={STEPS[2].title}>
              <p>
                Until the first Draft exists the screen is one conversation. Claude asks <strong>one question at a time</strong>, and every question carries its recommended answer.
                Take the recommendation, pick an option, or answer in your own words.
              </p>
              <ExampleFrame caption="A question card. Try it — the answers here don’t go anywhere.">
                <QuestionCard
                  q={{
                    type: 'question',
                    question: 'Who may export an invoice as PDF?',
                    recommended: 'Account Admins only; Members can view but not export',
                    options: ['Everyone who can view it', 'Account Admins only'],
                  }}
                  canAnswer
                  onAnswer={exampleOnly}
                />
              </ExampleFrame>
              <p>
                When Claude thinks it knows enough it runs a <strong>Ready Check</strong>: “anything to add before I write it?”. Nothing is written until you confirm. You can also cut
                grilling short at any moment with <strong>Enough — write it</strong>; open points then land in Open Questions / Risks with Claude’s proposed default.
              </p>
              <p>
                Claude then writes <strong>v1</strong>. The tool checks it against the Template — every Section present, Locked Sections filled, empty ones saying “N/A — reason” — and
                refuses anything malformed, so what reaches you is always complete.
              </p>
              <p>
                <strong>Stop</strong> ends a session without writing anything. You can pick it up again later (see Continue in step 5).
              </p>
            </NumberedStep>

            <NumberedStep n={4} id="draft" title={STEPS[3].title}>
              <p>
                From v1 on, the conversation sits on the left and the live Draft on the right. The Draft is yours to edit: <strong>click any text</strong> to change it,{' '}
                <strong>drag</strong> Sections and Entries into a new order, <strong>Discard</strong> what doesn’t belong (it stays restorable and is never copied out).
              </p>
              <p>
                Sections marked <Lock size={13} className="inline -translate-y-px" aria-label="Locked" /> are <strong>Locked</strong> — for a PBI, User Story and Acceptance Criteria.
                You can edit and move them but never discard them. The small tag beside each heading, like <Tag tone="claude">Acceptance Criteria</Tag>, says which Azure DevOps
                field the Section goes into.
              </p>
              <p>
                The margin beside every Section and Entry shows who wrote it. That is not decoration: it decides what happens when Claude later proposes changes.
              </p>
              <ExampleFrame caption="The ownership margin: Claude’s text keeps a thin line; anything you edit gets a highlighter stroke; an arrow means you moved it.">
                <div className="space-y-3">
                  {[
                    { edited: false, moved: false, text: 'Given an Account Admin views an invoice — written by Claude' },
                    { edited: true, moved: false, text: 'Given a Member opens an invoice — edited by you' },
                    { edited: false, moved: true, text: 'Acceptance Criteria — moved by you' },
                  ].map((r) => (
                    <div key={r.text} className="flex min-h-9 gap-2">
                      <Gutter size="entry" edited={r.edited} moved={r.moved} />
                      <p className="font-serif text-ink">{r.text}</p>
                    </div>
                  ))}
                  <div className="pt-2">
                    <GutterLegend />
                  </div>
                </div>
              </ExampleFrame>
            </NumberedStep>

            <NumberedStep n={5} id="refine" title={STEPS[4].title}>
              <p>
                To rework one part, hover it and press <strong>Grill this</strong> — a <strong>Focused Session</strong> on just that Section or Entry. To re-grill the whole Draft (say,
                the BA revised the Feature), type in the message box on the left; that starts a <strong>New Iteration</strong>. Every session gets the current Draft and the Glossary.
              </p>
              <p>
                To pick up an earlier conversation instead — one you stopped, or one where a new fact turned up afterwards — press <strong>Continue</strong> on that session.
                Claude remembers everything it asked there, but the current Draft still counts over anything said earlier.
              </p>
              <p>
                After v1, Claude never rewrites the Draft. It returns a <strong>Proposal</strong>, shown inline where each change would land:
              </p>
              <ExampleFrame caption="A Clean Change touches only what Claude wrote and you never touched — accept these in one go with “Accept all clean”.">
                <ChangeCard change={cleanExample} busy={false} onDecide={exampleOnly} />
              </ExampleFrame>
              <ExampleFrame caption="A Conflict touches something you edited, moved or discarded — your version stands beside Claude’s, and you decide each one.">
                <ChangeCard change={conflictExample} busy={false} onDecide={exampleOnly} />
              </ExampleFrame>
              <p>
                When nothing is left to decide, the Draft becomes the next version and the <strong>Iteration Log</strong> gains a line. Rejected changes leave the Draft untouched.
              </p>
            </NumberedStep>

            <NumberedStep n={6} id="publish" title={STEPS[5].title}>
              <p>
                Press <strong>Copy for Azure DevOps</strong>. Each field — Title, Description, Acceptance Criteria — has its own copy button and pastes as formatted text into the
                matching box on the work item. Discarded content is left out and your order is kept. (Publishing straight to Azure DevOps is planned for a later version.)
              </p>
            </NumberedStep>

            <NumberedStep n={7} id="templates" title={STEPS[6].title}>
              <p>
                A <strong>Template</strong> decides which Sections a Draft must have and holds the writing method Claude follows. The Default Templates are read-only; to change one,{' '}
                <strong>Duplicate</strong> it and edit your copy. Edits only affect new Drafts — existing ones get an <strong>Upgrade this Draft</strong> offer, which arrives as a
                Proposal.
              </p>
              <p>
                <strong>New Template</strong> offers two ways: <strong>Build it myself</strong>, or <strong>Grill it with Claude</strong> — a Template Session that interviews you
                about how your team writes this kind of work item and writes the Sections and method for you. Share Templates with colleagues through <strong>Export</strong> and{' '}
                <strong>Import bundle</strong>; an import never deletes anything.{' '}
                <Link to={routesPaths.templates} className="text-claude underline">
                  Go to Templates
                </Link>
              </p>
            </NumberedStep>
          </div>

          <aside className="mt-14 rounded-lg border border-line bg-sheet p-5 text-sm leading-relaxed text-ink-soft">
            <h2 className="font-semibold text-ink">Good to know</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Claude runs as Claude Code on your own subscription — no API key. Pick the model in Settings.</li>
              <li>A session may only read its Project’s folder, edit the Glossary and decision notes, search the web, and submit through the tool. It can’t touch anything else.</li>
              <li>
                Drafts, Glossaries and Transcripts are stored in the tool’s own <code className="rounded bg-fog px-1">data/</code> folder. A running session survives a page
                reload. Claude Code keeps its own copy of each grilling conversation (under <code className="rounded bg-fog px-1">~/.claude/projects</code>) so it can be
                continued.
              </li>
            </ul>
          </aside>
        </article>
      </div>
    </div>
  )
}
