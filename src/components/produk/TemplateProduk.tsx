'use client'

import { useState } from 'react'
import { XLg, LayoutTextWindow, CheckCircleFill, ArrowRepeat } from 'react-bootstrap-icons'
import { PRODUK_TEMPLATES } from '@/lib/produk-templates'

interface Props {
  onSelesai: () => void
  onTutup: () => void
}

export default function TemplateProduk({ onSelesai, onTutup }: Props) {
  const [terpilih, setTerpilih] = useState<string | null>(null)
  const [step, setStep] = useState<'pilih' | 'konfirmasi' | 'proses' | 'selesai'>('pilih')
  const [hasil, setHasil] = useState<{ berhasil: number; diupdate: number; gagal: number; errors: { baris: number; pesan: string }[] } | null>(null)

  const template = PRODUK_TEMPLATES.find(t => t.id === terpilih) || null

  async function terapkan() {
    if (!template) return
    setStep('proses')
    try {
      const res = await fetch('/api/produk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produk: template.produk }),
      })
      const data = await res.json()
      setHasil({ berhasil: data.berhasil ?? 0, diupdate: data.diupdate ?? 0, gagal: data.gagal ?? 0, errors: data.errors ?? [] })
      setStep('selesai')
      if (data.berhasil > 0) onSelesai()
    } catch {
      setHasil({ berhasil: 0, diupdate: 0, gagal: template.produk.length, errors: [{ baris: 0, pesan: 'Gagal terhubung ke server. Coba lagi.' }] })
      setStep('selesai')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <LayoutTextWindow size={18} className="text-purple-600" />
            <span className="font-semibold text-gray-800">Template Produk</span>
          </div>
          <button onClick={onTutup} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 'pilih' && (
            <div>
              <p className="text-sm text-gray-600 mb-3">Pilih preset produk siap-pakai. Kategori dibuat otomatis. Harga bisa diubah sesudahnya.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PRODUK_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTerpilih(t.id)}
                    className={`text-left rounded-2xl border p-4 transition-colors ${terpilih === t.id ? 'border-purple-400 bg-purple-50' : 'border-gray-200 hover:border-purple-200'}`}
                  >
                    <div className="text-2xl mb-2">{t.emoji}</div>
                    <div className="font-semibold text-gray-800">{t.nama}</div>
                    <div className="text-xs text-gray-500">{t.deskripsi}</div>
                    <div className="text-[11px] text-purple-600 mt-2">{t.produk.length} produk</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'konfirmasi' && template && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{template.emoji}</span>
                <span className="font-semibold text-gray-800">{template.nama}</span>
                <span className="text-xs text-gray-400">{template.produk.length} produk</span>
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-medium text-gray-500 uppercase border-b">
                  <span className="col-span-2">Nama</span><span>Harga</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {template.produk.map((p, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 px-3 py-1.5 text-xs text-gray-700">
                      <span className="col-span-2 truncate">{p.nama}</span>
                      <span>Rp {p.harga.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                💡 Produk yang <b>sama namanya</b> dengan yang sudah ada akan di-update (harga/stok), bukan duplikat (via barcode/nama).
              </p>
            </div>
          )}

          {step === 'proses' && (
            <div className="py-10 text-center">
              <ArrowRepeat size={40} className="mx-auto mb-3 text-purple-500 animate-spin" />
              <p className="text-sm font-medium text-gray-700">Menerapkan template...</p>
            </div>
          )}

          {step === 'selesai' && hasil && (
            <div className="py-8 text-center">
              <CheckCircleFill size={40} className="mx-auto mb-3 text-green-500" />
              <p className="text-base font-semibold text-gray-800 mb-1">Selesai!</p>
              {hasil.berhasil > 0 && <p className="text-sm text-gray-500"><span className="font-medium text-green-600">{hasil.berhasil}</span> produk ditambahkan</p>}
              {hasil.diupdate > 0 && <p className="text-sm text-gray-500"><span className="font-medium text-indigo-600">{hasil.diupdate}</span> produk diperbarui</p>}
              {hasil.berhasil === 0 && hasil.diupdate === 0 && <p className="text-sm text-gray-500">Tidak ada yang berubah</p>}
              {hasil.gagal > 0 && (
                <div className="mt-3 rounded-xl bg-yellow-50 border border-yellow-100 p-3 text-left">
                  <p className="text-xs font-medium text-yellow-700">{hasil.gagal} gagal:</p>
                  {hasil.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-yellow-600 break-words">· {e.pesan}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          {step === 'pilih' && (
            <>
              <button onClick={onTutup} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Tutup</button>
              <button onClick={() => terpilih && setStep('konfirmasi')} disabled={!terpilih} className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                Lanjut
              </button>
            </>
          )}
          {step === 'konfirmasi' && (
            <>
              <button onClick={() => setStep('pilih')} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Kembali</button>
              <button onClick={terapkan} className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">
                Terapkan {template?.produk.length} Produk
              </button>
            </>
          )}
          {step === 'selesai' && (
            <>
              <button onClick={onTutup} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Tutup</button>
              <button onClick={() => { setTerpilih(null); setHasil(null); setStep('pilih') }} className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">
                Pakai Template Lain
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
