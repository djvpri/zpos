'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, UserPlus, X, LogOut, Store } from 'lucide-react'
import { fmtDate } from '@/lib/utils'

interface Member {
  id: number
  nama: string
  email: string
  plan: string
  aktif: boolean
  created_at: string
  jumlah_user: number
}

export default function AdminPage() {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nama: '', email: '', password: '', plan: 'pro' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/members')
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  const tambah = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const member = await res.json()
      setMembers(m => [member, ...m])
      setShowModal(false)
      setForm({ nama: '', email: '', password: '', plan: 'pro' })
    } else {
      const data = await res.json()
      setError(data.error || 'Gagal mendaftarkan member')
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <span className="font-bold">ZPos Admin</span>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors">
            <LogOut size={15} /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Member</h1>
            <p className="text-sm text-gray-400 mt-0.5">Daftarkan dan kelola toko pelanggan</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Daftarkan Member</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Store size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Belum ada member</p>
            <p className="text-gray-400 text-sm mt-1">Daftarkan toko pertama Anda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <Store size={16} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{m.nama}</div>
                  <div className="text-xs text-gray-400 truncate">{m.email} · {m.jumlah_user} user · {fmtDate(m.created_at)}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                  m.plan === 'pro' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {m.plan === 'pro' ? 'Pro' : 'Trial'}
                </span>
                {!m.aktif && (
                  <span className="text-xs bg-red-50 text-red-500 font-semibold px-2 py-0.5 rounded-full shrink-0">Nonaktif</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Daftarkan Member</h3>
              <button onClick={() => { setShowModal(false); setError('') }} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={tambah} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nama Toko</label>
                <input
                  required
                  value={form.nama}
                  onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                  placeholder="Warung Bu Sari"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email Owner</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                  placeholder="owner@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
                <input
                  type="password" required minLength={6}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                  placeholder="Min. 6 karakter"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Plan</label>
                <select
                  value={form.plan}
                  onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors bg-white"
                >
                  <option value="pro">Pro</option>
                  <option value="trial">Trial</option>
                </select>
              </div>
              <button
                type="submit" disabled={saving}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Menyimpan...' : 'Daftarkan Member'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
