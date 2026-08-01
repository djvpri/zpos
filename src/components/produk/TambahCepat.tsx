'use client'

import { useState } from 'react'
import { XLg, CursorText, CheckCircleFill, ExclamationCircle, ArrowRepeat, Lightbulb } from 'react-bootstrap-icons'
import { parseText, type Item } from '@/lib/parse-produk-teks'

interface Props {
  onSelesai: () => void
  onTutup: () => void
}

export default function TambahCepat({ onSelesai, onTutup }: Props) {
  const [teks, setTeks] = useState('')
  const [step, setStep] = useState<'input' | 'preview' | 'proses' | 'selesai'>('input')
  const [items, setItems] = useState<Item[]>([])
  const [hasil, setHasil] = useState<{ berhasil: number; diupdate: number; gagal: number; errors: string[] } | null>(null)
  const [error, setError] = useState('')

  function parse() {
    const resultados = parseText(teks)
    if (!resultados.length) { setError('Tidak ada data valid. Tulis minimal satu nama produk per baris.'); return }
    setItems(resultados)
    setStep('preview')
  }

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }

  async function simpan() {
    setStep('proses')
    try {
      const res = await fetch('/api/produk/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ produk: items }),
      })
      const data = await res.json()
      setHasil({ berhasil: data.berhasil ?? 0, diupdate: data.diupdate ?? 0, gagal: data.gagal ?? 0, errors: data.errors ?? [] })
      setStep('selesai')
      if (data.berhasil > 0 || data.diupdate > 0) onSelesai()
    } catch {
      setHasil({ berhasil: 0, diupdate: 0, gagal: items.length, errors: ['Gagal terhubung ke server. Coba lagi.'] })
      setStep('selesai')
    }
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CursorText size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-800">Tambah Cepat dari Teks</span>
          </div>
          <button onClick={onTutup} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} className="text-gray-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Tempel data produk</p>
                <p className="text-xs text-gray-400 mb-2">Satu produk per baris. Pisahkan kolom dengan <b>|</b> , <b>,</b> , atau spasi.</p>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={8}
                  value={teks}
                  onChange={e => { setTeks(e.target.value); setError('') }}
                  placeholder={`Indomie Goreng | 3500 | 100 | Makanan\nAqua 600ml | 3000 | 50 | Minuman\nTeh Botol Sosro 4000`}
                />
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-600 mb-1">Format baris:</p>
                <div className="text-xs text-gray-500 space-y-1 font-mono">
                  <div>nama | harga | stok | kategori</div>
                  <div>nama | harga | stok</div>
                  <div>nama harga stok</div>
                  <div>nama</div>
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  <Lightbulb size={13} className="inline mr-1 -mt-0.5" />Produk dengan barcode yang sudah ada akan di-update. Tanpa barcode → dibuat baru.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  <ExclamationCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">{items.length} produk terdeteksi</p>
                <button onClick={() => setStep('input')} className="text-xs text-gray-400 hover:text-gray-600">Ubah teks</button>
              </div>

              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 rounded-t-xl text-[10px] font-medium text-gray-500 uppercase border-b border-gray-100">
                <span className="col-span-4">Nama</span>
                <span className="col-span-3">Harga</span>
                <span className="col-span-2">Stok</span>
                <span className="col-span-3">Kategori</span>
              </div>

              <div className="border border-t-0 border-gray-100 rounded-b-xl divide-y divide-gray-50 max-h-60 overflow-y-auto">
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 px-3 py-1.5 items-center">
                    <input
                      className="col-span-4 text-xs border border-transparent focus:border-indigo-300 rounded-lg px-1.5 py-1 outline-none"
                      value={it.nama} onChange={e => updateItem(i, { nama: e.target.value })}
                    />
                    <input
                      className="col-span-3 text-xs border border-transparent focus:border-indigo-300 rounded-lg px-1.5 py-1 outline-none"
                      type="number" value={it.harga} onChange={e => updateItem(i, { harga: +e.target.value })}
                    />
                    <input
                      className="col-span-2 text-xs border border-transparent focus:border-indigo-300 rounded-lg px-1.5 py-1 outline-none"
                      type="number" value={it.stok} onChange={e => updateItem(i, { stok: +e.target.value })}
                    />
                    <input
                      className="col-span-3 text-xs border border-transparent focus:border-indigo-300 rounded-lg px-1.5 py-1 outline-none"
                      value={it.kategori} onChange={e => updateItem(i, { kategori: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Klik untuk mengedit sebelum simpan.</p>
            </div>
          )}

          {step === 'proses' && (
            <div className="py-8 text-center">
              <ArrowRepeat size={40} className="mx-auto mb-3 text-indigo-500 animate-spin" />
              <p className="text-sm font-medium text-gray-700">Menyimpan {items.length} produk...</p>
              <p className="text-xs text-gray-400 mt-1">Mohon tunggu</p>
            </div>
          )}

          {step === 'selesai' && hasil && (
            <div className="py-6 text-center">
              <CheckCircleFill size={40} className="mx-auto mb-3 text-green-500" />
              <p className="text-base font-semibold text-gray-800 mb-1">Selesai!</p>
              {hasil.berhasil > 0 && (
                <p className="text-sm text-gray-500"><span className="font-medium text-green-600">{hasil.berhasil} produk baru</span> ditambahkan</p>
              )}
              {hasil.diupdate > 0 && (
                <p className="text-sm text-gray-500"><span className="font-medium text-indigo-600">{hasil.diupdate} produk</span> diperbarui</p>
              )}
              {hasil.berhasil === 0 && hasil.diupdate === 0 && (
                <p className="text-sm text-gray-500">Tidak ada yang diubah</p>
              )}
              {hasil.gagal > 0 && (
                <div className="mt-3 rounded-xl bg-yellow-50 border border-yellow-100 p-3 text-left">
                  <p className="text-xs font-medium text-yellow-700">{hasil.gagal} gagal:</p>
                  {hasil.errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-yellow-600 break-words">· {e}</p>)}
                </div>
              )}
            </div>
          )}

        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          {step === 'input' && (
            <>
              <button onClick={onTutup} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={parse} disabled={!teks.trim()} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                Deteksi Produk
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep('input')} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Kembali</button>
              <button onClick={simpan} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                Simpan {items.length} Produk
              </button>
            </>
          )}
          {(step === 'proses') && (
            <button disabled className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-400">Menunggu...</button>
          )}
          {step === 'selesai' && (
            <>
              <button onClick={onSelesai} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Tutup</button>
              <button onClick={() => { setTeks(''); setItems([]); setHasil(null); setStep('input') }} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                Tambah Lagi
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
