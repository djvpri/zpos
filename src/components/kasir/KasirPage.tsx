'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, Cart3, XLg, QrCodeScan, ThreeDots, Camera, CheckLg, PersonBadge, ListUl, BookmarkPlus, Trash3 } from 'react-bootstrap-icons'
import PenjualanLain from '@/components/kasir/PenjualanLain'
import { useProduk } from '@/hooks/useProduk'
import { useTransaksi } from '@/hooks/useTransaksi'
import { useKategori } from '@/hooks/useKategori'
import { useAuth } from '@/hooks/useAuth'
import { usePengaturan } from '@/hooks/usePengaturan'
import { ProdukGrid } from '@/components/kasir/ProdukGrid'
import { KeranjangPanel } from '@/components/kasir/KeranjangPanel'
import { StrukModal } from '@/components/kasir/StrukModal'
import { ShiftBanner } from '@/components/kasir/ShiftBanner'
import dynamic from 'next/dynamic'
import { useBarcodeUsbListener } from '@/components/kasir/BarcodeScanner'
const ScanProdukVisual = dynamic(() => import('@/components/kasir/ScanProdukVisual'), { ssr: false })
const BarcodeCameraModal = dynamic(
  () => import('@/components/kasir/BarcodeScanner').then(m => m.BarcodeCameraModal),
  { ssr: false }
)
import { Produk, ItemKeranjang, Transaksi, DetailTransaksi, Member } from '@/types'
import { hitungPajak, hitungTotal, noTrx, fmt } from '@/lib/utils'
import { hargaEfektif, isGrosir } from '@/lib/dual-pricing'
import { useMember, useHargaMember } from '@/hooks/useMember'
import { useBon, Bon } from '@/hooks/useBon'

type ProdukVirtual = { id: number; nama: string; harga: number; stok: number; kategori_id: null; barcode: null; foto_url: null }

