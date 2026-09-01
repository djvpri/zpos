'use client'

import { useState, useRef, useEffect } from 'react'
import { Produk } from '@/types'
import { fieldKurang } from '@/lib/product-form'
import { isInternalBarcode } from '@/lib/barcode-code39'
import { useKategori } from '@/hooks/useKategori'
import { XLg, Camera, Trash, UpcScan, QrCodeScan, Image as ImageIcon, Magic, ExclamationTriangle } from 'react-bootstrap-icons'
import dynamic from 'next/dynamic'
const KameraModal = dynamic(() => import('./KameraModal'), { ssr: false })
const BarcodeCameraModal = dynamic(
  () => import('@/components/kasir/BarcodeScanner').then(m => m.BarcodeCameraModal),
  { ssr: false }
)

interface Props {
  produk?: Produk | null
  onSimpan: (p: Partial<Produk>) => Promise<{ message?: string } | null | undefined> | { message?: string } | null | undefined
  onTutup: () => void
}

function compressImage(file: File, maxSize = 400, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ProdukModal({ produk, onSimpan, onTutup }: Props) {
  const { kategori, tambah: tambahKategori } = useKategori()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    nama: produk?.nama || '',
    harga: produk?.harga || '',
    stok: produk?.stok ?? '',
    deskripsi: produk?.deskripsi || '',
    foto_url: produk?.foto_url || '',
    barcode: produk?.barcode || '',
    kategori_id: produk?.kategori_id || '',
    expired_at: produk?.expired_at?.slice(0,10) || '',
    stok_minimum: produk?.stok_minimum ?? 5,
    harga_grosir: produk?.harga_grosir ?? '',
    min_qty_grosir: produk?.min_qty_grosir ?? '',
    jenis: produk?.jenis || 'fisik',
    buyer_sku_code: produk?.buyer_sku_code ?? '',
    modal: produk?.modal ?? '',
    digital_brand: produk?.digital_brand ?? 'prabayar',
  })
  // Saat edit: list produk TIDAK menyertakan foto_url besar (lihat GET /api/produk),
  // jadi ambil foto penuh dari endpoint per-produk untuk preview di modal.
  useEffect(() => {
    if (!produk?.id) return
    let aktif = true
    fetch(`/api/produk/${produk.id}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (aktif && data?.foto_url) setForm(f => ({ ...f, foto_url: data.foto_url })) })
      .catch(() => {})
    return () => { aktif = false }
  }, [produk?.id])  
  const [uploading, setUploading] = useState(false)
  const [scanBarcode, setScanBarcode] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null) // fokus utk scanner USB
  const [showKamera, setShowKamera] = useState(false)
  // Auto-detect nama produk dari foto (Gemini Flash-Lite). null = idle/bukan error.
  const [deteksiNama, setDeteksiNama] = useState<'deteksi' | 'gagal' | 'tanpa_teks' | null>(null)
  // Pesan error validasi simpan (field kurang) — tampil merah di atas tombol.
  const [er, setEr] = useState('')
  // Saran kategori dari AI (Gemini). [] = belum ada saran; '-' spinner.
  const [saranKat, setSaranKat] = useState<string[]>([])
  const [saranKatLoading, setSaranKatLoading] = useState(false)

  // Minta saran kategori dari Gemini berdasar nama produk yg diketik. Jangan
  // memanggil AI menghabiskan kuota utk nama kosong/terlalu pendek.
  const mintaSaranKategori = async () => {
    const nama = form.nama.trim()
    if (nama.length < 3) { setEr('Tulis nama produk dulu (min. 3 huruf) untuk dapat saran kategori.'); return }
    setSaranKatLoading(true); setSaranKat([]); setEr('')
    try {
      const res = await fetch('/api/produk/kategori-saran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.kategori) setSaranKat([d.kategori])
      else setEr(d.error || 'Gagal ambil saran kategori.')
    } catch {
      setEr('Gagal terhubung ke server untuk saran kategori.')
    } finally {
      setSaranKatLoading(false)
    }
  }

  // Klik saran → pakai kategori. Kalau kategori belum ada di list, dibuat
  // dulu (POST /api/kategori) & langsung auto-pilih id barunya. Tak duplikat
  // (cek list dulu; unique key toko_id+nama di DB juga jaga).
  const pakaiSaranKat = async (nama: string) => {
    setEr('')
    const ada = kategori.find(k => k.nama.toLowerCase() === nama.toLowerCase())
    if (ada) { set('kategori_id', ada.id); return }
    try {
      const bar = await tambahKategori(nama) // Promise<Kategori> → dapat id
      set('kategori_id', bar.id)
    } catch (e) {
      setEr(e instanceof Error ? e.message : 'Gagal buat kategori.')
    }
  }

  // Auto-suggest dari katalog barcode pusat (barcode_katalog) saat kasir scan /
  // ketik barcode yang belum dikenali toko ini. Hanya mengisi bila nama masih
  // kosong (tak menimpa input yang sudah ada). null response = barcode tak ada
  // di katalog — kasir tetap bisa input manual.
  const sugestikan = async (barcode: string) => {
    const bc = (barcode || '').trim()
    if (bc.length < 8 || form.nama.trim()) return
    setEr('')
    try {
      const res = await fetch(`/api/barcode-katalog/${encodeURIComponent(bc)}`, { cache: 'no-store' })
      if (!res.ok) return // 404 = tak dikenal → diam, biar kasir input manual
      const d = await res.json()
      // Cek lagi jangan sampai user sudah mengetik nama sambil menunggu.
      if (d.nama && !form.nama.trim()) {
        setForm(f => ({ ...f, nama: d.nama }))
        // Saran kategori dari katalog: auto-pilih bila ada & belum ada.
        if (d.kategori) await pakaiSaranKat(d.kategori).catch(() => {})
      }
    } catch {
      // jaringan — diam, tidak usah ganggu alur input.
    }
  }


  // Deteksi nama produk otomatis dari foto (proxy server → Gemini). Bentar,
  // isi field nama; admin tetap bisa edit.
  const cariNamaDariFoto = async (fotoBase64: string) => {
    if (!fotoBase64 || !fotoBase64.startsWith('data:image')) return
    // Kalau admin sudah ketik nama manual, jangan timpa.
    if (form.nama.trim()) return
    setDeteksiNama('deteksi')
    try {
      const res = await fetch('/api/produk/nama-dari-foto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto: fotoBase64 }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok && d.nama) set('nama', d.nama)
      if (res.ok && d.kategori) setSaranKat([d.kategori]) // foto → Gemini kasih nama sekalian kategori
      if (res.ok && d.harga && !String(form.harga || '').trim()) {
        set('harga', String(d.harga)) // harga AI terbaca jelas → isi field harga (bisa diedit)
      }
      if (res.ok && d.adaTeks === false) {
        setDeteksiNama('tanpa_teks') // tak ada label → nama dari penampakan (konfirmasi manual)
      } else if (res.ok && d.nama) {
        setDeteksiNama(null) // ada teks & dapat nama → sukses, tak perlu pesan
      } else {
        setDeteksiNama('gagal')
      }
    } catch {
      setDeteksiNama('gagal')
    }
  }

  const set = (k: string, v: string | number) => { setEr(''); setForm(f => ({ ...f, [k]: v })) }

  const onFotoKamera = (base64: string) => {
    set('foto_url', base64)
    cariNamaDariFoto(base64)
  }

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const base64 = await compressImage(file)
      set('foto_url', base64)
      cariNamaDariFoto(base64)
    } catch {
      alert('Gagal memproses foto')
    }
    setUploading(false)
    e.target.value = ''
  }

  const submit = async () => {
    // Validasi eksplisit: beri tahu field mana yang kurang, JANGAN silent
    // return (sebelumnya membuat pengguna bingung "klik simpan tak bereaksi").
    // Mode cepat: hanya NAMA wajib. Harga default 1 & kategori opsional.
    const kurang = fieldKurang(form)
    if (kurang.length > 0) {
      setEr(`Lengkapi field: ${kurang.join(', ')}`)
      return
    }
    const kategoriId = Number(form.kategori_id) || null
    // onSimpan return null/undefined = sukses; { message } = gagal (mis. nama/barcode
    // duplikat di server). Kalau gagal, jangan tutup modal & tampilkan pesannya.
    const r = await onSimpan({
      ...(produk || {}),
      nama: form.nama,
      harga: Number(form.harga) || 1,
      stok: form.jenis === 'digital' ? 0 : (Number(form.stok) || 0),
      emoji: produk?.emoji || '',
      deskripsi: form.deskripsi.trim() || undefined,
      foto_url: form.foto_url || undefined,
      barcode: form.barcode.trim() || undefined,
      kategori_id: kategoriId,
      expired_at: form.expired_at || undefined,
      stok_minimum: Number(form.stok_minimum) || 5,
      harga_grosir: form.harga_grosir ? Number(form.harga_grosir) : null,
      min_qty_grosir: form.min_qty_grosir ? Number(form.min_qty_grosir) : null,
      jenis: form.jenis === 'digital' ? 'digital' : 'fisik',
      buyer_sku_code: form.jenis === 'digital' ? form.buyer_sku_code.trim() : null,
      modal: form.jenis === 'digital' && form.modal ? Number(form.modal) : null,
      digital_brand: form.jenis === 'digital' ? (form.digital_brand as 'prabayar' | 'pasca') : null,
      aktif: true,
    })
    if (r?.message) setEr(r.message)
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 mt-1"

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-base">{produk?.id ? 'Edit Produk' : (produk ? 'Duplikat Produk' : 'Tambah Produk')}</h3>
          <button onClick={onTutup} className="text-gray-400 hover:text-gray-600"><XLg size={18} /></button>
        </div>

        <div className="space-y-3">
          {/* Foto produk */}
          <div>
            <label className="text-xs text-gray-500">Foto Produk <span className="text-gray-300">(opsional)</span></label>
            <div className="mt-1">
              {form.foto_url ? (
                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-gray-200 group">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto data URI dinamis */}
                  <img src={form.foto_url} alt="foto" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100"
                    >
                      <Camera size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => { set('foto_url', ''); setDeteksiNama(null) }}
                      className="p-2 bg-white rounded-lg text-red-500 hover:bg-red-50"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors disabled:opacity-60"
                  >
                    <ImageIcon size={22} />
                    <span className="text-xs">{uploading ? 'Memproses...' : 'Galeri'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowKamera(true)}
                    disabled={uploading}
                    className="flex-1 h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-purple-300 hover:text-purple-400 transition-colors disabled:opacity-60"
                  >
                    <Camera size={22} />
                    <span className="text-xs">Kamera</span>
                  </button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFoto} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFoto} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 flex items-center gap-2">
              Nama Produk
              {deteksiNama === 'deteksi' && <span className="text-[10px] text-indigo-500 font-medium animate-pulse">Mendeteksi nama dari foto...</span>}
              {deteksiNama === 'gagal' && <span className="text-[10px] text-amber-500 font-medium">Nama produk tak terdeteksi — ketik manual</span>}
              {deteksiNama === 'tanpa_teks' && <span className="text-[10px] text-teal-600 font-medium">Nama dari penampakan (tanpa label) — periksa/edit</span>}
            </label>
            <input className={inputCls} value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Nama produk" />
          </div>
          <div>
            <label className="text-xs text-gray-500 flex items-center gap-1">
              <UpcScan size={12} /> Barcode <span className="text-gray-300">(opsional)</span>
              {isInternalBarcode(form.barcode) && (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 ml-1">
                  Internal Z1 Pos
                </span>
              )}
            </label>
            <div className="flex gap-2 mt-1">
              <input
                data-scanner="barcode"
                ref={barcodeInputRef}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                value={form.barcode}
                onChange={e => { set('barcode', e.target.value); void sugestikan(e.target.value) }}
                placeholder="Scan atau ketik barcode..."
                onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
              />
              <button
                type="button"
                onClick={() => barcodeInputRef.current?.focus()}
                className="px-3 py-2 border border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                title="Scan dengan scanner USB (fokus ke kolom barcode)"
              >
                <UpcScan size={16} />
              </button>
              <button
                type="button"
                onClick={() => setScanBarcode(true)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                title="Scan dengan kamera"
              >
                <QrCodeScan size={16} />
              </button>
            </div>
            {isInternalBarcode(form.barcode) && (
              <p className="text-[11px] text-amber-600 mt-1.5 flex items-start gap-1">
                <ExclamationTriangle size={12} className="shrink-0 mt-0.5" />
                Ini barcode buatan Z1 Pos (dipakai utk produk tanpa barcode). Kalau barang ini punya barcode asli kemasan, scan kamera untuk menggantinya.
              </p>
            )}
            {produk?.barcode_internal && (
              <p className="text-[11px] text-gray-500 mt-1.5 font-mono">
                Barcode label (8 digit): <span className="font-semibold text-gray-700">{produk.barcode_internal}</span>{' '}
                <span className="text-gray-400 font-sans">— dipakai Z1 Label utk cetak label 25mm</span>
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500">Deskripsi <span className="text-gray-300">(opsional)</span></label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={form.deskripsi}
              onChange={e => set('deskripsi', e.target.value)}
              placeholder="Deskripsi singkat produk..."
              maxLength={300}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Harga (Rp)</label>
              <input className={inputCls} type="number" value={form.harga} onChange={e => set('harga', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Stok</label>
              <input className={inputCls} type="number" value={form.stok} disabled={form.jenis === 'digital'} onChange={e => set('stok', e.target.value)} placeholder="0" />
              {form.jenis === 'digital' && <p className="text-[10px] text-indigo-500 mt-1">Stok dikunci 0 — milik saldo Digiflazz.</p>}
            </div>
          </div>

          {/* Item DIGITAL (jual pulsa/tagihan via Digiflazz) */}
          <div className={`rounded-xl border p-3 space-y-2 ${form.jenis === 'digital' ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-150 bg-gray-50/50'}`}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.jenis === 'digital'}
                onChange={e => set('jenis', e.target.checked ? 'digital' : 'fisik')}
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="text-xs font-semibold text-gray-700">⚡ Item Digital <span className="font-normal text-gray-400">(jual pulsa / tagihan via Digiflazz)</span></span>
            </label>
            {form.jenis === 'digital' && (
              <div className="space-y-2 pt-1">
                <div>
                  <label className="text-xs text-gray-500">Kode SKU Digiflazz <span className="text-red-500">*</span></label>
                  <input
                    className={inputCls}
                    value={form.buyer_sku_code}
                    onChange={e => set('buyer_sku_code', e.target.value)}
                    placeholder="Mis. xld10 (XL 10rb), pln"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Modal / Harga Dasar (Rp)</label>
                    <input className={inputCls} type="number" value={form.modal} onChange={e => set('modal', e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Tipe</label>
                    <select className={inputCls} value={form.digital_brand} onChange={e => set('digital_brand', e.target.value)}>
                      <option value="prabayar">Prabayar (pulsa/kuota)</option>
                      <option value="pasca">Pascabayar (PLN/PDAM)</option>
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-indigo-500">
                  Prabayar: isi “Harga” = harga jual ke konsumen, “Modal” = harga dasar Digiflazz (margin = selisih).
                </p>
              </div>
            )}
          </div>

          {/* Dual pricing grosir/ecer */}
          <div className="rounded-xl border border-green-100 bg-green-50/60 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-green-700">Harga Grosir <span className="font-normal text-green-500">(opsional — jual banyak lebih murah)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Harga Satuan Grosir (Rp)</label>
                <input className={inputCls} type="number" value={form.harga_grosir} onChange={e => set('harga_grosir', e.target.value)} placeholder="Mis. 8000" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Min. Jumlah (pcs)</label>
                <input className={inputCls} type="number" value={form.min_qty_grosir} onChange={e => set('min_qty_grosir', e.target.value)} placeholder="Mis. 6" />
              </div>
            </div>
            <p className="text-[10px] text-green-600">Otomatis pakai harga grosir saat pembelian &ge; min jumlah. Kosongkan = tanpa harga grosir.</p>
          </div>

          <div>
            <label className="text-xs text-gray-500">Kategori</label>
            <select className={inputCls} value={form.kategori_id} onChange={e => set('kategori_id', Number(e.target.value))}>
              <option value="">Pilih kategori</option>
              {kategori.map(k => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>

            {/* Saran kategori AI — klik untuk bikin/pilih kategori otomatis */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={mintaSaranKategori}
                className="text-[11px] px-2 py-1 rounded-md border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
              >
                {saranKatLoading ? 'Mencari…' : <><Magic size={12} className="inline mr-1 -mt-0.5" />Saran kategori AI</>}
              </button>
              {saranKat.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => pakaiSaranKat(s)}
                  className="text-[11px] px-2 py-1 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                  title="Klik untuk pakai (buat kalau belum ada)"
                >
                  {s}
                </button>
              ))}
              {saranKat.length > 0 && (
                <button type="button" onClick={() => { setSaranKat([]); setEr('') }} className="text-[10px] text-gray-400 hover:text-gray-600">
                  <XLg size={10} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Kadaluarsa & Stok Minimum */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Kadaluarsa <span className="text-gray-300">(opsional)</span></label>
            <input type="date" value={form.expired_at || ''}
              onChange={e => set('expired_at', e.target.value)}
              className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min. Stok</label>
            <input type="number" value={form.stok_minimum ?? 5} min={0}
              onChange={e => set('stok_minimum', +e.target.value)}
              className={inputCls} />
          </div>
        </div>

        {er && (
          <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <ExclamationTriangle size={13} className="inline mr-1 -mt-0.5" />{er}
          </p>
        )}
        <div className="flex gap-3 mt-4">
          <button onClick={onTutup} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Batal
          </button>
          <button onClick={submit} disabled={uploading} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
            Simpan
          </button>
        </div>
      </div>
    </div>

      {scanBarcode && (
        <BarcodeCameraModal
          onScan={code => { set('barcode', code); setScanBarcode(false); void sugestikan(code) }}
          onTutup={() => setScanBarcode(false)}
        />
      )}
      {showKamera && (
        <KameraModal onFoto={onFotoKamera} onClose={() => setShowKamera(false)} />
      )}
    </>
  )
}
