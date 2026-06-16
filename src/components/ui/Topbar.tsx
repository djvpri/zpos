'use client'

const LABEL: Record<string, string> = {
  kasir: 'Kasir',
  produk: 'Manajemen Produk',
  laporan: 'Laporan Penjualan',
}

interface Props {
  halaman: string
}

export function Topbar({ halaman }: Props) {
  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 shrink-0">
      <span className="font-semibold text-gray-800">{LABEL[halaman] || halaman}</span>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-indigo-100">
          K1
        </div>
        <div>
          <div className="text-sm font-medium text-gray-700 leading-tight">Kasir 1</div>
          <div className="text-xs text-gray-400">Shift Pagi</div>
        </div>
      </div>
    </header>
  )
}
