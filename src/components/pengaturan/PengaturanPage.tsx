'use client'

import { useState, useEffect } from 'react'
import { Percent, Save, Store, Phone, MapPin, FileText } from 'lucide-react'
import { usePengaturan } from '@/hooks/usePengaturan'

export default function PengaturanPage() {
  const { pajak_persen, alamat, telepon, catatan_struk, loading, simpan } = usePengaturan()
  const [form, setForm] = useState({ pajak_persen: 0, alamat: '', telepon: '', catatan_struk: '' })
  const [saving, setSaving] = useState(false)
  const [pesan, setPesan] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setForm({ pajak_persen, alamat, telepon, catatan_struk })
  }, [pajak_persen, alamat, telepon, catatan_struk])

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setPesan('')
    setError('')
    const { error } = await simpan(form)
    if (error) setError(error)
    else setPesan('Tersimpan')
    setSaving(false)
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors mt-1"

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Pengaturan</h2>
        <p className="text-sm text-gray-400 mt-0.5">Atur preferensi dan info toko Anda</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Memuat...</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">

          {/* Info Toko */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-gray-800 mb-1">
              <Store size={16} className="text-indigo-500" />
              <span className="font-medium text-sm">Info Toko</span>
            </div>
            <p className="text-sm text-gray-400">Ditampilkan di header struk transaksi.</p>

            <div>
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <MapPin size={11} /> Alamat
              </label>
              <textarea
                rows={2}
                value={form.alamat}
                onChange={e => set('alamat', e.target.value)}
                placeholder="Jl. Contoh No. 1, Kota..."
                className={`${inputCls} resize-none`}
                maxLength={200}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <Phone size={11} /> Telepon / WhatsApp
              </label>
              <input
                type="tel"
                value={form.telepon}
                onChange={e => set('telepon', e.target.value)}
                placeholder="0812-xxxx-xxxx"
                className={inputCls}
                maxLength={20}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <FileText size={11} /> Catatan Struk
              </label>
              <input
                value={form.catatan_struk}
                onChange={e => set('catatan_struk', e.target.value)}
                placeholder="Barang yang dibeli tidak dapat ditukar"
                className={inputCls}
                maxLength={100}
              />
            </div>
          </div>

          {/* Pajak */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Percent size={16} className="text-indigo-500" />
              <span className="font-medium text-sm">Pajak Penjualan</span>
            </div>
            <p className="text-sm text-gray-400">
              Persentase pajak yang ditambahkan ke tiap transaksi. Isi <b>0</b> untuk menonaktifkan.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={100} step={1}
                value={form.pajak_persen}
                onChange={e => set('pajak_persen', Number(e.target.value))}
                className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>}
          {pesan && <div className="bg-green-50 text-green-600 text-sm px-3 py-2.5 rounded-xl">Pengaturan berhasil disimpan</div>}

          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </form>
      )}
    </div>
  )
}
