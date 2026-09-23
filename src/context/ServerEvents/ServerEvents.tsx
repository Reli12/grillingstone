// One websocket to the backend. Server events are folded into the React Query cache, so a reload
// (or a second tab) always shows the live session and the current Draft.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { applyServerEvent } from '@/api/serverEvents'
import { connectServerSocket } from '@/api/serverSocket'

type Connection = 'connecting' | 'open' | 'closed'
const ConnectionContext = createContext<Connection>('connecting')

export const useBackendConnection = () => useContext(ConnectionContext)

interface ServerEventsProviderProps {
  children: ReactNode
}

export function ServerEventsProvider({ children }: ServerEventsProviderProps) {
  const qc = useQueryClient()
  const [connection, setConnection] = useState<Connection>('connecting')

  useEffect(
    () =>
      connectServerSocket({
        onOpen: (reconnected) => {
          // Anything could have happened while we were away; refetch what is on screen.
          if (reconnected) qc.invalidateQueries()
          setConnection('open')
        },
        onEvent: (e) => applyServerEvent(qc, e),
        onClose: () => setConnection('closed'),
      }),
    [qc],
  )

  return <ConnectionContext.Provider value={connection}>{children}</ConnectionContext.Provider>
}
