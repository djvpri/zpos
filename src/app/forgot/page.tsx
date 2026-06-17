'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [terkirim, setTerkirim] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setTerkirim(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl font-bold">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Lupa Password</h1>
          <p className="text-gray-400 text-sm mt-1">Kami kirim tautan reset ke email Anda</p>
        </div>

        {terkirim ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-3">
            <p className="text-sm text-gray-600">
              Jika email tersebut terdaftar, kami sudah mengirim tautan reset password. Cek inbox
              (dan folder spam). Tautan berlaku 1 jam.
            </p>
            <Link href="/login" className="inline-block text-indigo-600 font-medium text-sm hover:underline">
              Kembali ke Masuk
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                placeholder="email@anda.com"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
            </button>
            <p className="text-center text-sm text-gray-400">
              <Link href="/login" className="text-indigo-600 font-medium hover:underline">Kembali ke Masuk</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
