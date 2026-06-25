'use client'

import { useState } from 'react'
import { useProduk } from '@/hooks/useProduk'
import { useKategori } from '@/hooks/useKategori'
import { useAuth } from '@/hooks/useAuth'
import { ProdukModal } from '@/components/produk/ProdukModal'
import { Produk } from '@/types'
import { fmt } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, Package, Tag, X, FileSpreadsheet, ScanLine } from 'lucide-react'
import dynamic from 'next/dynamic'
const ImportProduk = dynamic(() => import('./ImportProduk'), { ssr: false })
const ScanBarcodeMassal = dynamic(() => import('./ScanBarcodemassal'), { ssr: false })
import { embedProduk, hapusEmbedding } from '@/lib/zface-visual'

type Tab = 'produk' | 'kategori'

export default function ProdukPage() {
  const { produk, tambah, update, hapus } = useProduk()
  const { kategori, tambah: tambahKat, hapus: hapusKat } = useKategori()
  const [tab, setTab] = useState<Tab>('produk')
  const [modal, setModal] = useState<'tambah' | Produk | null>(null)
  const [cari, setCari] = useState('')
  const [namaKat, setNamaKat] = useState('')
  const [katError, setKatError] = useState('')
  const [katLoading, setKatLoading] = useState(false)

  const filtered = produk.filter(p => p.nama.toLowerCase().includes(cari.toLowerCase()))

  const { toko } = useAuth()

  const onSimpan = async (p: Partial<Produk>) => {
    let saved: any
    if (p.id) saved = await update(p.id, p)
    else saved = await tambah(p as any)
    setModal(null)

    // Auto-embed ke ZFace jika ada foto
    if (toko && p.foto_url && (saved?.id || p.id)) {
      const produkId = saved?.id || p.id
      embedProduk({
        produkId,
        nama: p.nama || '',
        harga: p.harga || 0,
        fotoBase64: p.foto_url,
        tokoId: toko.tokoId,
        fotoUrl: p.foto_url,
      }).catch(() => {}) // silent fail
    }
  }

  const onHapusProduk = async (id: number) => {
    if (confirm('Hapus produk ini?')) {
      await hapus(id)
      if (toko) hapusEmbedding({ produkId: id, tokoId: toko.tokoId }).catch(() => {})
    }
  }

  const onTambahKat = async (e: React.FormEvent) => {
    e.preventDefault()
    setKatError('')
    setKatLoading(true)
    try {
      await tambahKat(namaKat)
      setNamaKat('')
    } catch (err: any) {
      setKatError(err.message)
    }
    setKatLoading(false)
  }

  const onHapusKat = async (id: number, nama: string) => {
    if (!confirm(`Hapus kategori "${nama}"? Produk dengan kategori ini akan menjadi tanpa kategori.`)) return
    await hapusKat(id)
  }

  return (
    <div className="p-5">
      {/* Header + Tab */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setTab('produk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'produk' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package size={14} /> Produk
          </button>
          <button
            onClick={() => setTab('kategori')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'kategori' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Tag size={14} /> Kategori
          </button>
        </div>

        {tab === 'produk' && (
          <button
            data-testid="add-product-btn"
            onClick={() => setModal('tambah')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors"
          >
            <Plus size={16} /> Tambah Produk
          </button>
        )}
      </div>

      {/* Tab: Produk */}
      {tab === 'produk' && (
        <>
          <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5 mb-4">
            <Search size={16} className="text-gray-400" />
            <input
              value={cari} onChange={e => setCari(e.target.value)}
              placeholder="Cari produk..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {cari && (
              <button onClick={() => setCari('')} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 font-medium">
                  <th className="text-left px-4 py-3">Produk</th>
                  <th className="text-left px-4 py-3">Kategori</th>
                  <th className="text-left px-4 py-3">Harga</th>
                  <th className="text-left px-4 py-3">Stok</th>
                  <th className="text-left px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.foto_url ? (
                          <img src={p.foto_url} alt={p.nama} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <span className="text-xl w-9 text-center shrink-0">{p.emoji}</span>
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-800">{p.nama}</div>
                          {p.deskripsi && (
                            <div className="text-xs text-gray-400 truncate max-w-[180px]">{p.deskripsi}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                        {(p.kategori as any)?.nama || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{fmt(p.harga)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        p.stok === 0 ? 'text-red-500' :
                        p.stok < 5 ? 'text-red-400' :
                        p.stok < 10 ? 'text-amber-500' : 'text-green-700'
                      }`}>{p.stok}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          data-testid="edit-product"
                          onClick={() => setModal(p)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                          <Edit2 size={12} /> Edit
                        </button>
                        <button
                          data-testid="delete-product"
                          onClick={() => onHapusProduk(p.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-300">
                      <Package size={36} className="mx-auto mb-2 opacity-40" />
                      <span className="text-sm">Tidak ada produk</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Tab: Kategori */}
      {tab === 'kategori' && (
        <div className="max-w-md">
          {/* Form tambah */}
          <form onSubmit={onTambahKat} className="flex gap-2 mb-4">
            <input
              value={namaKat}
              onChange={e => { setNamaKat(e.target.value); setKatError('') }}
              placeholder="Nama kategori baru..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
            />
            <button
              type="submit" disabled={!namaKat.trim() || katLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Plus size={15} /> Tambah
            </button>
          </form>
          {katError && <p className="text-red-500 text-xs mb-3">{katError}</p>}

          {/* List kategori */}
          <div className="space-y-2">
            {kategori.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Belum ada kategori</div>
            ) : (
              kategori.map(k => (
                <div key={k.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Tag size={13} className="text-indigo-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-800">{k.nama}</span>
                    <span className="text-xs text-gray-400">
                      ({produk.filter(p => p.kategori_id === k.id).length} produk)
                    </span>
                  </div>
                  <button
                    onClick={() => onHapusKat(k.id, k.nama)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showScanMassal && <ScanBarcodeMassal onSelesai={fetchProduk} onTutup={() => setShowScanMassal(false)} />}
      {showImport && <ImportProduk onSelesai={fetchProduk} onTutup={() => setShowImport(false)} />}
      {modal && (
        <ProdukModal
          produk={modal === 'tambah' ? null : modal}
          onSimpan={onSimpan}
          onTutup={() => setModal(null)}
        />
      )}
    </div>
  )
}
