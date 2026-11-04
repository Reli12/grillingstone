# PRD — Backlog Copies and Backlog References

## Problem Statement

When I break a BA's Feature from Azure DevOps into PBIs, I paste the Feature's text into the requirement box of the new-Draft form. Only the first Grilling Session on the Draft (the one that writes v1) ever sees that text. Every later session (a New Iteration, a Template upgrade, a Continuation and especially a Focused Session on one Section or Entry) starts from the current Draft, the Glossary and the Draft's References, so the Feature is gone. When a Focused Session needs to check an Acceptance Criterion against the Feature's business rules, I have to paste the Feature again or let Claude work without it.

It gets worse with several PBIs. One Feature usually becomes PBI A, B and C. I paste the same Feature into each, and when the BA edits the Feature, nothing tells me which of my Drafts were written against the old version.

## Solution

A Project can hold **Backlog Copies**. A Backlog Copy is my pasted copy of one Azure DevOps work item (usually a Feature), identified by its ADO ID. A Draft can hold any number of **Backlog References**, each to one Backlog Copy. Several Drafts can reference the same Copy.

- When I create a Draft, I can pick an existing Backlog Copy or paste a new one (ID or link, title, content). With at least one Backlog Reference attached, the requirement becomes optional. If I leave it empty, the first session asks which part of the Feature this PBI covers.
- The first Grilling Session on the Draft gets every Backlog Copy it references **in full**.
- Later sessions, Focused Sessions included, only get a **listing** of the Draft's Backlog References and where to read them. Claude reads one when it matters, and always before changing anything that cites one of its business rules. When I start a session I can tick **"Include Backlog References in full"** to force full inclusion. I can also just ask in the chat.
- When the BA changes the Feature, I re-paste the Backlog Copy once. Every Draft that references it is flagged as having a changed Backlog Copy. The next session on each such Draft gets the new content in full together with what changed. After that session it goes back to being listed only.
- I can delete a Backlog Copy. The confirmation lists the Drafts that reference it, and confirming removes those references.
- This exists only for Projects whose Tracker is Azure DevOps.

The live Feature in Azure DevOps is never read. The tool has no Azure DevOps connection yet.

## User Stories

### Creating and managing Backlog Copies

1. As a developer, I want to paste an Azure DevOps work item's content into my Project as a Backlog Copy, so that I can reuse it as context for every Draft I derive from it.
2. As a developer, I want to identify a Backlog Copy by its ADO work item ID, so that the same Feature can never exist twice in a Project with different text.
3. As a developer, I want to enter the ID as `1234`, `#1234` or a full Azure DevOps work item URL, so that I can paste whatever I have copied from the browser.
4. As a developer, I want to give the Backlog Copy a title, so that I can recognise it in pickers and so that sessions can name it.
4a. As a developer, I want to paste the work item's Acceptance Criteria into their own optional field next to the description, so that sessions can tell the BA's ACs apart from the rest of the text.
5. As a developer, I want to record the Backlog Copy's Work Item Type (Epic, Feature, PBI, Bug, Task), defaulting to Feature, so that sessions know what kind of item they are reading.
6. As a developer, I want to see all Backlog Copies of my Project in one place, so that I know which ADO items I have already brought in.
7. As a developer, I want to see, for each Backlog Copy, which Drafts reference it, so that I understand what a re-paste or deletion will affect.
8. As a developer, I want to see when a Backlog Copy was last pasted, so that I can judge whether it is likely to be out of date.
9. As a developer, I want to open a Backlog Copy's work item in Azure DevOps from its link, so that I can compare my copy with the live item.
10. As a developer, I want to be offered "re-paste" when I paste a new Backlog Copy whose ID already exists, so that I update the existing Copy instead of failing or duplicating it.
11. As a developer, I want to re-paste a Backlog Copy when the BA changes the item, so that every Draft referencing it works from the new content.
12. As a developer, I want re-pasting identical content to change nothing, so that I don't flag my Drafts for no reason.
13. As a developer, I want to delete a Backlog Copy I no longer need, so that the Project's list stays tidy.
14. As a developer, I want the delete confirmation to list the Drafts that reference the Backlog Copy, so that I know which Drafts lose that context.
15. As a developer, I want confirming a deletion to remove the Backlog References from those Drafts, so that no Draft points to something that no longer exists.
16. As a developer working in a Jira Project, I want not to see Backlog Copies at all, so that the tool doesn't offer something that doesn't belong to my Tracker.

### Referencing from a Draft

