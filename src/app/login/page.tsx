'use client'
import { useEffect } from 'react'

// Login sekarang sepenuhnya lewat Z One (SSO).
// Halaman ini langsung redirect ke Z One, user akan balik ke /sso setelah login.
export default function LoginPage() {
  useEffect(() => {
    const returnUrl = encodeURIComponent(window.location.origin + '/sso')
    window.location.replace(`https://zone.zomet.my.id/login?callbackUrl=${returnUrl}`)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Mengarahkan ke Z One...</p>
      </div>
    </div>
  )
}
