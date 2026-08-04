'use client'

import { useState, useEffect } from 'react'
import { XLg, Trash3, Shield, Key } from 'react-bootstrap-icons'
import { Staff } from '@/types'

// Kelola kasir & admin satu toko. User TIDAK dibuat di sini — akun dibuat
// lewat Z One (/manage, control panel ekosistem), lalu diatur hak & statusnya
// dari halaman ini (atau dari Z One, dua-duanya tercatat di tabel user ZPos).
export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/staff')
    if (res.ok) setStaff(await res.json())
    setLoading(false)
  }

  useEffect(() => { Promise.resolve().then(() => load()) }, [])

  const ubahRole = async (u: Staff) => {
    const next = u.role === 'admin' ? 'kasir' : 'admin'
    if (!confirm(`Ubah role ${u.nama} menjadi ${next === 'admin' ? 'Admin' : 'Kasir'}?`)) return
    const res = await fetch(`/api/staff/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: next }),
    })
    if (res.ok) {
      setStaff(s => s.map(x => x.id === u.id ? { ...x, role: next } : x))
    } else {
      const d = await res.json()
      setError(d.error || 'Gagal ubah role')
    }
  }

  const toggleAktif = async (u: Staff) => {
    const next = !u.aktif
    if (!confirm(next ? `Aktifkan lagi ${u.nama}?` : `Nonaktifkan ${u.nama}? User tidak bisa login, tapi histori transaksi aman.`)) return
    const res = await fetch(`/api/staff/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktif: next }),
    })
    if (res.ok) {
      setStaff(s => s.map(x => x.id === u.id ? { ...x, aktif: next } : x))
    } else {
      const d = await res.json()
      setError(d.error || 'Gagal ubah status')
    }
  }

  const hapus = async (u: Staff) => {
    if (!confirm(`Nonaktifkan ${u.nama}?`)) return
    await fetch(`/api/staff/${u.id}`, { method: 'DELETE' })
    setStaff(s => s.map(x => x.id === u.id ? { ...x, aktif: false } : x))
  }

  // Set/reset password utk login web & setup app kasir (user yg login via
  // Google tak punya password lokal — admin set di sini biar bisa setup app).
  const setPassword = async (u: Staff) => {
    const pw = prompt(`Set password baru utk ${u.nama} (min 6 karakter).\nDipakai login web & setup app kasir.`)
    if (!pw) return
    if (pw.length < 6) { setError('Password minimal 6 karakter'); return }
    if (!confirm(`Terapkan password utk ${u.nama}?`)) return
    const res = await fetch(`/api/staff/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    })
    if (res.ok) {
      setError('')
    } else {
      const d = await res.json()
      setError(d.error || 'Gagal set password')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Kelola Kasir</h2>
          <p className="text-sm text-gray-400 mt-0.5">Atur role & status akun. Buat akun baru lewat Z One.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 mb-4">
          <span className="text-sm text-red-600">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><XLg size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Shield size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">Belum ada akun</p>
          <p className="text-gray-400 text-sm mt-1">Buat akun kasir/admin lewat Z One</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(u => (
            <div key={u.id} className={`flex items-center gap-3 bg-white rounded-2xl border border-gray-100 px-4 py-3.5 ${!u.aktif ? 'opacity-50' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${u.role === 'admin' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                <span className={`text-sm font-bold ${u.role === 'admin' ? 'text-amber-600' : 'text-indigo-600'}`}>{u.nama[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{u.nama}</div>
                <div className="text-xs text-gray-400 truncate">{u.email}{!u.aktif && ' · nonaktif'}</div>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${u.role === 'admin' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                {u.role === 'admin' ? 'Admin' : 'Kasir'}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setPassword(u)}
                  title="Set/reset password (login web & setup app kasir)"
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Key size={15} />
                </button>
                <button
                  onClick={() => ubahRole(u)}
                  title={u.role === 'admin' ? 'Turunkan jadi Kasir' : 'Jadikan Admin'}
                  className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                >
                  <Shield size={15} />
                </button>
                <button
                  onClick={() => toggleAktif(u)}
                  title={u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${u.aktif ? 'text-gray-400 hover:text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                >
                  {u.aktif ? 'Nonaktif' : 'Aktifkan'}
                </button>
                <button onClick={() => hapus(u)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash3 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
