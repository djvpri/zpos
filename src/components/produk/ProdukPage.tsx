'use client'

import { useState } from 'react'
import { useProduk } from '@/hooks/useProduk'
import { useKategori } from '@/hooks/useKategori'
import { ProdukModal } from '@/components/produk/ProdukModal'
import { Produk } from '@/types'
import { fmt } from '@/lib/utils'
import { Plus, Search, PencilSquare, Trash, Box, Tag, XLg, FileEarmarkSpreadsheet, QrCodeScan, CursorText, UpcScan, Files, Tags, LayoutTextWindow, Download } from 'react-bootstrap-icons'
import * as XLSX from 'xlsx'
import dynamic from 'next/dynamic'
const ImportProduk = dynamic(() => import('./ImportProduk'), { ssr: false })
const ScanBarcodeMassal = dynamic(() => import('./ScanBarcodemassal'), { ssr: false })
const TambahCepat = dynamic(() => import('./TambahCepat'), { ssr: false })
const BarcodeLabel = dynamic(() => import('./BarcodeLabel'), { ssr: false })
const StickerHarga = dynamic(() => import('./StickerHarga'), { ssr: false })
const TemplateProduk = dynamic(() => import('./TemplateProduk'), { ssr: false })

type Tab = 'produk' | 'kategori'

export default function ProdukPage() {
  const { produk, tambah, update, hapus, fetch: fetchProduk } = useProduk()
  const { kategori, tambah: tambahKat, hapus: hapusKat } = useKategori()
  const [tab, setTab] = useState<Tab>('produk')
  const [modal, setModal] = useState<'tambah' | Produk | null>(null)
  const [cari, setCari] = useState('')
  const [namaKat, setNamaKat] = useState('')
  const [katError, setKatError] = useState('')
  const [katLoading, setKatLoading] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showScanMassal, setShowScanMassal] = useState(false)
  const [showCepat, setShowCepat] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [showHarga, setShowHarga] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)

  const filtered = produk.filter(p => p.nama.toLowerCase().includes(cari.toLowerCase()))

  const onSimpan = async (p: Partial<Produk>) => {
    if (p.id) await update(p.id, p)
    else await tambah(p as any)
    setModal(null)
    // Embed ke ZFace sekarang ditangani server-side di api/produk (POST/PUT),
    // otomatis kalau ada foto — tidak perlu panggilan terpisah dari client lagi.
  }

  const onHapusProduk = async (id: number) => {
    if (confirm('Hapus produk ini?')) {
      await hapus(id)
      // hapusEmbedding ditangani server-side di api/produk/[id] (DELETE).
    }
  }

  // Duplikasi cepat: buka modal edit yang prefill dari produk asal, TANPA id
  // (jadi saat simpan → insert baru) dan barcode dikosongkan (unique barcode
  // per-toko menolak duplikat). Nama diberi suffix supaya jelas beda produk.
  const onDuplikat = (p: Produk) => {
    setModal({ ...p, id: 0 as unknown as number, nama: `${p.nama} (salinan)`, barcode: undefined })
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

  // Export SEMUA produk ke Excel (bukan cuma yg terfilter). Kolom diset sama
  // dengan template import + barcode & kategori, jadi file bisa diedit lalu
  // di-upload balik utk update massal tanpa duplikat (barcode/nama = kunci).
  function exportExcel() {
    const rows = [
      ['nama', 'harga', 'stok', 'kategori', 'harga_grosir', 'min_qty_grosir', 'deskripsi', 'barcode', 'expired_at', 'stok_minimum'],
      ...produk.map((p: Produk) => [
        p.nama, p.harga, p.stok,
        p.kategori?.nama || '',
        p.harga_grosir ?? '', p.min_qty_grosir ?? '',
        p.deskripsi ?? '', p.barcode ?? '', p.expired_at ?? '', p.stok_minimum ?? 5,
      ]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [24,10,8,15,12,12,24,18,12,12].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produk')
    XLSX.writeFile(wb, 'produk_zpos.xlsx')
  }

  return (
    <div className="p-5">
      {/* Header + Tab */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('produk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'produk' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Box size={14} /> Produk
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              <FileEarmarkSpreadsheet size={16} /> Import
            </button>
            <button
              onClick={exportExcel}
              disabled={produk.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <Download size={16} /> Export
            </button>
            <button
              onClick={() => setShowScanMassal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <QrCodeScan size={16} /> Scan Massal
            </button>
            <button
              onClick={() => setShowCepat(true)}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <CursorText size={16} /> Tambah Cepat
            </button>
            <button
              onClick={() => setShowTemplate(true)}
              className="flex items-center gap-2 px-4 py-2 border border-purple-200 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
            >
              <LayoutTextWindow size={16} /> Template
            </button>
            <button
              onClick={() => setShowLabel(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <UpcScan size={16} /> Label Barcode
            </button>
            <button
              onClick={() => setShowHarga(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Tags size={16} /> Stiker Harga
            </button>
            <button
              data-testid="add-product-btn"
              onClick={() => setModal('tambah')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors"
            >
              <Plus size={16} /> Tambah Produk
            </button>
          </div>
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
                <XLg size={14} />
              </button>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[640px]">
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
                          <PencilSquare size={12} /> Edit
                        </button>
                        <button
                          data-testid="duplicate-product"
                          onClick={() => onDuplikat(p)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors">
                          <Files size={12} /> Duplikat
                        </button>
                        <button
                          data-testid="delete-product"
                          onClick={() => onHapusProduk(p.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                          <Trash size={12} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-300">
                      <Box size={36} className="mx-auto mb-2 opacity-40" />
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
                    <Trash size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showScanMassal && <ScanBarcodeMassal onSelesai={fetchProduk} onTutup={() => setShowScanMassal(false)} tambahOffline={tambah} />}
      {showImport && <ImportProduk onSelesai={fetchProduk} onTutup={() => setShowImport(false)} tambahOffline={tambah} />}
      {showCepat && <TambahCepat onSelesai={() => { setShowCepat(false); fetchProduk() }} onTutup={() => setShowCepat(false)} />}
      {showLabel && <BarcodeLabel produk={produk} onSelesai={() => { setShowLabel(false); fetchProduk() }} onTutup={() => setShowLabel(false)} update={update} />}
      {showHarga && <StickerHarga produk={produk} onTutup={() => setShowHarga(false)} />}
      {showTemplate && <TemplateProduk onSelesai={() => { setShowTemplate(false); fetchProduk() }} onTutup={() => setShowTemplate(false)} />}
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