17. As a developer creating a PBI, I want to pick one or more existing Backlog Copies in the new-Draft form, so that I can derive the PBI from a Feature I pasted earlier.
18. As a developer creating a PBI, I want to paste a new Backlog Copy directly in the new-Draft form, so that I don't have to leave the form to bring the Feature in.
19. As a developer, I want the requirement to be optional when at least one Backlog Reference is attached, so that I can start from the Feature alone.
20. As a developer, I want the requirement's hint to change to "Which part of the Feature does this PBI cover?" when a Backlog Reference is attached, so that I'm nudged to describe the slice.
21. As a developer, I want the requirement to stay required when no Backlog Reference is attached, so that the first session always has something to start from.
22. As a developer, I want to add or remove Backlog References on an existing Draft, so that I can attach the Feature after the fact or drop one that turned out to be irrelevant.
23. As a developer, I want a Draft to reference several Backlog Copies (e.g. the Feature and a related Bug), so that sessions get every item that matters.
24. As a developer, I want adding or removing a Backlog Reference to affect only later sessions, so that a running session is not changed under me.
25. As a developer, I want Draft References and Backlog References shown side by side but distinguishable, so that I know which context comes from this tool and which from Azure DevOps.

### What sessions see

26. As a developer, I want the first Grilling Session on a Draft to be given every referenced Backlog Copy in full, so that v1 is written from the Feature itself.
27. As a developer whose requirement is empty, I want the first session to open by asking which part of the Feature this Draft covers, so that sibling PBIs don't all try to implement the whole Feature.
28. As a developer, I want later sessions to be told which Backlog Copies the Draft references and where to read them, so that their opening context stays small but the Feature is one read away.
29. As a developer, I want Claude to read a Backlog Copy before changing anything that cites one of its business rules, so that edits to such content are checked against the source.
30. As a developer running a Focused Session, I want to tick "Include Backlog References in full" when starting it, so that I can make sure the Feature is in context for this session.
31. As a developer, I want to ask Claude mid-session to check the Feature, so that I can pull the Backlog Copy in at the moment I need it.
32. As a developer, I want a Continuation to follow the same rules as any later session, so that it also sees a re-pasted Backlog Copy in full.
33. As a developer, I want the session's opening line to say how many Backlog References Claude has and whether in full or listed, so that I know what context it is working with.
34. As a developer, I want sessions to treat a Backlog Copy as context and not as an obligation, so that a PBI covering only part of a Feature is not pushed to cover all of it.

### Changes to a Backlog Copy

35. As a developer, I want every Draft referencing a Backlog Copy to show "Backlog Copy #1234 changed since this Draft's last session" after I re-paste it, so that I know which PBIs may be out of date.
36. As a developer, I want the flag visible in the Project's Draft list too, so that I can see affected Drafts without opening each one.
37. As a developer, I want the next session on a flagged Draft to get the new content in full together with what changed, whatever I chose at session start, so that Claude can't miss the change.
38. As a developer, I want "what changed" computed against the content the re-paste replaced, so that Claude sees exactly the BA's edit.
39. As a developer, I want the flag cleared once a session has started with the new content, so that later sessions go back to listing only.
40. As a developer who re-pastes twice before opening a Draft, I want that Draft's next session to see changes compared with the version its last session saw (or, if that version is no longer kept, the full new content with a note that earlier changes were also made), so that no change is silently skipped.
41. As a developer, I want a re-paste never to start sessions or produce Proposals by itself, so that Drafts I'm not working on are left alone.
42. As a developer, I want a Backlog Copy change to be distinct from Drift, so that the term keeps meaning changes to a Draft's own Linked Work Item.

## Implementation Decisions

### Glossary

- The terms are already in the Project's `CONTEXT.md`: **Backlog Copy** (new), **Backlog Reference** (redefined, no longer "read fresh, never stored"), plus relationships. Code, UI copy and seeds use these names. A Backlog Copy is never called a snapshot, a cached item or an import.

### Modules

1. **Backlog Copy model (core, new, deep).** It owns the Backlog Copy shape and every rule about it, as pure functions:
   - *Parse a work item ID* from `1234`, `#1234` or an Azure DevOps work item URL (`…/_workitems/edit/1234`, with or without an organization or project path). Returns the numeric ID or a validation reason.
   - *Create* a Backlog Copy from ID, title, Work Item Type, content (the description; trimmed, non-empty) and optional Acceptance Criteria (trimmed; empty means none).
   - *Re-paste*: returns the Copy with new content and Acceptance Criteria, what it replaced kept as `previousContent` / `previousAcceptanceCriteria`, and `revision` incremented. When both are identical after trimming, the Copy is unchanged, with the same revision.
   - *What changed*: a line-level comparison of previous and current content, and separately of the Acceptance Criteria, rendered as readable added and removed lines for the seed. The repo has no diff dependency yet; a small in-house line diff (LCS) is enough, since the inputs are short documents.
   - Shape (indicative):
     ```ts
     interface BacklogCopy {
       id: string               // safe id derived from the work item ID, e.g. "ado-1234"
       workItemId: number
       workItemType: string     // Azure DevOps Work Item Type name
       title: string
       url?: string             // as the human pasted it, for "open in Azure DevOps"
       content: string          // the description
       acceptanceCriteria?: string
       previousContent?: string // the content the last re-paste replaced
       previousAcceptanceCriteria?: string
       revision: number         // 1 on create, +1 per re-paste with changed content
       pastedAt: string
     }
     ```

