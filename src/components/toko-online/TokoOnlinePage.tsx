'use client'

import { useEffect, useState } from 'react'
import { BoxArrowUpRight, Link45deg, Save, Shop, Whatsapp } from 'react-bootstrap-icons'

export default function TokoOnlinePage() {
  const [subdomain, setSubdomain] = useState('')
  const [wa, setWa] = useState('')
  const [aktif, setAktif] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/toko-online')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSubdomain(d.subdomain ?? '')
          setWa(d.wa_toko_online ?? '')
          setAktif(d.toko_online_aktif ?? false)
        }
      })
  }, [])

  const simpan = async () => {
    setLoading(true)
    setPesan(null)
    try {
      const res = await fetch('/api/toko-online', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, toko_online_aktif: aktif, wa_toko_online: wa }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        setPesan({ type: 'ok', text: 'Perubahan disimpan.' })
      } else {
        setPesan({ type: 'err', text: data?.error ?? 'Gagal menyimpan.' })
      }
    } finally {
      setLoading(false)
    }
  }

  const link = subdomain ? `/toko/${subdomain}` : null

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-gray-800 mb-1">Toko Online</h1>
      <p className="text-sm text-gray-500 mb-5">
        Aktifkan katalog online yang bisa dishare ke pelanggan. Orderan masuk via WhatsApp.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {/* Apakah path-slang ini dev OR produksi? Toggle aktif */}
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <div className="flex items-center gap-2 font-medium text-gray-800">
              <Shop size={16} /> Aktifkan Toko Online
            </div>
            <p className="text-xs text-gray-500">Wajib isi subdomain & nomor WhatsApp dulu.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={aktif}
            onClick={() => setAktif((v) => !v)}
            className={`w-12 h-7 rounded-full transition-colors relative ${aktif ? 'bg-emerald-600' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all ${aktif ? 'left-[24px]' : 'left-0.5'}`}
            />
          </button>
        </label>

        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="osub">Subdomain</label>
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
            <input
              id="osub"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="nama-toko"
              className="flex-1 px-3 py-2 focus:outline-none"
            />
            <span className="bg-gray-100 px-3 py-2 text-sm text-gray-500 border-l border-gray-300">
              .zpos.my.id
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Huruf kecil, angka, strip. Contoh: warung-bu-sari</p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 mb-1" htmlFor="owa">Nomor WhatsApp Pesanan</label>
          <div className="flex items-center border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500">
            <span className="px-3 text-gray-400"><Whatsapp size={16} /></span>
            <input
              id="owa"
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              placeholder="08123456789"
              className="flex-1 px-2 py-2 focus:outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Nomor yang menerima pesanan dari katalog online.</p>
        </div>

        {link && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Link45deg className="text-gray-400" />
            <code className="flex-1 text-sm text-gray-600 truncate">{link}</code>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:text-indigo-800"
              aria-label="Buka katalog"
            >
              <BoxArrowUpRight size={18} />
            </a>
          </div>
        )}

        <button
          onClick={simpan}
          disabled={loading}
          className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={18} /> {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>

        {pesan && (
          <p className={`text-sm ${pesan.type === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
            {pesan.text}
          </p>
        )}
      </div>
    </div>
  )
}
