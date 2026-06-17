'use client'

import { useState, useEffect } from 'react'
import { Percent, Save } from 'lucide-react'
import { usePengaturan } from '@/hooks/usePengaturan'

export default function PengaturanPage() {
  const { pajakPersen, loading, simpan } = usePengaturan()
  const [nilai, setNilai] = useState(0)
  const [saving, setSaving] = useState(false)
  const [pesan, setPesan] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { setNilai(pajakPersen) }, [pajakPersen])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setPesan('')
    setError('')
    const { error } = await simpan(nilai)
    if (error) setError(error)
    else setPesan('Tersimpan')
    setSaving(false)
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Pengaturan</h2>
        <p className="text-sm text-gray-400 mt-0.5">Atur preferensi toko Anda</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 text-gray-800">
            <Percent size={16} className="text-indigo-500" />
            <span className="font-medium text-sm">Pajak Penjualan</span>
          </div>
          <p className="text-sm text-gray-400">
            Persentase pajak yang ditambahkan ke tiap transaksi. Isi <b>0</b> untuk
            menonaktifkan (tidak ada pajak di struk).
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={100} step={1}
              value={nilai}
              onChange={e => setNilai(Number(e.target.value))}
              className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>}
          {pesan && <div className="bg-green-50 text-green-600 text-sm px-3 py-2.5 rounded-xl">{pesan}</div>}

          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}
    </div>
  )
}
