/** The app's logotype: a sheet with a margin rule and text lines. */
export function Wordmark() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-ink">
      <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden>
        <rect x="1" y="1" width="18" height="20" rx="2" fill="#fff" stroke="currentColor" strokeWidth="1.6" />
        <rect x="1.8" y="1.8" width="4" height="18.4" fill="var(--color-mark)" />
        <path d="M8.5 7h7M8.5 11h7M8.5 15h4.5" stroke="var(--color-claude)" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      Grilling Stone
    </span>
  )
}