2. **Backlog Reference delivery policy (core, new, deep).** A pure function that decides, for each of a Draft's Backlog References, how the session receives it: `full`, `full-with-changes` or `listed`. Its inputs:
   - whether this is the Draft's first session (v1);
   - the "include in full" choice made at session start;
   - the Copy's current `revision` and the revision this Draft last saw.

   The rules:
   - The first session gets `full`.
   - A Copy whose revision is newer than the revision seen gets `full-with-changes` in every later session kind (New Iteration, Focused, Template upgrade, Continuation).
   - Otherwise a reference is `full` when "include in full" was ticked, and `listed` when it wasn't.
   - `full-with-changes` includes the changes only when the seen revision is exactly one behind; when it is further behind, the change text is replaced by a note that more than one re-paste happened, and the full content still goes in.

   This module is the heart of the feature and changes rarely.

3. **Draft model (core, modified).** A Draft gains `backlogReferences: { copyId: string; seenRevision: number }[]`, kept separate from `references` (the Draft References), because the two hold different things and are delivered differently. A Draft read without the field is treated as having none, so existing data needs no migration. Draft validation is unchanged. A changed-Copy flag is derived (`copy.revision > seenRevision`) and never stored.

4. **Grilling seed (core, modified).** It gains a "Backlog References" block, separate from the existing "References" block. For each reference it renders, according to the delivery policy:
   - `full`: a heading like `Feature #1234: Device archiving`, then the content, then an "Acceptance Criteria" sub-heading with the ACs when there are any.
   - `full-with-changes`: the same, preceded by "Changed since this Draft's last session:" and the changes.
   - `listed`: one line with ID, title and the path of the Copy's readable file relative to the session folder.

   When anything is listed, the block carries the instruction: read a listed Backlog Copy when its intent matters, and always before changing content that cites one of its business rules. The block states that a Backlog Copy is context with no obligation and no hierarchy. When the requirement is empty, the v1 task tells Claude to open by asking which part of the referenced items this Draft covers.

5. **Backlog Copy storage (server, new).** Backlog Copies live in their own folder inside the Project folder. Following the existing Draft pattern, JSON is the source of truth and a readable markdown rendering is regenerated on every save. Because sessions run in the Project folder and may read files there, the markdown file is what a session reads on demand, so no new permission is needed. Writes go through a keyed lock like Drafts. Deleting the Project deletes its Backlog Copies with it.

6. **Backlog Copy service and routes (server, new).**
   - List the Project's Backlog Copies, each with the Drafts referencing it.
   - Create: rejected with a clear reason when the work item ID already exists; the UI turns that into the re-paste offer.
   - Re-paste.
   - Delete: in one locked operation, removes the Copy and the Backlog References to it from every Draft.
   - All routes are refused for a Project whose Tracker is not Azure DevOps.

7. **Draft service and routes (server, modified).**
   - The new-Draft body accepts Backlog References, given as existing Copy IDs and/or Copies to create in the same request. The requirement becomes optional when at least one Backlog Reference is given. The client form schema mirrors this rule.
   - A new route sets an existing Draft's Backlog References. Unknown Copy IDs are dropped, as `setReferences` does for Draft References.
   - A newly added Backlog Reference starts with `seenRevision` equal to the Copy's current revision. It isn't "changed", because nothing changed since it was added. Unless this is the v1 session, it is listed.
   - The Draft summary for lists carries a "Backlog Copy changed" indicator.

8. **Grilling session start (server, modified).**
   - Session start arguments gain `includeBacklogInFull?: boolean`.
   - The session loads the Draft's Backlog Copies (a deleted one is skipped, as with Draft References), applies the delivery policy and builds the seed.
   - Once the session has started, each delivered reference's `seenRevision` is set to the Copy's current revision, inside the Draft's lock. This clears the flag even if the session later ends without a submission. The content was delivered, and that is what the flag tracks.
   - The intro line reports the Backlog References and how they were delivered.

