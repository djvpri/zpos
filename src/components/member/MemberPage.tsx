'use client'

import { useState } from 'react'
import { useKategoriMember, useMember, useHargaMember } from '@/hooks/useMember'
import { useProduk } from '@/hooks/useProduk'
import { fmt } from '@/lib/utils'
import { PersonBadge, Plus, PencilSquare, Trash, XLg, CheckCircleFill, ExclamationCircle, CashCoin } from 'react-bootstrap-icons'
import { KategoriMember, Member } from '@/types'

export default function MemberPage() {
  const { kategoriMember, tambah: tambahKat, update: updateKat, hapus: hapusKat } = useKategoriMember()
  const { anggota, tambah, update, hapus } = useMember()
  const { produk } = useProduk()
  const { setHarga, hapusHarga } = useHargaMember()

  // Modal atur harga tetap: kategori yang sedang dikelola + map produk→harga asli.
  const [aturKat, setAturKat] = useState<KategoriMember | null>(null)
  const [hargaTetap, setHargaTetap] = useState<Record<number, number>>({})
  const [inputHarga, setInputHarga] = useState<Record<number, string>>({})
  const [aturLoading, setAturLoading] = useState(false)
  const [aturSaving, setAturSaving] = useState<number | null>(null)

  const [tab, setTab] = useState<'kategori' | 'anggota'>('kategori')
  const [namaBaru, setNamaBaru] = useState('')
  const [diskonBaru, setDiskonBaru] = useState('')
  const [err, setErr] = useState('')
  const [fl, setFl] = useState('')

  // edit kategori inline
  const [editKat, setEditKat] = useState<KategoriMember | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editDiskon, setEditDiskon] = useState('')

  // modal member
  const [modalMember, setModalMember] = useState<'tambah' | Member | null>(null)
  const [mNama, setMNama] = useState('')
  const [mTelp, setMTelp] = useState('')
  const [mKat, setMKat] = useState('')
  const [mErr, setMErr] = useState('')

  function flash(m: string) { setFl(m); setTimeout(() => setFl(''), 2500) }

  async function buatKat() {
    setErr('')
    try {
      await tambahKat(namaBaru.trim(), Number(diskonBaru) || 0)
      setNamaBaru(''); setDiskonBaru('')
      flash('Kategori member ditambahkan')
    } catch (e) { setErr((e as Error).message) }
  }

  async function simpanKat() {
    if (!editKat) return
    setErr('')
    try {
      await updateKat(editKat.id, editNama.trim(), Number(editDiskon) || 0)
      setEditKat(null)
    } catch (e) { setErr((e as Error).message) }
  }

  async function hapusKatId(id: number) {
    if (!confirm('Hapus kategori member? Member terkait jadi tanpa kategori (harga normal).')) return
    await hapusKat(id)
  }

  // Buka modal atur harga tetap utk satu kategori. Muat harga tetap existing
  // (produk → harga) supaya input terisi.
  async function bukaAtur(k: KategoriMember) {
    setAturKat(k)
    setHargaTetap({})
    setInputHarga({})
    setAturLoading(true)
    try {
      const res = await fetch(`/api/harga-member?kategori_member_id=${k.id}&mode=tetap`)
      const map: Record<number, number> = res.ok ? await res.json() : {}
      setHargaTetap(map)
    } finally { setAturLoading(false) }
  }

  // Simpan/ubah harga tetap satu produk. Kosong/hapus → DELETE (reset ke diskon %/normal).
  async function simpanSatuHarga(produkId: number, raw: string) {
    if (!aturKat) return
    setAturSaving(produkId)
    try {
      const val = Number(raw)
      if (raw.trim() === '' || !Number.isFinite(val)) {
        await hapusHarga(produkId, aturKat.id)
        setHargaTetap(m => { const c = { ...m }; delete c[produkId]; return c })
      } else if (val > 0) {
        await setHarga(produkId, aturKat.id, val)
        setHargaTetap(m => ({ ...m, [produkId]: val }))
      }
      setInputHarga(p => { const c = { ...p }; delete c[produkId]; return c })
    } finally { setAturSaving(null) }
  }

  function bukaMember(m?: Member) {
    setModalMember(m ?? 'tambah')
    setMNama(m?.nama ?? '')
    setMTelp(m?.telepon ?? '')
    setMKat(m?.kategori_member_id ? String(m.kategori_member_id) : '')
    setMErr('')
  }

  async function simpanMember() {
    setMErr('')
    const payload = { nama: mNama.trim(), telepon: mTelp.trim() || null, kategori_member_id: mKat ? Number(mKat) : null }
    try {
      if (modalMember === 'tambah') await tambah(payload)
      else if (modalMember) await update(modalMember.id, payload)
      setModalMember(null)
      flash('Member tersimpan')
    } catch (e) { setMErr((e as Error).message) }
  }

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400'

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <h1 className="text-lg font-bold text-gray-800 mb-1">Member</h1>
      <p className="text-sm text-gray-500 mb-4">Kelompokkan pelanggan & beri harga khusus per kategori member (dipakai di kasir).</p>

      {fl && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircleFill size={14} /> {fl}
        </div>
      )}
      {err && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
          <ExclamationCircle size={16} className="mt-0.5 shrink-0" /> {err}
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-2 mb-4">
        {([['kategori', 'Kategori Member'], ['anggota', `Member (${anggota.length})`]] as const).map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>{lbl}</button>
        ))}
      </div>

      {tab === 'kategori' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            {kategoriMember.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm"><PersonBadge size={32} className="mx-auto mb-2 opacity-40" />Belum ada kategori member</div>
            )}
            {kategoriMember.map(k => (
              <div key={k.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-sm">
                {editKat?.id === k.id ? (
                  <>
                    <input className="border border-indigo-300 rounded-lg px-2 py-1 flex-1" value={editNama} onChange={e => setEditNama(e.target.value)} placeholder="Nama kategori" />
                    <input className="border border-indigo-300 rounded-lg px-2 py-1 w-24" type="number" value={editDiskon} onChange={e => setEditDiskon(e.target.value)} title="Diskon %" />
                    <button onClick={simpanKat} className="px-2 py-1 rounded-lg bg-indigo-600 text-white text-xs font-semibold">Simpan</button>
                    <button onClick={() => setEditKat(null)} className="p-1 text-gray-400 hover:text-gray-600"><XLg size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="font-medium text-gray-800 flex-1">{k.nama}</span>
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                      {k.diskon_persen > 0 ? `diskon ${k.diskon_persen}%` : 'tanpa diskon'}
                    </span>
                    <button onClick={() => bukaAtur(k)} title="Atur harga tetap per produk"
                      className="p-1.5 text-gray-400 hover:text-emerald-600"><CashCoin size={16} /></button>
                    <button onClick={() => { setEditKat(k); setEditNama(k.nama); setEditDiskon(String(k.diskon_persen)) }}
                      className="p-1.5 text-gray-400 hover:text-indigo-600"><PencilSquare size={16} /></button>
                    <button onClick={() => hapusKatId(k.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash size={16} /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Tambah kategori */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap gap-3 items-center">
            <input className={inp + ' flex-1 min-w-[180px]'} value={namaBaru} onChange={e => setNamaBaru(e.target.value)} placeholder="Nama kategori (mis. Grosir)" />
            <input className={inp + ' w-32'} type="number" value={diskonBaru} onChange={e => setDiskonBaru(e.target.value)} placeholder="Diskon %" />
            <button onClick={buatKat} disabled={!namaBaru.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              <Plus size={16} /> Tambah
            </button>
          </div>
        </div>
      )}

      {tab === 'anggota' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            {anggota.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">Belum ada member. Tambahkan member & tetapkan kategori.</div>
            )}
            {anggota.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 text-sm">
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{m.nama}</div>
                  <div className="text-xs text-gray-400">{m.telepon || '—'}</div>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  {m.kategori_member_id ? (kategoriMember.find(k => k.id === m.kategori_member_id)?.nama ?? '—') : 'Tanpa kategori'}
                </span>
                <button onClick={() => bukaMember(m)} className="p-1.5 text-gray-400 hover:text-indigo-600"><PencilSquare size={16} /></button>
                <button onClick={() => { if (confirm(`Hapus member ${m.nama}?`)) hapus(m.id) }}
                  className="p-1.5 text-gray-400 hover:text-red-500"><Trash size={16} /></button>
              </div>
            ))}
          </div>
          <button onClick={() => bukaMember()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700">
            <Plus size={16} /> Tambah Member
          </button>
        </div>
      )}

      {/* Modal tambah/edit member */}
      {modalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{modalMember === 'tambah' ? 'Tambah Member' : 'Edit Member'}</h3>
              <button onClick={() => setModalMember(null)} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Nama</label>
                <input className={inp} value={mNama} onChange={e => setMNama(e.target.value)} placeholder="Nama member" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Telepon</label>
                <input className={inp} value={mTelp} onChange={e => setMTelp(e.target.value)} placeholder="Nomor telepon / kode member" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Kategori Member</label>
                <select className={inp} value={mKat} onChange={e => setMKat(e.target.value)}>
                  <option value="">Tanpa kategori (harga normal)</option>
                  {kategoriMember.map(k => <option key={k.id} value={k.id}>{k.nama}{k.diskon_persen > 0 ? ` (-${k.diskon_persen}%)` : ''}</option>)}
                </select>
              </div>
              {mErr && <p className="text-sm text-red-600">{mErr}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setModalMember(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
                <button onClick={simpanMember} disabled={!mNama.trim()}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal atur harga tetap per produk untuk satu kategori */}
      {aturKat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-800">Harga Member — {aturKat.nama}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Harga tetap menang atas diskon {aturKat.diskon_persen}%. Kosongkan untuk reset ke diskon/normal.
                </p>
              </div>
              <button onClick={() => setAturKat(null)} className="p-1.5 rounded-full hover:bg-gray-100"><XLg size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {aturLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Memuat...</div>
              ) : produk.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Tidak ada produk.</div>
              ) : (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 text-[10px] font-medium text-gray-500 uppercase border-b border-gray-100">
                    <span className="col-span-6">Produk</span>
                    <span className="col-span-3">Harga Normal</span>
                    <span className="col-span-3">Harga Member</span>
                  </div>
                  {produk.map(p => {
                    const fixed = hargaTetap[p.id]
                    const editing = inputHarga[p.id] !== undefined
                    return (
                      <div key={p.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-gray-50 last:border-0">
                        <span className="col-span-6 text-sm text-gray-700 truncate">{p.nama}</span>
                        <span className="col-span-3 text-sm text-gray-400">{fmt(p.harga)}</span>
                        <div className="col-span-3 flex items-center gap-1">
                          {editing ? (
                            <>
                              <input
                                autoFocus
                                className="w-full border border-indigo-300 rounded-lg px-2 py-1 text-sm focus:outline-none"
                                type="number" value={inputHarga[p.id]}
                                onChange={e => setInputHarga(m => ({ ...m, [p.id]: e.target.value }))}
                                onBlur={e => simpanSatuHarga(p.id, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') simpanSatuHarga(p.id, (e.target as HTMLInputElement).value)
                                  if (e.key === 'Escape') setInputHarga(m => { const c = { ...m }; delete c[p.id]; return c })
                                }}
                              />
                              {aturSaving === p.id && <span className="text-xs text-gray-400">...</span>}
                            </>
                          ) : (
                            <button
                              onClick={() => setInputHarga(m => ({ ...m, [p.id]: fixed !== undefined ? String(fixed) : '' }))}
                              className={`w-full text-left rounded-lg px-2 py-1 text-sm border ${fixed !== undefined ? 'border-emerald-200 bg-emerald-50 text-emerald-700 font-medium' : 'border-dashed border-gray-200 text-gray-300 hover:border-indigo-300 hover:text-gray-400'}`}
                              title="Klik untuk set harga tetap"
                            >
                              {fixed !== undefined ? fmt(fixed) : 'atur'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
