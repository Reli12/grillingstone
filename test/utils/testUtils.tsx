// render() with the app's providers: a fresh React Query client per test (no retries) and an
// in-memory router. The websocket provider is left out — tests drive the cache directly.
import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, renderHook as rtlRenderHook, type RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'

interface Options extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL; with `path` the element is mounted on that route pattern so useParams works. */
  route?: string
  path?: string
  queryClient?: QueryClient
}

export const createTestQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })

function wrapperFor({ route = '/', path, queryClient = createTestQueryClient() }: Options) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          {path ? (
            <Routes>
              <Route path={path} element={children} />
              <Route path="*" element={<div data-testid="navigated" />} />
            </Routes>
          ) : (
            children
          )}
        </MemoryRouter>
        <Toaster />
      </QueryClientProvider>
    )
  }
}

export function render(ui: ReactElement, { route, path, queryClient = createTestQueryClient(), ...rest }: Options = {}) {
  return { user: userEvent.setup(), queryClient, ...rtlRender(ui, { wrapper: wrapperFor({ route, path, queryClient }), ...rest }) }
}

export function renderHook<R>(hook: () => R, { route, path, queryClient = createTestQueryClient() }: Options = {}) {
  return { queryClient, ...rtlRenderHook(hook, { wrapper: wrapperFor({ route, path, queryClient }) }) }
}
