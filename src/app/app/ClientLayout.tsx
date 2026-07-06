'use client'

import { AuthContext, useAuthProvider } from '@/hooks/useAuth'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuthProvider()
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}
