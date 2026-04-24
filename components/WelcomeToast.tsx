'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function WelcomeToast() {
  const { profile } = useAuth()
  const [visible, setVisible] = useState(false)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!profile || shown) return
    const key = `welcomed_${profile.id}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    setShown(true)
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(t)
  }, [profile, shown])

  if (!visible || !profile) return null

  const firstName = (profile.name ?? profile.email.split('@')[0]).split(' ')[0]

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-gray-900 dark:bg-[#1a1a1a] border border-gray-700 dark:border-[#2a2a2a] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium">
        <span className="text-lg">👋</span>
        <span>Bienvenido, <span className="font-bold">{firstName}</span></span>
      </div>
    </div>
  )
}