export default function KasirPage() {
  const { produk, loading, kurangiStok, tambahStok } = useProduk()
  const { simpan } = useTransaksi()
  const { kategori } = useKategori()
  const { toko, syncNow } = useAuth()
  const { pajakPersen, alamat, telepon, catatan_struk } = usePengaturan()
  const { anggota } = useMember()
  const { getHarga } = useHargaMember()
  const { bon, loading: bonLoading, simpan: simpanBon, hapus: hapusBon, tandaiSelesai, reload: reloadBon } = useBon()

  const [katId, setKatId] = useState<number | null>(null)
  const [cari, setCari] = useState('')
  const [keranjang, setKeranjang] = useState<Record<number, number>>({})
  const [diskon, setDiskon] = useState(0)
  const [bayar, setBayar] = useState('')
  const [metode, setMetode] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai')
  const [struk, setStruk] = useState<Transaksi | null>(null)
  const [showCart, setShowCart] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [tab, setTab] = useState<'produk' | 'lain'>('produk')
  const [showScanVisual, setShowScanVisual] = useState(false)
  const [virtualProduk, setVirtualProduk] = useState<Record<number, ProdukVirtual>>({})
  // Flash-scan: barcode tidak dikenal di katalog → minta harga utk auto-create
  const [flashScan, setFlashScan] = useState<string | null>(null)
  const [flashNama, setFlashNama] = useState('')
  const [flashHarga, setFlashHarga] = useState('')
  // Autofill nama dari Open Food Facts (kalau barcode terdaftar di sana)
  const [flashAutoNama, setFlashAutoNama] = useState<'cek' | string | null>(null)
  const [pesanSimpan, setPesanSimpan] = useState<{ tipe: 'antri' | 'gagal'; teks: string } | null>(null)
  // Member aktif: saat kasir memilih member, `memberMap` berisi produk_id →
  // harga member (proyeksi kategori). Item yg ada di map memakai harga itu.
  const [memberAktif, setMemberAktif] = useState<Member | null>(null)
  const [memberMap, setMemberMap] = useState<Record<number, number>>({})
  const [mlistTerbuka, setMlistTerbuka] = useState(false)
  // Bon gantung: modal simpan (butuh member aktif) + modal daftar (tarik/hapus/bayar).
  const [showSimpanBon, setShowSimpanBon] = useState(false)
  const [showListBon, setShowListBon] = useState(false)
  const [bonErr, setBonErr] = useState('')

  const produkFiltered = useMemo(() =>
    produk.filter(p =>
      (katId === null || p.kategori_id === katId) &&
      (cari === '' ||
        p.nama.toLowerCase().includes(cari.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(cari.toLowerCase())))
    ), [produk, katId, cari])

  const items: ItemKeranjang[] = useMemo(() =>
    Object.entries(keranjang)
      .map(([id, qty]) => {
        const numId = Number(id)
        const p = numId < 0
          ? virtualProduk[numId]
          : produk.find(x => x.id === numId)
        if (!p) return null
        // Harga member menang penuh apabila produk ada di memberMap (harga
        // khusus kategori member yang sedang aktif). Tanpa member, dual pricing
        // grosir normal.
        const hargaMember = memberAktif ? memberMap[p.id] : undefined
        if (hargaMember !== undefined && hargaMember > 0) {
          return { ...p, qty, harga: hargaMember, _grosir: false, _member: true, _harga_ecer: p.harga }
        }
        // Dual pricing: harga satuan item = harga efektif berdasar qty keranjang.
        // Dihitung ulang tiap qty berubah (dep `keranjang`) → naik ke ambang
        // grosir otomatis pakai harga_grosir, turun balik ke harga ecer.
        const grosir = isGrosir(p, qty)
        return { ...p, qty, harga: hargaEfektif(p, qty), _grosir: grosir, _harga_ecer: grosir ? p.harga : undefined }
      })
      .filter(Boolean) as ItemKeranjang[]
  , [keranjang, produk, virtualProduk, memberAktif, memberMap])

  const subtotal = items.reduce((s, i) => s + i.harga * i.qty, 0)
  const disc = Math.min(diskon, subtotal)
  const pajak = hitungPajak(subtotal, disc, pajakPersen)
  const total = hitungTotal(subtotal, disc, pajak)
  const kembali = Math.max((Number(bayar) || 0) - total, 0)
  const kurang = Math.max(total - (Number(bayar) || 0), 0)
  const totalItem = items.reduce((s, i) => s + i.qty, 0)

  function pilihDariVisualScan(produkId: number, nama: string, harga: number) {
    const p = produk.find(x => x.id === produkId)
    if (p) {
      tambahKeKeranjang(p)
    } else {
      // Produk tidak ada di cache lokal, tambah sebagai virtual
      const virtualId = -produkId
      setVirtualProduk(v => ({ ...v, [virtualId]: { id: virtualId, nama, harga, stok: 9999, kategori_id: null, barcode: null, foto_url: null } }))
      setKeranjang(k => ({ ...k, [virtualId]: (k[virtualId] || 0) + 1 }))
    }
  }

  function tambahItemLain(itemsLain: {id: string; nama: string; harga: number; qty: number}[]) {
    const newVirtual: Record<number, ProdukVirtual> = {}
    const newKeranjang: Record<number, number> = {}
    itemsLain.forEach(item => {
      const virtualId = -(Date.now() + Math.floor(Math.random() * 10000))
      newVirtual[virtualId] = { id: virtualId, nama: item.nama, harga: item.harga, stok: 9999, kategori_id: null, barcode: null, foto_url: null }
      newKeranjang[virtualId] = item.qty
    })
    setVirtualProduk(v => ({ ...v, ...newVirtual }))
    setKeranjang(k => ({ ...k, ...newKeranjang }))
  }

  const tambahKeKeranjang = useCallback((p: Produk) => {
    if (p.stok <= 0) return
    setKeranjang(k => ({ ...k, [p.id]: (k[p.id] || 0) + 1 }))
    kurangiStok(p.id, 1)
  }, [kurangiStok])

  // Autofill nama & kategori dari Open Food Facts. Coverage terbatas (mayoritas
  // produk lokal tak terdaftar) — kalau tak ketemu, dibiarkan kasir isi manual.
  // Dideklarasikan sebelum onBarcodeScan karena dipanggil di sana.
  const autofillNama = useCallback(async (code: string) => {
    setFlashAutoNama('cek')
    try {
      const res = await fetch(`/api/produk/barcode-info?barcode=${encodeURIComponent(code)}`)
      const data = await res.json()
      if (data?.nama) {
        setFlashNama(data.nama)
        setFlashAutoNama(data.nama)
      } else {
        setFlashAutoNama(null)
      }
    } catch {
      setFlashAutoNama(null)
    }
  }, [])

  const onBarcodeScan = useCallback((code: string) => {
    // Cari dari katalog yang sudah dimuat client (produk dari useProduk,
    // yang sekarang ter-cache offline juga) — TIDAK perlu round-trip
    // server. Ini juga membuat scan tetap jalan saat offline total, dan
    // lebih cepat + lebih ringan ke server bahkan saat online.
    const p = produk.find(x => x.barcode === code)
    console.log('[SCAN-POS] code=', JSON.stringify(code), 'ketemu=', !!p, 'total=', produk.length)
    if (p) {
      tambahKeKeranjang(p)
    } else {
      // Barcode tidak dikenal di katalog → flash-scan: minta harga, lalu
      // auto-create & tambah ke keranjang. Coba autofill nama dari OFP.
      setFlashNama('')
      setFlashHarga('')
      setFlashScan(code)
      autofillNama(code)
    }
  }, [produk, autofillNama, tambahKeKeranjang])

  useBarcodeUsbListener(onBarcodeScan)

  // Flash-scan: buat produk baru dari barcode tak dikenal, lalu tambah ke keranjang.
  // POST langsung ke /api/produk supaya dapat id server asli (bukan via `tambah`
  // yang contract-nya "null=sukses"). Offline → tidak dijual sampai sinkron
  // (produk pending sengaja tidak sellable), konsisten dgn desain _pending.
  const buatDariFlashScan = async () => {
    if (!flashScan) return
    const harga = Number(flashHarga)
    if (!harga || harga <= 0) return
    try {
      const res = await fetch('/api/produk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: flashNama.trim() || 'Produk baru',
          harga,
          stok: 0,
          kategori_id: null,
          barcode: flashScan,
          aktif: true,
        }),
      })
      if (res.ok) {
        const row = await res.json() as Produk
        tambahKeKeranjang(row)
        setFlashScan(null)
        setFlashAutoNama(null)
      }
    } catch {
      // offline — biarkan modal tetap terbuka, kasir coba lagi saat online
    }
  }

  const ubahQty = (id: number, delta: number) => {
    const cur = keranjang[id] || 0
    const next = cur + delta
    if (next <= 0) {
      const rest = { ...keranjang }
      delete rest[id]
      setKeranjang(rest)
      if (delta < 0) tambahStok(id, 1)
    } else {
      if (delta > 0) {
        const p = produk.find(x => x.id === id)
        if (!p || p.stok <= 0) return
        kurangiStok(id, 1)
      } else {
        tambahStok(id, 1)
      }
      setKeranjang(k => ({ ...k, [id]: next }))
    }
  }

  const bayarSekarang = async () => {
    if (items.length === 0 || (metode === 'Tunai' && kurang > 0)) return
    setPesanSimpan(null)

    const trxData: Transaksi = {
      no_transaksi: noTrx(),
      subtotal, diskon: disc, pajak, pajak_persen: pajakPersen, total,
      bayar: metode === 'Tunai' ? Number(bayar) : total,
      kembali: metode === 'Tunai' ? kembali : 0,
      metode_bayar: metode,
      kasir: toko?.userName ?? '',
      created_at: new Date().toISOString(), // waktu jual sesungguhnya, dipakai kalau nanti disinkron belakangan
      items: items.map(it => ({
        produk_id: it.id > 0 ? it.id : null,  // produk virtual (id negatif) tidak punya baris di tabel produk
        nama_produk: it.nama,
        harga: it.harga,
        qty: it.qty,
        subtotal: it.harga * it.qty,
      })),
    }

    const details: DetailTransaksi[] = items.map(it => ({
      produk_id: it.id > 0 ? it.id : null,  // produk virtual → null, bukan timestamp negatif yg overflow INTEGER
      nama_produk: it.nama,
      harga: it.harga,
      qty: it.qty,
      subtotal: it.harga * it.qty,
    }))

    const hasil = await simpan(trxData, details)

    if (hasil.error) {
      // Server terjangkau tapi benar-benar menolak (mis. langganan habis) —
      // jangan cetak struk / kosongkan keranjang, kasir perlu tahu & coba lagi.
      setPesanSimpan({ tipe: 'gagal', teks: hasil.error })
      return
    }
    if (hasil.queued) {
      setPesanSimpan({ tipe: 'antri', teks: 'Tidak ada koneksi — transaksi disimpan & akan otomatis terkirim.' })
      setTimeout(() => setPesanSimpan(null), 6000)
      syncNow() // coba langsung, jaga-jaga koneksi sebenarnya sempat balik
    }

    setStruk(trxData)
    setKeranjang({})
    setVirtualProduk({})
    setBayar('')
    setDiskon(0)
    setMetode('Tunai')
    setShowCart(false)
  }

  const filterChips = (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button onClick={() => setKatId(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
          katId === null ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}>Semua</button>
      {kategori.map(k => (
        <button key={k.id} onClick={() => setKatId(k.id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            katId === k.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}>{k.nama}</button>
      ))}
    </div>
  )

  // Pilih member utk transaksi saat ini → muat harga khusus kategorinya.
  async function pilihMember(m: Member | null) {
    setMemberAktif(m)
    if (!m || !m.kategori_member_id) { setMemberMap({}); return }  // tanpa kategori → harga normal
    const map = await getHarga(m.kategori_member_id)  // produk_id → harga member
    setMemberMap(map)
  }

  // Bon gantung: simpan keranjang sekarang sbg bon (belum dibayar). WAJIB ada
  // member aktif — nama member dipakai sbg keterangan bon.
  async function konfirmSimpanBon() {
    if (!memberAktif) { setShowSimpanBon(false); return }
    setBonErr('')
    try {
      await simpanBon(keranjang, memberAktif.nama, total)
      setKeranjang({})
      setVirtualProduk({})
      setShowSimpanBon(false)
    } catch (e) { setBonErr((e as Error).message) }
  }

  // Buka modal simpan bon. Wajib member aktif — kalau belum, buka list member.
  function bukaSimpanBon() {
    if (totalItem === 0) return
    if (!memberAktif) { setMlistTerbuka(true); return }  // minta pilih member dulu
    setBonErr('')
    setShowSimpanBon(true)
  }

  // Tarik bon → isi ulang keranjang (produk id positif), tandai selesai.
  async function tarikBon(b: Bon) {
    setKeranjang({ ...b.produk })
    setShowListBon(false)
    await tandaiSelesai(b.id)
  }

  const keranjangProps = {
    items, diskon: disc, bayar, metode,
    subtotal, pajak, pajakPersen, total, kembali, kurang,
    onUbahQty: ubahQty, onDiskon: setDiskon, onBayar: setBayar,
    onMetode: setMetode, onBayarSekarang: bayarSekarang,
    onGantung: bukaSimpanBon,
    onListBon: () => { setShowListBon(true); reloadBon() },
    bonAktif: bon.filter(x => !x.selesai).length,
  }

  // Member activator: pill kecil utk memilih/melepas member transaksi. Memakai
  // daftar anggota (useMember, ter-cache offline). Tersedia di desktop & mobile.
  const memberPicker = (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button onClick={() => setMlistTerbuka(o => !o)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            memberAktif ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}>
          <PersonBadge size={13} className={memberAktif ? 'text-emerald-600' : ''} />
          {memberAktif ? memberAktif.nama : 'Member'}
        </button>
        {memberAktif && (
          <button onClick={() => pilihMember(null)} title="Lepas member"
            className="p-1 text-gray-400 hover:text-red-500"><XLg size={12} /></button>
        )}
      </div>
      {mlistTerbuka && (
        <div className="absolute left-0 top-9 z-30 w-56 rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {anggota.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-gray-400">Belum ada member.<br />Buat di menu Member.</div>
            )}
            {anggota.map(m => (
              <button key={m.id} onClick={() => { pilihMember(m); setMlistTerbuka(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  memberAktif?.id === m.id ? 'bg-emerald-50' : ''
                }`}>
                <span className="text-gray-700">{m.nama}</span>
                <span className="text-[10px] text-gray-400">{m.telepon || ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // Tombol aksi bon gantung: simpan keranjang (jika isi) + buka daftar bon.
  const bonActions = (
    <div className="flex items-center gap-1.5">
      <button onClick={bukaSimpanBon} disabled={totalItem === 0}
        title="Gantung transaksi (butuh member aktif)"
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          totalItem === 0 ? 'cursor-not-allowed text-gray-300' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
        }`}>
        <BookmarkPlus size={13} /> Gantung
      </button>
      <button onClick={() => { setShowListBon(true); reloadBon() }}
        title="Daftar bon gantung"
        className={`relative flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
          bon.some(x => !x.selesai) ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}>
        <ListUl size={13} />
        {bon.some(x => !x.selesai) && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold">
            {bon.filter(x => !x.selesai).length}
          </span>
        )}
      </button>
    </div>
  )

  return (
    <>
      <ShiftBanner />
      {pesanSimpan && (
        <div className={`mx-4 mt-2 rounded-lg px-4 py-2 text-xs font-medium ${
          pesanSimpan.tipe === 'antri' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {pesanSimpan.teks}
        </div>
      )}

      {/* Desktop */}
      <div className="hidden md:grid grid-cols-[1fr_310px] gap-4 p-4 h-[calc(100vh-56px)]">
        <div className="flex flex-col gap-3 overflow-hidden">
          {/* Tab Produk / Lainnya */}
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            <button onClick={() => setTab('produk')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${tab === 'produk' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              Produk
            </button>
            <button onClick={() => setTab('lain')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${tab === 'lain' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
              <ThreeDots size={14} className="inline mr-1" />Lainnya
            </button>
          </div>

          {tab === 'produk' ? (
            <>
              <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
                <Search size={16} className="text-gray-400 shrink-0" />
                <input value={cari} onChange={e => setCari(e.target.value)}
                  placeholder="Cari produk atau barcode..." className="flex-1 bg-transparent outline-none text-sm" />
                <button onClick={() => setShowCamera(true)} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Scan barcode kamera">
                  <QrCodeScan size={18} />
                </button>
                <button onClick={() => setShowScanVisual(true)} className="p-1 text-gray-400 hover:text-purple-600 transition-colors" title="Scan produk visual (AI)">
                  <Camera size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {memberPicker}
                {bonActions}
                <div className="flex-1">{filterChips}</div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ProdukGrid produk={produkFiltered} loading={loading} onTambah={tambahKeKeranjang} />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <PenjualanLain onTambahKeKeranjang={tambahItemLain} />
            </div>
          )}
        </div>
        <KeranjangPanel {...keranjangProps} />
      </div>

      {/* Mobile */}
      <div className="md:hidden flex flex-col h-full p-3 gap-3">
        <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input value={cari} onChange={e => setCari(e.target.value)}
            placeholder="Cari produk..." className="flex-1 bg-transparent outline-none text-sm" />
          <button onClick={() => setShowCamera(true)} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors">
            <QrCodeScan size={18} />
          </button>
          <button onClick={() => setShowScanVisual(true)} className="p-1 text-gray-400 hover:text-purple-600 transition-colors" title="Scan visual AI">
            <Camera size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">{memberPicker}{bonActions}</div>
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          <button onClick={() => setTab('produk')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${tab === 'produk' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            Produk
          </button>
          <button onClick={() => setTab('lain')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${tab === 'lain' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            Lainnya
          </button>
        </div>
        {tab === 'produk' ? (
          <>
            {filterChips}
            <div className="flex-1 overflow-y-auto">
              <ProdukGrid produk={produkFiltered} loading={loading} onTambah={tambahKeKeranjang} />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <PenjualanLain onTambahKeKeranjang={tambahItemLain} />
          </div>
        )}
      </div>

      {/* Floating cart — mobile */}
      {!showCart && (
        <button onClick={() => setShowCart(true)}
          className="md:hidden fixed bottom-20 right-4 z-40 bg-indigo-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg active:scale-95 transition-transform">
          <Cart3 size={22} />
          {totalItem > 0 && (
            <span data-testid="cart-count" className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {totalItem}
            </span>
          )}
        </button>
      )}

      {/* Cart drawer — mobile */}
      {showCart && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800">Keranjang</span>
              <button onClick={() => setShowCart(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <XLg size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <KeranjangPanel {...keranjangProps} />
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <BarcodeCameraModal onScan={onBarcodeScan} onTutup={() => setShowCamera(false)} />
      )}
      {showScanVisual && (
        <ScanProdukVisual onPilih={pilihDariVisualScan} onClose={() => setShowScanVisual(false)} />
      )}
      {flashScan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-gray-800">Produk Baru (Barcode Tak Dikenal)</span>
              <button onClick={() => setFlashScan(null)} className="p-1.5 rounded-full hover:bg-gray-100">
                <XLg size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-sm font-mono text-gray-600 mb-4">
              {flashScan}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Nama Produk <span className="text-gray-300">(opsional)</span></label>
                <input
                  value={flashNama}
                  onChange={e => setFlashNama(e.target.value)}
                  placeholder="Contoh: Snack Baru"
                  autoFocus
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                {flashAutoNama === 'cek' && (
                  <p className="text-[10px] text-gray-400 mt-1">Mencari nama di Open Food Facts…</p>
                )}
                {typeof flashAutoNama === 'string' && (
                  <p className="text-[10px] text-green-600 mt-1"><CheckLg size={11} className="inline mr-1 -mt-0.5" />Nama ditemukan otomatis. Ubah kalau perlu.</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Harga (Rp) *</label>
                <input
                  type="number"
                  value={flashHarga}
                  onChange={e => setFlashHarga(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') buatDariFlashScan() }}
                  placeholder="0"
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setFlashScan(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Batal
              </button>
              <button
                onClick={buatDariFlashScan}
                disabled={!Number(flashHarga) || Number(flashHarga) <= 0}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                Buat & Tambah
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-3 text-center">
              Produk dibuat baru (stok 0) lalu dimasukkan ke keranjang.
            </p>
          </div>
        </div>
      )}
      {/* Modal simpan bon gantung */}
      {showSimpanBon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-800">Gantung Transaksi</span>
              <button onClick={() => setShowSimpanBon(false)} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} className="text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Keranjang ({totalItem} item, {fmt(total)}) digantung atas nama member berikut & bisa dilanjutkan kapan saja.</p>
            <label className="text-xs text-gray-500">Member</label>
            <div className="flex items-center gap-2 mt-1 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
              <PersonBadge size={16} className="text-emerald-600 shrink-0" />
              <span className="text-sm font-medium text-emerald-800">{memberAktif?.nama}</span>
            </div>
            {bonErr && <p className="text-sm text-red-600 mt-2">{bonErr}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowSimpanBon(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={konfirmSimpanBon} disabled={totalItem === 0 || !memberAktif}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">Gantung</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal daftar bon gantung */}
      {showListBon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="font-semibold text-gray-800">Bon Gantung</span>
              <div className="flex items-center gap-1">
                <button onClick={() => { reloadBon() }} className="p-1.5 rounded-full hover:bg-gray-100"><ListUl size={16} className="text-gray-500" /></button>
                <button onClick={() => setShowListBon(false)} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} className="text-gray-500" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {bonLoading && <div className="py-8 text-center text-sm text-gray-400">Memuat...</div>}
              {!bonLoading && bon.filter(x => !x.selesai).length === 0 && (
                <div className="py-8 text-center text-sm text-gray-400">Belum ada bon gantung aktif.<br />Gunakan tombol <b className="text-amber-600">Gantung</b> utk menyimpan keranjang.</div>
              )}
              {bon.filter(x => !x.selesai).map(b => {
                const jumlah = Object.values(b.produk).reduce((s, q) => s + q, 0)
                return (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{b.nama || `Bon #${b.id}`}</div>
                      <div className="text-xs text-gray-400">{jumlah} item · {fmt(b.total)}</div>
                    </div>
                    <button onClick={() => tarikBon(b)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">Tarik</button>
                    <button onClick={() => { if (confirm(`Hapus bon ${b.nama || '#'+b.id}?`)) hapusBon(b.id) }}
                      className="p-2 text-gray-400 hover:text-red-500"><Trash3 size={14} /></button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <StrukModal
        transaksi={struk}
        toko={{ nama: toko?.nama ?? '', alamat, telepon, catatan_struk }}
        onTutup={() => setStruk(null)}
      />
    </>
  )
}
