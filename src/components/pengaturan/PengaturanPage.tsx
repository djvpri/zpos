'use client'

import { useState, useEffect } from 'react'
import { Percent, SaveFill, Shop, Telephone, GeoAlt, FileText, Download, Laptop, Android2, Receipt, Printer } from 'react-bootstrap-icons'
import { usePengaturan } from '@/hooks/usePengaturan'
import { DESAIN_NOTA } from '@/lib/desain-nota'
import { NotaPreview } from './NotaPreview'

// Rilis kasir diambil live dari GitHub — versi & link download selalu terbaru.
const KASIR_REPO = 'djvpri/zpos_windows'
// Rilis Z1 Label (Android) — diambil live dari GitHub.
const LABEL_REPO = 'djvpri/z1label-android'

// Driver printer untuk kasir — link Google Drive. Ganti nama saat ada info nama file.
const DRIVER_LINK = [
  { name: 'Driver Printer 1', url: 'https://drive.google.com/file/d/1E7ErLJjo6-eEyjs0srVKoRyHe04G_SQl/view?usp=drive_link' },
  { name: 'Driver Printer 2', url: 'https://drive.google.com/file/d/1YtJmKIyzzZYdtuGQCxv34ZgMD2B8vboG/view?usp=drive_link' },
]

interface KasirAsset {
  name: string
  url: string
}
interface KasirRilis {
  versi: string
  installer: KasirAsset | null
  portable: KasirAsset | null
}
// Rilis Z1 Label — APK tunggal.
interface LabelRilis {
  versi: string
  apk: KasirAsset | null
}

