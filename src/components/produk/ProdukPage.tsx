'use client'

import { useState, useCallback } from 'react'
import { useProduk } from '@/hooks/useProduk'
import { useKategori } from '@/hooks/useKategori'
import { ProdukModal } from '@/components/produk/ProdukModal'
import FotoLightbox from '@/components/produk/FotoLightbox'
import { Produk } from '@/types'
import { useBarcodeUsbListener } from '@/components/kasir/BarcodeScanner'
import { fmt } from '@/lib/utils'
import { Plus, Search, PencilSquare, Trash, Box, Tag, XLg, FileEarmarkSpreadsheet, QrCodeScan, CursorText, UpcScan, Files, LayoutTextWindow, Download, CameraFill, ImageFill } from 'react-bootstrap-icons'
import * as XLSX from 'xlsx'
import dynamic from 'next/dynamic'
const ImportProduk = dynamic(() => import('./ImportProduk'), { ssr: false })
const UploadFotoProduk = dynamic(() => import('./UploadFotoModal'), { ssr: false })
const ScanBarcodeMassal = dynamic(() => import('./ScanBarcodemassal'), { ssr: false })
const TambahCepat = dynamic(() => import('./TambahCepat'), { ssr: false })
const LabelCetak = dynamic(() => import('./LabelCetak'), { ssr: false })
const ImportBarcodeKatalog = dynamic(() => import('./ImportBarcodeKatalog'), { ssr: false })
const KatalogBarcodeModal = dynamic(() => import('./KatalogBarcodeModal'), { ssr: false })
const TemplateProduk = dynamic(() => import('./TemplateProduk'), { ssr: false })
const BarcodeCameraModal = dynamic(
  () => import('@/components/kasir/BarcodeScanner').then(m => m.BarcodeCameraModal),
  { ssr: false }
)

type Tab = 'produk' | 'kategori'

