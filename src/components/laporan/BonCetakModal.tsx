'use client'

import { useEffect } from 'react'
import { fmt } from '@/lib/utils'
import { Printer, X } from 'react-bootstrap-icons'
import { BonNota, BonGrup, BonItem } from '@/components/laporan/BonNotaModal'

/** Satu baris ringkasan bon (tak perlu rincian item). */
export interface BonBaris {
  id: number
  nama: string | null
  produk: Record<string, number>
  total: number
  selesai: boolean
  created_at: string
  dibayar_at: string | null
}

interface Props {
  daftar: BonBaris[]
  /** Rincian per bon (dari /api/bon/{id}/nota); bon yg gagal dimuat tak ada di sini. */
  detail: Map<number, BonNota>
  namaToko: string
  alamat?: string
  telepon?: string
  onTutup: () => void
}

const fmtDT = (d: string) => new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })

// Modal cetak bon gantung — pola sama LaporanStrukModal: CSS @media print supaya
// hanya area ini yang tercetak, lalu user pilih "Save as PDF" di dialog cetak
// (0 dependensi PDF tambahan). Rincian mengikuti `grup` bila ada (harga per
// kiriman), fallback `items` seragam.
export function BonCetakModal({ daftar, detail, namaToko, alamat, telepon, onTutup }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => !e.repeat && e.key === 'Escape' && onTutup()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTutup])

  const totalSemua = daftar.reduce((s, b) => s + Number(b.total || 0), 0)

  return (
    <div className="fixed inset-0 bg-black/50 flex overflow-y-auto z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onTutup() }}>
      <div className="bg-white rounded-xl w-[26rem] max-w-full shadow-xl overflow-hidden m-auto">
        <style>{`
          @media screen { .x-bon-print-area { display: none; } }
          @media print {
            body > *:not(.x-bon-modal) { visibility: hidden; }
            .x-bon-modal, .x-bon-modal * { visibility: visible !important; }
            .x-bon-modal { position: absolute; left: 0; top: 0; width: 100%; }
            .x-bon-no-print { display: none !important; }
            .x-bon-print-area { display: block !important; }
            .x-bon-item { break-inside: avoid; page-break-inside: avoid; }
          }
          @page { margin: 12mm; }
        `}</style>

        <div className="x-bon-modal">
          {/* ===== Area yang dicetak ===== */}
          <div className="x-bon-print-area p-6 font-mono text-sm bg-white text-black">
            <div className="text-center mb-4">
              <div className="text-base font-bold">{namaToko || 'Toko'}</div>
              {alamat && <div className="text-xs text-gray-500 mt-0.5 leading-snug">{alamat}</div>}
              {telepon && <div className="text-xs text-gray-500">Tel: {telepon}</div>}
              <div className="border-b border-dashed border-gray-300 my-3" />
              <div className="text-xs font-semibold">DAFTAR BON GANTUNG</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {daftar.length} bon · dicetak {new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>

            {daftar.length === 0 && <div className="text-center text-gray-400 py-6">Tidak ada bon</div>}

            {daftar.map(b => {
              const d = detail.get(b.id)
              return (
                <div key={b.id} className="x-bon-item mb-5 pb-4 border-b border-dashed border-gray-300 last:border-0">
                  <div className="flex justify-between font-bold">
                    <span>Bon Gantung #{b.id}</span>
                    <span>{fmt(d?.total ?? b.total)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {b.nama || 'Tanpa member'} · {b.selesai ? 'Selesai' : 'Belum Dibayar'} · {b.created_at ? fmtDT(b.created_at) : ''}
                  </div>

                  {d?.grup && d.grup.length > 0 ? (
                    d.grup.map((g: BonGrup, gi: number) => (
                      <div key={gi} className="mt-2">
                        <div className="text-[11px] text-gray-500">
                          Grup {gi + 1} — {g.waktu ? fmtDT(g.waktu) : `Kiriman ${gi + 1}`}
                        </div>
                        {g.items.map((it: BonItem, ii: number) => (
                          <div key={ii} className="flex justify-between text-[12px]">
                            <span className="truncate pr-2">{it.nama} {it.qty}x{it.harga}</span>
                            <span className="tabular-nums">{fmt(it.subtotal)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-[11px] text-gray-500">
                          <span>Subtotal grup</span><span className="tabular-nums">{fmt(g.subtotal)}</span>
                        </div>
                      </div>
                    ))
                  ) : d?.items && d.items.length > 0 ? (
                    d.items.map((it: BonItem, ii: number) => (
                      <div key={ii} className="flex justify-between text-[12px] mt-1">
                        <span className="truncate pr-2">{it.nama} {it.qty}x{it.harga}</span>
                        <span className="tabular-nums">{fmt(it.subtotal)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-gray-400 mt-1 italic">Rincian tidak tersedia</div>
                  )}
                </div>
              )
            })}

            {daftar.length > 0 && (
              <div className="border-t border-gray-300 pt-3 flex justify-between font-bold text-base">
                <span>TOTAL {daftar.length} BON</span><span className="tabular-nums">{fmt(totalSemua)}</span>
              </div>
            )}
          </div>

          {/* ===== Kontrol (tidak dicetak) ===== */}
          <div className="x-bon-no-print p-3 border-t border-gray-100 space-y-2">
            <button onClick={() => window.print()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              <Printer size={15} /> Cetak / Simpan PDF
            </button>
            <button onClick={onTutup}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
              <X size={15} /> Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
