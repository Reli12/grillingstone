// The app's entry point: the React Query client and the providers around the router.
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ApiError } from '@/api/apiError'
import { ServerEventsProvider } from '@/context/ServerEvents/ServerEvents'
import { ThemeProvider } from '@/context/Theme/Theme'
import { router } from '@/routes/routes'

/** Network failures and 5xx get this many attempts in total. */
const MAX_QUERY_ATTEMPTS = 3

const queryClient = new QueryClient({
  // Failed actions explain themselves in a toast; components need no try/catch.
  mutationCache: new MutationCache({ onError: (error) => toast.error(error.message) }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // A 4xx from the local backend won't change on retry; only network failures and 5xx are retried (ADR-0011).
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < MAX_QUERY_ATTEMPTS,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ServerEventsProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </ServerEventsProvider>
    </QueryClientProvider>
  </StrictMode>,
)
