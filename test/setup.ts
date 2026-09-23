import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@test/mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  localStorage.clear()
})
afterAll(() => server.close())

// jsdom has no modal <dialog>: open/close by toggling the attribute and firing `close` like a browser.
HTMLDialogElement.prototype.showModal = function () {
  this.open = true
}
HTMLDialogElement.prototype.close = function () {
  if (!this.open) return
  this.open = false
  this.dispatchEvent(new Event('close'))
}

// jsdom has no matchMedia; Sonner reads it to follow the system theme.
window.matchMedia ??= (query: string) =>
  ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as MediaQueryList
