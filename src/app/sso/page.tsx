'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ExclamationOctagonFill } from 'react-bootstrap-icons'

function SsoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const device = searchParams.get('device')
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!token) {
      Promise.resolve().then(() => {
        setStatus('error')
        setMsg('Token tidak ditemukan. Buka Z1 Pos lewat Z One lagi.')
      })
      return
    }

    fetch('/api/auth/sso-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, device }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          // Pakai absolute URL supaya redirect ke ZPOS sendiri,
          // bukan ke domain Z One yang mungkin masih aktif di browser
          window.location.replace('https://zpos.zomet.my.id' + (d.redirect || '/app'))
        } else {
          setStatus('error')
          setMsg(d.error || 'Login SSO gagal')
        }
      })
      .catch(() => {
        setStatus('error')
        setMsg('Tidak dapat terhubung ke server Z1 Pos')
      })
  }, [token, device, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        {status === 'loading' ? (
          <>
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 text-sm">Menghubungkan akun dari Z One...</p>
          </>
        ) : (
          <>
            <ExclamationOctagonFill className="text-red-500 mx-auto mb-4" size={36} />
            <p className="text-red-600 font-medium mb-2">Gagal Login</p>
            <p className="text-gray-500 text-sm mb-4">{msg}</p>
            <a href="https://zone.zomet.my.id" className="text-blue-600 text-sm underline">
              Kembali ke Z One
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default function SsoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SsoContent />
    </Suspense>
  )
}
