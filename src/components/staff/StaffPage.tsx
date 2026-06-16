'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Trash2, X } from 'lucide-react'
import { Staff } from '@/types'

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nama: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/staff')
    if (res.ok) setStaff(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const hapus = async (id: number) => {
    if (!confirm('Hapus kasir ini?')) return
    await fetch(`/api/staff/${id}`, { method: 'DELETE' })
    setStaff(s => s.filter(u => u.id !== id))
  }

  const tambah = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const user = await res.json()
      setStaff(s => [...s, user])
      setShowModal(false)
      setForm({ nama: '', email: '', password: '' })
    } else {
      const data = await res.json()
      setError(data.error || 'Gagal menambah kasir')
    }
    setSaving(false)
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Kelola Kasir</h2>
          <p className="text-sm text-gray-400 mt-0.5">Tambah dan kelola akun kasir toko Anda</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <UserPlus size={16} />
          <span className="hidden sm:inline">Tambah Kasir</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <UserPlus size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">Belum ada kasir</p>
          <p className="text-gray-400 text-sm mt-1">Tambah akun kasir untuk staff toko Anda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
              <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <span className="text-indigo-600 text-sm font-bold">{s.nama[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{s.nama}</div>
                <div className="text-xs text-gray-400 truncate">{s.email}</div>
              </div>
              <span className="text-xs bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full shrink-0">
                Kasir
              </span>
              <button
                onClick={() => hapus(s.id)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Tambah Kasir</h3>
              <button onClick={() => { setShowModal(false); setError('') }} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={tambah} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nama</label>
                <input
                  required
                  value={form.nama}
                  onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                  placeholder="Nama kasir"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                  placeholder="kasir@email.com"
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
              <button
                type="submit" disabled={saving}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Menyimpan...' : 'Tambah Kasir'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
