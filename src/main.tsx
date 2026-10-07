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

const queryClient = new QueryClient({
  // Failed actions explain themselves in a toast; components need no try/catch.
  mutationCache: new MutationCache({ onError: (e) => toast.error(e.message) }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (count, e) => !(e instanceof ApiError && e.status < 500) && count < 3,
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
