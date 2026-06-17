'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [form, setForm] = useState({ password: '', konfirmasi: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sukses, setSukses] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') ?? '')
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.konfirmasi) {
      setError('Konfirmasi password tidak cocok')
      return
    }
    setLoading(true)
    const res = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: form.password }),
    })
    if (res.ok) {
      setSukses(true)
      setTimeout(() => router.push('/login'), 1800)
    } else {
      const data = await res.json()
      setError(data.error || 'Gagal reset password')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-xl font-bold">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Password Baru</h1>
          <p className="text-gray-400 text-sm mt-1">Buat password baru untuk akun Anda</p>
        </div>

        {sukses ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center space-y-2">
            <p className="text-sm text-green-600 font-medium">Password berhasil diubah!</p>
            <p className="text-sm text-gray-400">Mengarahkan ke halaman masuk...</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Password Baru</label>
              <input
                type="password" required minLength={6}
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                placeholder="Min. 6 karakter"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Konfirmasi Password</label>
              <input
                type="password" required minLength={6}
                value={form.konfirmasi} onChange={e => setForm(f => ({ ...f, konfirmasi: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                placeholder="Ulangi password"
              />
            </div>
            <button
              type="submit" disabled={loading || !token}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {loading ? 'Menyimpan...' : 'Simpan Password'}
            </button>
            {!token && (
              <p className="text-center text-xs text-red-500">Tautan tidak valid. Minta ulang dari <Link href="/forgot" className="underline">Lupa Password</Link>.</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
