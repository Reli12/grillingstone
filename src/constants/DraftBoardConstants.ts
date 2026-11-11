// The Project board (ADR-0019): its Lanes as columns, the date windows the filter offers, and its smallest height.
import type { DraftLane } from '#core/draft/draftLane.ts'

export const LANE_COLUMNS: { lane: DraftLane; label: string; accent: string }[] = [
  { lane: 'grilling', label: 'Grilling', accent: 'border-t-mark-ink' },
  { lane: 'needs', label: 'Needs you', accent: 'border-t-redpencil' },
  { lane: 'review', label: 'In review', accent: 'border-t-claude' },
  { lane: 'ready', label: 'Ready to publish', accent: 'border-t-proof' },
]

/** "Updated in the last n days"; 0 is any time. */
export const UPDATED_WINDOWS = [7, 30, 0] as const
export type UpdatedWindow = (typeof UPDATED_WINDOWS)[number]
/** The board opens on the last week, so a long-lived Project still shows what is current. */
export const DEFAULT_UPDATED_WINDOW: UpdatedWindow = 7

/**
 * The board takes the height left below the Project header, so its columns scroll instead of the page. Below this
 * the window is too short for a useful board, and the page scrolls instead.
 */
export const DRAFT_BOARD_MIN_HEIGHT = 'min-h-[420px]'

/** The drop target that Archives a Draft. */
export const ARCHIVE_DROP_ID = 'archive'