export default function PengaturanPage() {
  const { pajak_persen, alamat, telepon, catatan_struk, desainNota, loading, simpan } = usePengaturan()
  const [form, setForm] = useState({ pajak_persen: 0, alamat: '', telepon: '', catatan_struk: '', desain_nota: 'klasik' })
  const [saving, setSaving] = useState(false)
  const [pesan, setPesan] = useState('')
  const [error, setError] = useState('')

  // Rilis kasir terbaru — load sekali.
  const [kasir, setKasir] = useState<KasirRilis | null>(null)
  const [kasirErr, setKasirErr] = useState('')
  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const r = await fetch(`https://api.github.com/repos/${KASIR_REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ZPos-POS/1.0' },
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json()
        if (batal) return
        const assets: KasirAsset[] = (d.assets || []).map((a: { name: string; browser_download_url: string }) => ({
          name: a.name,
          url: a.browser_download_url,
        }))
        const versi = (d.tag_name || '').replace(/^v/, '')
        setKasir({
          versi,
          installer: assets.find(a => a.name.includes('-setup.exe')) || null,
          portable: assets.find(a => a.name === 'zpos-kasir.exe') || null,
        })
      } catch {
        if (!batal) setKasirErr('Gagal memuat rilis kasir — pastikan koneksi ke GitHub tersedia.')
      }
    })()
    return () => { batal = true }
  }, [])

  // Rilis Z1 Label (Android) terbaru — load sekali.
  const [label, setLabel] = useState<LabelRilis | null>(null)
  const [labelErr, setLabelErr] = useState('')
  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const r = await fetch(`https://api.github.com/repos/${LABEL_REPO}/releases/latest`, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ZPos-POS/1.0' },
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = await r.json()
        if (batal) return
        const assets: KasirAsset[] = (d.assets || []).map((a: { name: string; browser_download_url: string }) => ({
          name: a.name,
          url: a.browser_download_url,
        }))
        setLabel({
          versi: (d.tag_name || '').replace(/^v/, ''),
          apk: assets.find(a => a.name.endsWith('.apk')) || null,
        })
      } catch {
        if (!batal) setLabelErr('Gagal memuat rilis Z1 Label — pastikan koneksi ke GitHub tersedia.')
      }
    })()
    return () => { batal = true }
  }, [])

  useEffect(() => {
    Promise.resolve().then(() => setForm({ pajak_persen, alamat, telepon, catatan_struk, desain_nota: desainNota }))
  }, [pajak_persen, alamat, telepon, catatan_struk, desainNota])

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
              <Shop size={16} className="text-indigo-500" />
              <span className="font-medium text-sm">Info Toko</span>
            </div>
            <p className="text-sm text-gray-400">Ditampilkan di header struk transaksi.</p>

            <div>
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <GeoAlt size={11} /> Alamat
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
                <Telephone size={11} /> Telepon / WhatsApp
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

            <div>
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                <Receipt size={11} /> Desain Nota
              </label>
              <p className="text-[11px] text-gray-400 mt-0.5">Dipakai seragam oleh web &amp; Z1 Kasir.</p>
              <select
                value={form.desain_nota}
                onChange={e => set('desain_nota', e.target.value)}
                className={inputCls}
              >
                {DESAIN_NOTA.map(d => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <NotaPreview desain={form.desain_nota} />

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

          {/* Aplikasi Z1 Label (Android) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Android2 size={16} className="text-emerald-500" />
              <span className="font-medium text-sm">Aplikasi Z1 Label (Android)</span>
            </div>
            <p className="text-sm text-gray-400">
              Download aplikasi <b>Z1 Label</b> untuk cetak label barcode dari HP Android
              via Bluetooth. Versi <b>{label?.versi ?? '…'}</b>.
            </p>

            {labelErr && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{labelErr}</div>}

            {!label && !labelErr && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1].map(i => (
                  <div key={i} className="animate-pulse rounded-2xl border border-gray-100 p-4">
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
                    <div className="h-8 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            )}

            {label && label.apk && (
              <a
                href={label.apk.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-gray-100 p-4 hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Download size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">Z1 Label APK</div>
                  <div className="text-xs text-gray-400 truncate">{label.apk.name} — {label.versi}</div>
                </div>
              </a>
            )}
          </div>

          {/* Aplikasi Kasir (Z1 Kasir) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Laptop size={16} className="text-indigo-500" />
              <span className="font-medium text-sm">Aplikasi Kasir (Z1 Kasir)</span>
            </div>
            <p className="text-sm text-gray-400">
              Download aplikasi kasir desktop <b>Windows</b> versi terbaru. Versi <b>{kasir?.versi ?? '…'}</b>.
            </p>

            {kasirErr && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{kasirErr}</div>}

            {!kasir && !kasirErr && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[0, 1].map(i => (
                  <div key={i} className="animate-pulse rounded-2xl border border-gray-100 p-4">
                    <div className="h-4 bg-gray-100 rounded w-1/2 mb-3" />
                    <div className="h-8 bg-gray-100 rounded" />
                  </div>
                ))}
              </div>
            )}

            {kasir && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {kasir.installer && (
                  <a
                    href={kasir.installer.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <Download size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">Installer</div>
                      <div className="text-xs text-gray-400 truncate">{kasir.installer.name}</div>
                    </div>
                  </a>
                )}
                {kasir.portable && (
                  <a
                    href={kasir.portable.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Download size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">Portable</div>
                      <div className="text-xs text-gray-400 truncate">{kasir.portable.name}</div>
                    </div>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Download Driver Printer */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Printer size={16} className="text-indigo-500" />
              <span className="font-medium text-sm">Download Driver Printer</span>
            </div>
            <p className="text-sm text-gray-400">
              Instal driver berikut pada komputer kasir agar printer label &amp; struk terdeteksi.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DRIVER_LINK.map((d, i) => (
                <a
                  key={d.url}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-gray-100 p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${i % 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    <Download size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{d.name}</div>
                    <div className="text-xs text-gray-400 truncate">Google Drive</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl">{error}</div>}
          {pesan && <div className="bg-green-50 text-green-600 text-sm px-3 py-2.5 rounded-xl">Pengaturan berhasil disimpan</div>}

          <button
            type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            <SaveFill size={15} />
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </form>
      )}
    </div>
  )
}