export default function ProdukPage() {
  const { produk, tambah, update, hapus, fetch: fetchProduk } = useProduk()
  const { kategori, tambah: tambahKat, hapus: hapusKat } = useKategori()
  const [tab, setTab] = useState<Tab>('produk')
  const [modal, setModal] = useState<'tambah' | Produk | null>(null)
  const [fotoBesar, setFotoBesar] = useState<Produk | null>(null)
  // Default TANPA foto (senada dgn kasir) — user nyalakan toggle utk lihat thumb.
  const [tampilFoto, setTampilFoto] = useState(false)
  // Ukuran tampil thumbnail di tabel: kecil/sedang/besar (cuma CSS, tak ubah file).
  const [ukuranThumb, setUkuranThumb] = useState<'kecil' | 'sedang' | 'besar'>('kecil')
  const ukuranThumbCls = ukuranThumb === 'kecil' ? 'w-9 h-9' : ukuranThumb === 'sedang' ? 'w-14 h-14' : 'w-20 h-20'
  const [cari, setCari] = useState('')
  // Urut daftar produk: 'nama' (alfabet, default), 'terbaru' atau 'terlama'
  // (waktu upload = created_at).
  const [sortBy, setSortBy] = useState<'nama' | 'terbaru' | 'terlama'>('nama')
  const [namaKat, setNamaKat] = useState('')
  const [katError, setKatError] = useState('')
  const [katLoading, setKatLoading] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showFoto, setShowFoto] = useState(false)
  const [showScanMassal, setShowScanMassal] = useState(false)
  const [showKatalogImport, setShowKatalogImport] = useState(false)
  const [showKatalogLihat, setShowKatalogLihat] = useState(false)
  const [showCepat, setShowCepat] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)
  // Load-more: tampilkan 15 produk dulu, tombol "Tampilkan lebih banyak" menambah 15.
  const [tampil, setTampil] = useState(15)
  // Edit cepat inline: id + field sel yang sedang diedit. Nilai dibaca
  // langsung dari input DOM saat commit (uncontrolled) — meniadakan race
  // controlled+onBlur yang bikin input number macet tak bisa diketik.
  const [editing, setEditing] = useState<{ id: number; field: 'harga' | 'stok' } | null>(null)
  // Edit cepat: scan barcode via kamera utk produk ini.
  const [scanBar, setScanBar] = useState<Produk | null>(null)
  // Notif "produk tak ditemukan" saat scan USB pertama (auto-hilang 2.5s).
  const [scanErr, setScanErr] = useState('')
  // Scan barcode USB (bukan kamera) → cari langsung. Match → buka modal detail;
  // tak match → notif. Hook `useBarcodeUsbListener` aktif walau tak fokus di input.
  const onBarcodeCari = useCallback((code: string) => {
    const p = produk.find(x => x.barcode === code)
    if (p) {
      setScanErr('')
      setModal(p)
    } else {
      setScanErr(`Produk tak ditemukan: ${code}`)
      setTimeout(() => setScanErr(''), 2500)
    }
  }, [produk])
  useBarcodeUsbListener(onBarcodeCari)

  const filtered = produk
    .filter(p => {
      const q = cari.toLowerCase().trim()
      if (!q) return true
      return p.nama.toLowerCase().includes(q)
        || (p.barcode && p.barcode.toLowerCase().includes(q))
        || (p.kategori?.nama && p.kategori.nama.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      if (sortBy === 'nama') return a.nama.localeCompare(b.nama)
      const ta = new Date(a.created_at ?? 0).getTime()
      const tb = new Date(b.created_at ?? 0).getTime()
      return sortBy === 'terbaru' ? tb - ta : ta - tb
    })
  const tampilkanList = filtered.slice(0, tampil)

  const startEdit = (p: Produk, field: 'harga' | 'stok') =>
    setEditing({ id: p.id, field })

  // Commit inline edit: baca nilai dari input DOM, validasi >= 0, kirim via
  // update() (handle offline + _pending). Harga tolak 0, stok 0 dibolehkan.
  // id WAJIB disertakan — produkUpdateSchema (validation.ts) mengharuskan id.
  const commitEdit = (id: number, field: 'harga' | 'stok', raw: string) => {
    const val = Math.floor(Number(raw))
    setEditing(null)
    if (!Number.isFinite(val) || val < 0) return
    if (field === 'harga' && val === 0) return
    update(id, { id, [field]: val } as Partial<Produk>)
  }

  const onSimpan = async (p: Partial<Produk>) => {
    const res = p.id ? await update(p.id, p) : await tambah(p as Omit<Produk, 'id' | 'created_at' | 'updated_at'>)
    if (res?.message) return res     // gagal → modal tetap buka + tampilkan pesan
    setModal(null)
    // Embed ke ZFace sekarang ditangani server-side di api/produk (POST/PUT),
    // otomatis kalau ada foto — tidak perlu panggilan terpisah dari client lagi.
    return null
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
    } catch (err: unknown) {
      setKatError((err as { message?: string }).message || 'Gagal menambah kategori')
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
              onClick={() => setShowKatalogImport(true)}
              title="Import katalog barcode global (saran auto nama produk)"
              className="flex items-center gap-2 px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
            >
              <FileEarmarkSpreadsheet size={16} /> Katalog
            </button>
            <button
              onClick={() => setShowKatalogLihat(true)}
              title="Lihat isi katalog barcode global"
              className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <FileEarmarkSpreadsheet size={16} /> Lihat Katalog
            </button>
            <button
              onClick={exportExcel}
              disabled={produk.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              <Download size={16} /> Export
            </button>
            <button
              onClick={() => setTampilFoto(v => !v)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                tampilFoto
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ImageFill size={16} /> Foto
            </button>
            {tampilFoto && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {(['kecil', 'sedang', 'besar'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setUkuranThumb(u)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                      ukuranThumb === u ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowFoto(true)}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
            >
              <CameraFill size={16} /> Upload Foto
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
              <UpcScan size={16} /> Label
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
              value={cari} onChange={e => { setCari(e.target.value); setTampil(15) }}
              placeholder="Cari produk..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {cari && (
              <button onClick={() => { setCari(''); setTampil(15) }} className="text-gray-400 hover:text-gray-600">
                <XLg size={14} />
              </button>
            )}
            <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 shrink-0">
              {([['nama', 'Nama'], ['terbaru', 'Terbaru'], ['terlama', 'Terlama']] as const).map(([s, lbl]) => (
                <button
                  key={s}
                  onClick={() => { setSortBy(s); setTampil(15) }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    sortBy === s ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {scanErr && <p className="text-red-600 text-xs mb-2">{scanErr}</p>}

          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 font-medium">
                  <th className="text-left px-4 py-3">Produk</th>
                  <th className="text-left px-4 py-3">Kategori</th>
                  <th className="text-left px-4 py-3">Harga</th>
                  <th className="text-left px-4 py-3">Stok</th>
                  <th className="text-left px-4 py-3">Upload</th>
                  <th className="text-left px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tampilkanList.map((p, i) => (
                  <tr key={p.id} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {tampilFoto && (p.foto_thumb ? (
                          <button
                            type="button"
                            onClick={() => setFotoBesar(p)}
                            title="Lihat foto besar"
                            className="shrink-0 cursor-zoom-in"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- foto thumb/data URI dinamis */}
                            <img src={p.foto_thumb} alt={p.nama} className={`${ukuranThumbCls} rounded-lg object-cover`} />
                          </button>
                        ) : p.emoji ? (
                          <span className="text-xl w-9 text-center shrink-0">{p.emoji}</span>
                        ) : (
                          <span className="text-gray-300 w-9 text-center shrink-0"><ImageFill size={20} /></span>
                        ))}
                        {!tampilFoto && (
                          <span className="text-gray-200 w-9 text-center shrink-0"><ImageFill size={20} /></span>
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
                        {(p.kategori as { nama: string } | undefined)?.nama || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editing?.id === p.id && editing.field === 'harga' ? (
                        <input
                          autoFocus
                          key="harga"
                          type="text"
                          inputMode="numeric"
                          defaultValue={String(p.harga)}
                          onBlur={e => commitEdit(p.id, 'harga', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(p.id, 'harga', (e.target as HTMLInputElement).value) }; if (e.key === 'Escape') setEditing(null) }}
                          className="w-24 border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(p, 'harga')}
                          title="Klik utk edit harga"
                          className="text-sm text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 rounded px-1.5 py-1 -ml-1.5 transition-colors"
                        >
                          {fmt(p.harga)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing?.id === p.id && editing.field === 'stok' ? (
                        <input
                          autoFocus
                          key="stok"
                          type="text"
                          inputMode="numeric"
                          defaultValue={String(p.stok)}
                          onBlur={e => commitEdit(p.id, 'stok', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitEdit(p.id, 'stok', (e.target as HTMLInputElement).value) }; if (e.key === 'Escape') setEditing(null) }}
                          className="w-20 border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(p, 'stok')}
                          title="Klik utk edit stok"
                          className={`text-sm font-medium rounded px-1.5 py-1 -ml-1.5 hover:bg-indigo-50 transition-colors ${
                            p.stok === 0 ? 'text-red-500 hover:text-red-600' :
                            p.stok < 5 ? 'text-red-400 hover:text-red-500' :
                            p.stok < 10 ? 'text-amber-500 hover:text-amber-600' : 'text-green-700 hover:text-green-800'
                          }`}
                        >
                          {p.stok}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setScanBar(p)}
                          title="Scan barcode kemasan"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <QrCodeScan size={12} /> Barcode
                        </button>
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
                    <td colSpan={6} className="text-center py-12 text-gray-300">
                      <Box size={36} className="mx-auto mb-2 opacity-40" />
                      <span className="text-sm">Tidak ada produk</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filtered.length > tampil && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => setTampil(t => t + 15)}
                  className="px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  Tampilkan lebih banyak ({tampil} dari {filtered.length})
                </button>
              </div>
            )}
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
      {showKatalogImport && <ImportBarcodeKatalog onTutup={() => setShowKatalogImport(false)} />}
      {showKatalogLihat && <KatalogBarcodeModal onTutup={() => setShowKatalogLihat(false)} />}
      {showFoto && <UploadFotoProduk onClose={() => { setShowFoto(false); fetchProduk() }} />}
      {showCepat && <TambahCepat onSelesai={() => { setShowCepat(false); fetchProduk() }} onTutup={() => setShowCepat(false)} />}
      {showLabel && <LabelCetak produk={produk} onSelesai={() => { setShowLabel(false); fetchProduk() }} onTutup={() => setShowLabel(false)} update={update} />}
      {showTemplate && <TemplateProduk onSelesai={() => { setShowTemplate(false); fetchProduk() }} onTutup={() => setShowTemplate(false)} />}
      {modal && (
        <ProdukModal
          produk={modal === 'tambah' ? null : modal}
          onSimpan={onSimpan}
          onTutup={() => setModal(null)}
        />
      )}
      {fotoBesar && <FotoLightbox produk={fotoBesar} onTutup={() => setFotoBesar(null)} />}
      {scanBar && (
        <BarcodeCameraModal
          onScan={code => { update(scanBar.id, { barcode: code }); setScanBar(null) }}
          onTutup={() => setScanBar(null)}
        />
      )}
    </div>
  )
}
