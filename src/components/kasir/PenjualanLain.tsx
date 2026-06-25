'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ShoppingCart, Pencil, X, Check, Settings2 } from 'lucide-react'

interface ItemLain {
  id: string
  nama: string
  harga: number
  qty: number
}

interface Preset {
  id: string
  nama: string
  harga: number
}

interface Props {
  onTambahKeKeranjang: (items: ItemLain[]) => void
}

const PRESET_DEFAULT: Preset[] = [
  { id: 'p1', nama: 'Jasa Servis', harga: 0 },
  { id: 'p2', nama: 'Fotokopi', harga: 500 },
  { id: 'p3', nama: 'Print Hitam', harga: 1000 },
  { id: 'p4', nama: 'Print Warna', harga: 2500 },
  { id: 'p5', nama: 'Laminating', harga: 5000 },
  { id: 'p6', nama: 'Jilid', harga: 5000 },
]

const STORAGE_KEY = 'zpos_preset_lain'

function loadPreset(): Preset[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : PRESET_DEFAULT
  } catch { return PRESET_DEFAULT }
}

function savePreset(preset: Preset[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preset)) } catch {}
}

const fmt = (n: number) => n > 0 ? 'Rp ' + n.toLocaleString('id-ID') : 'Harga bebas'

export default function PenjualanLain({ onTambahKeKeranjang }: Props) {
  const [items, setItems] = useState<ItemLain[]>([])
  const [nama, setNama] = useState('')
  const [harga, setHarga] = useState('')
  const [qty, setQty] = useState('1')
  const [preset, setPreset] = useState<Preset[]>(PRESET_DEFAULT)
  const [kelolaPreset, setKelolaPreset] = useState(false)
  const [editPresetId, setEditPresetId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editHarga, setEditHarga] = useState('')
  const [tambahPresetNama, setTambahPresetNama] = useState('')
  const [tambahPresetHarga, setTambahPresetHarga] = useState('')

  useEffect(() => { setPreset(loadPreset()) }, [])

  function updatePreset(newPreset: Preset[]) {
    setPreset(newPreset)
    savePreset(newPreset)
  }

  function hapusPreset(id: string) {
    updatePreset(preset.filter(p => p.id !== id))
  }

  function simpanEditPreset(id: string) {
    if (!editNama.trim()) return
    updatePreset(preset.map(p => p.id === id ? { ...p, nama: editNama.trim(), harga: Number(editHarga) || 0 } : p))
    setEditPresetId(null)
  }

  function tambahPreset() {
    if (!tambahPresetNama.trim()) return
    const newP: Preset = { id: `p${Date.now()}`, nama: tambahPresetNama.trim(), harga: Number(tambahPresetHarga) || 0 }
    updatePreset([...preset, newP])
    setTambahPresetNama(''); setTambahPresetHarga('')
  }

  function tambahItem(n: string, h: number, q: number = 1) {
    if (!n.trim()) return
    setItems(prev => [...prev, { id: `lain-${Date.now()}-${Math.random()}`, nama: n.trim(), harga: h, qty: q }])
    setNama(''); setHarga(''); setQty('1')
  }

  function hapusItem(id: string) { setItems(prev => prev.filter(i => i.id !== id)) }

  function ubahQty(id: string, delta: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i))
  }

  function ubahHarga(id: string, val: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, harga: Number(val) || 0 } : i))
  }

  const total = items.reduce((s, i) => s + i.harga * i.qty, 0)

  function masukKanKeranjang() {
    if (items.length === 0) return
    onTambahKeKeranjang(items)
    setItems([])
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Penjualan Lainnya</h2>
        <button onClick={() => setKelolaPreset(!kelolaPreset)}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${kelolaPreset ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Settings2 size={12} /> Kelola Preset
        </button>
      </div>

      {/* Mode Kelola Preset */}
      {kelolaPreset ? (
        <div className="flex-1 overflow-y-auto space-y-2">
          {preset.map(p => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-2.5">
              {editPresetId === p.id ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input value={editNama} onChange={e => setEditNama(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                      placeholder="Nama" />
                    <input type="number" value={editHarga} onChange={e => setEditHarga(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-400"
                      placeholder="Harga (0 = bebas)" inputMode="numeric" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => simpanEditPreset(p.id)}
                      className="rounded-lg bg-green-500 p-1.5 text-white hover:bg-green-600">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditPresetId(null)}
                      className="rounded-lg bg-gray-200 p-1.5 text-gray-600 hover:bg-gray-300">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-gray-800">{p.nama}</div>
                    <div className="text-[10px] text-gray-400">{fmt(p.harga)}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditPresetId(p.id); setEditNama(p.nama); setEditHarga(String(p.harga)) }}
                      className="rounded-lg bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => hapusPreset(p.id)}
                      className="rounded-lg bg-red-50 p-1.5 text-red-500 hover:bg-red-100">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Tambah preset baru */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-gray-400">+ Tambah Preset Baru</p>
            <div className="space-y-1.5">
              <input value={tambahPresetNama} onChange={e => setTambahPresetNama(e.target.value)}
                placeholder="Nama preset..."
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none" />
              <div className="flex gap-2">
                <input type="number" value={tambahPresetHarga} onChange={e => setTambahPresetHarga(e.target.value)}
                  placeholder="Harga (0 = bebas)" inputMode="numeric"
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none" />
                <button onClick={tambahPreset} disabled={!tambahPresetNama.trim()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700 disabled:opacity-40 transition">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

      ) : (
        /* Mode Normal */
        <>
          {/* Preset cepat */}
          <div className="mb-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Preset Cepat</p>
            <div className="flex flex-wrap gap-1.5">
              {preset.map(p => (
                <button key={p.id} onClick={() => tambahItem(p.nama, p.harga)}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition active:scale-95">
                  {p.nama}{p.harga > 0 ? ` • Rp ${p.harga.toLocaleString('id-ID')}` : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Form tambah manual */}
          <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">Tambah Manual</p>
            <div className="flex flex-col gap-2">
              <input value={nama} onChange={e => setNama(e.target.value)}
                placeholder="Nama item / jasa..."
                onKeyDown={e => e.key === 'Enter' && tambahItem(nama, Number(harga), Number(qty) || 1)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" />
              <div className="flex gap-2">
                <input type="number" value={harga} onChange={e => setHarga(e.target.value)}
                  placeholder="Harga (Rp)" inputMode="numeric"
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" />
                <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                  placeholder="Qty" min="1"
                  className="w-16 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400" />
                <button onClick={() => tambahItem(nama, Number(harga), Number(qty) || 1)}
                  disabled={!nama.trim()}
                  className="rounded-lg bg-gray-900 px-3 py-2 text-white hover:bg-gray-700 disabled:opacity-40 transition">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Daftar item */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                Belum ada item — pilih preset atau tambah manual
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">{item.nama}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <input type="number" value={item.harga}
                          onChange={e => ubahHarga(item.id, e.target.value)}
                          className="w-28 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700 outline-none"
                          inputMode="numeric" />
                        <span className="text-[10px] text-gray-400">× {item.qty} = Rp {(item.harga * item.qty).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => ubahQty(item.id, -1)}
                        className="h-6 w-6 rounded-full border border-gray-200 text-xs text-gray-500 hover:bg-gray-100 flex items-center justify-center">−</button>
                      <span className="w-5 text-center text-xs font-medium">{item.qty}</span>
                      <button onClick={() => ubahQty(item.id, 1)}
                        className="h-6 w-6 rounded-full border border-gray-200 text-xs text-gray-500 hover:bg-gray-100 flex items-center justify-center">+</button>
                      <button onClick={() => hapusItem(item.id)}
                        className="ml-1 h-6 w-6 rounded-full text-red-400 hover:bg-red-50 flex items-center justify-center">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-gray-500">{items.length} item</span>
                <span className="font-semibold text-gray-900">Rp {total.toLocaleString('id-ID')}</span>
              </div>
              <button onClick={masukKanKeranjang}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 transition">
                <ShoppingCart size={16} /> Masukkan ke Keranjang
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
