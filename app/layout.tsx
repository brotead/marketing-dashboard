import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Marketing Dashboard',
  description: 'Panel de control de campañas publicitarias',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — runs before React hydration */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}())` }} />
      </head>
      <body className={`${inter.className} bg-slate-50 dark:bg-[#0f0f0f] text-gray-900 dark:text-gray-100`}>
        <ThemeProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-y-auto">
              <div className="lg:hidden h-14 shrink-0" />
              <div className="px-6 sm:px-8 xl:px-10 py-8">
                {children}
              </div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
