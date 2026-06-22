'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      router.push('/app')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error || 'Login gagal')
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
          <h1 className="text-2xl font-bold text-gray-900">ZPos</h1>
          <p className="text-gray-400 text-sm mt-1">Masuk ke akun toko Anda</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {error && (
            <div data-testid="login-error" className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
            <input
              data-testid="email-input"
              type="email" required
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
              placeholder="toko@email.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
            <input
              data-testid="password-input"
              type="password" required
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
              placeholder="••••••••"
            />
          </div>
          <button
            data-testid="login-submit"
            type="submit" disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
          <p className="text-center">
            <Link href="/forgot" className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">Lupa password?</Link>
          </p>
        </form>

        <p className="text-center text-sm text-gray-400 mt-4">
          Belum punya akun?{' '}
          <Link href="/register" className="text-indigo-600 font-medium hover:underline">Daftar sekarang</Link>
        </p>
      </div>
    </div>
  )
}
