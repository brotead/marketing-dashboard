'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'

const NO_SHELL_PATHS = ['/login', '/auth']
const NAV_ROUTES = ['/dashboard', '/cashflow', '/rendimiento', '/audit', '/onboarding']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const noShell  = NO_SHELL_PATHS.some(p => pathname.startsWith(p))

  // Prefetch all nav routes on mount so navigation is instant
  useEffect(() => {
    NAV_ROUTES.forEach(r => router.prefetch(r))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (noShell) {
    return <>{children}</>
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="lg:hidden h-14 shrink-0" />
          <div className="px-6 sm:px-8 xl:px-10 py-8">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