9. **UI (modified and new).**
   - *New-Draft form:* a Backlog Reference picker (search existing Copies by ID or title, or "Paste a new one" with ID/link, Work Item Type, title, description and optional Acceptance Criteria). The requirement field is optional and its hint changes when a Backlog Reference is attached.
   - *References dialog:* a separate Backlog References section to add and remove.
   - *Draft view and Project Draft list:* a "Backlog Copy #1234 changed" badge.
   - *Start-session dialog:* an "Include Backlog References in full" checkbox, shown only when the Draft has Backlog References. When a Copy has changed it shows a note that changed Copies are included in full anyway.
   - *Project:* a **Backlog Copies** tab beside Drafts and Glossary. It lists the Copies (ID, title, type, last pasted, referencing Drafts) and offers paste, re-paste and delete. Delete uses a confirmation listing affected Drafts, following the existing delete-after-confirming pattern.
   - Everything above is hidden for Jira Projects.

### Interactions worth stating

- One Copy, many Drafts: re-pasting once flags every referencing Draft, and each Draft clears its own flag on its next session.
- A Backlog Reference carries no hierarchy. Marking one as the Draft's **Parent** belongs to Publish and is not part of this work (see Out of Scope). The reference shape leaves room to add it.
- The requirement continues to reach only the v1 session. This PRD does not change that; the Backlog Copy is what persists across sessions.

## Testing Decisions

- **What makes a good test:** test external behaviour through each module's public interface: given inputs, assert outputs or the stored and seeded result. Don't test internal helpers, rendering details beyond what Claude or the human sees, or the call order inside a service.
- **Backlog Copy model:** parsing IDs from every accepted form plus rejected inputs; create validation; re-paste keeps the previous content and increments the revision; an identical re-paste is a no-op; "what changed" output for added, removed and edited lines. Prior art: the core unit tests next to the glossary, workItemType and templateValidator modules.
- **Delivery policy:** a table-driven test over first vs later session × include-in-full × seen revision (equal, one behind, several behind), covering every session kind. Prior art: the sessionMachine and continuation tests.
- **Grilling seed:** v1 includes full content; a later session lists only, with path and instruction; a changed Copy includes content and changes; an empty requirement produces the "which part" opening; no Backlog References produces no block. Prior art: the existing grillingSeed tests.
- **Storage and services:** create, duplicate-ID rejection, re-paste, and delete removing references from all Drafts; a Draft without the field reads as having none; Jira Projects are refused; starting a session updates `seenRevision`. Prior art: the storage, draftDeletion and draftService tests.
- **UI components:** the picker (pick existing, paste new); the optional requirement and its hint; the changed badge; the start-session checkbox; the delete confirmation listing Drafts; hidden for Jira. Prior art: the existing component tests, such as projectTabs and the draft dialogs.
- **End to end (one path):** paste a Feature, create two PBIs from it, run v1 on one, re-paste the Feature, see both flagged, start a Focused Session and see the change delivered and the flag cleared. Prior art: the refineWithProposal and draftGoldenPath e2e specs.

## Out of Scope

- Fetching Backlog Copies from Azure DevOps, or refreshing them from the live item. There is no Azure DevOps connection yet.
- Jira Projects. Widening later means revisiting the "Backlog" naming, since **Backlog** means an Azure DevOps project in the glossary.
- Marking a Backlog Reference as the Draft's **Parent**, and anything Publish does with it.
- Changing how Draft References are delivered. They stay inlined in full in every session.
- Changing the requirement's reach beyond the v1 session.
- Keeping a full history of a Backlog Copy's content. Only the content the last re-paste replaced is kept.
- Starting sessions or producing Proposals automatically when a Backlog Copy changes.
- Images or attachments inside a Backlog Copy. It holds text only.

## Further Notes

- **ADR candidate:** "Backlog Copies are pasted and stored per Project rather than fetched live." It is hard to reverse, surprising given the planned Azure DevOps connection, and the result of a real trade-off: live accuracy against working now without auth, with one copy shared by many PBIs. Write it in `plan/adr/` before implementation starts. It should note the expected evolution: once the Azure DevOps connection exists, a "Refresh from Azure DevOps" action can perform the re-paste, keeping the same revision and changed-Copy flow.
- **UI decided by prototype (2026-11-04):** the Project page gets its own **Backlog Copies** tab with a table (variant A). The New Draft form shows Backlog References as chips in the right column, under an "Add Backlog Reference" menu, and pasting a new Copy opens a dialog (variant C). See `src/components/features/backlogCopies/prototype/NOTES.md`.
- Origin: a grill-with-docs session on 2026-11-04. The decisions match the updated `CONTEXT.md`.
