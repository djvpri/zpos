'use client'

import { getDesainNota } from '@/lib/desain-nota'

// Contoh transaksi utk preview — warna/isi statis, tengok gaya nota asli.
const SAMPLE = {
  namaToko: 'Z1 Kasir',
  alamat: 'Jl. Merdeka No. 10',
  no: 'TRX-20260824-0001',
  tgl: '24/08/2026 14:05',
  kasir: 'Budi',
  metode: 'QRIS',
  items: [
    { nama: 'Kopi Susu Gula Aren', qty: 1, harga: 15000 },
    { nama: 'Roti Bakar Coklat', qty: 2, harga: 24000 },
  ],
  subtotal: 39000,
  diskon: 2000,
  total: 37000,
  bayar: 50000,
  kembali: 13000,
}

export function NotaPreview({ desain }: { desain: string }) {
  const tpl = getDesainNota(desain)
  const rp = (v: number) => 'Rp ' + v.toLocaleString('id-ID')
  const div = tpl.dividerStyle === 'solid'
    ? { borderTop: '1px solid #000' } as const
    : { borderTop: '1px dashed #000' } as const
  const infoRow = (k: string, v: string) => (
    <div className="flex justify-between text-[10px]">
      <span>{k}</span><span>{v}</span>
    </div>
  )
  const infoBlok = (
    <div className="space-y-px">
      {infoRow('No', SAMPLE.no)}
      {infoRow('Tgl', SAMPLE.tgl)}
      {tpl.showKsr && infoRow('Ksr', SAMPLE.kasir)}
      {infoRow('Pay', SAMPLE.metode)}
    </div>
  )
  const ringkas = (
    <div className="space-y-px text-[10px]">
      <div className="flex justify-between"><span>Subtotal</span><span>{rp(SAMPLE.subtotal)}</span></div>
      <div className="flex justify-between"><span>Diskon</span><span>-{rp(SAMPLE.diskon)}</span></div>
    </div>
  )
  const totalRow = (
    <div className="flex justify-between font-bold text-[11px] py-0.5" style={{ borderTop: '1px dashed', borderBottom: '1px dashed' }}>
      <span>TOTAL</span><span>{rp(SAMPLE.total)}</span>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="text-[11px] font-medium text-gray-500 mb-2">Pratinjau — {tpl.label}</div>
      <div className="mx-auto w-[248px] bg-white rounded-sm p-3 font-mono text-[10px] leading-snug text-neutral-900"
        style={{ boxShadow: '0 0 0 1px #eee' }}>
        <div className="text-center font-bold text-[12px]">{SAMPLE.namaToko}</div>
        <div className="text-center text-neutral-500 text-[9px]">{SAMPLE.alamat}</div>

        <div className="my-1.5" style={div} />

        {tpl.infoSebelumItems && infoBlok}
        {tpl.infoSebelumItems && <div className="my-1.5" style={div} />}

        <div className="space-y-1">
          {SAMPLE.items.map(it => (
            <div key={it.nama} className="flex justify-between gap-1">
              <span className="truncate">{it.nama}{it.qty > 1 ? <span className="text-neutral-400"> x{it.qty}</span> : ''}</span>
              <span className="flex-shrink-0">{rp(it.harga * it.qty)}</span>
            </div>
          ))}
        </div>

        <div className="my-1.5" style={div} />

        {tpl.totalPertama && totalRow}
        {ringkas}
        {!tpl.totalPertama && totalRow}

        {!tpl.infoSebelumItems && <div className="my-1.5" style={div} />}
        {!tpl.infoSebelumItems && infoBlok}

        <div className="flex justify-between text-[10px]"><span>Bayar</span><span>{rp(SAMPLE.bayar)}</span></div>
        <div className="flex justify-between text-[10px]"><span>Kembalian</span><span>{rp(SAMPLE.kembali)}</span></div>

        <div className="my-1.5" style={div} />

        <div className="text-center text-neutral-500 text-[9px]">*** TERIMA KASIH ***</div>
        {tpl.footerPowered && (
          <div className="text-center text-neutral-400 text-[8px] mt-px">Powered by Z1 Pos</div>
        )}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">
        Contoh tampilan. Nota asli mengikuti data transaksi &amp; setting toko.
      </p>
    </div>
  )
}
