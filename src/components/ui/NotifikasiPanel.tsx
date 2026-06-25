'use client'
import { useState, useEffect } from 'react'
import { Bell, X, AlertTriangle, Package, Calendar, ChevronDown, ChevronUp } from 'lucide-react'

interface Produk { id: number; nama: string; stok: number; stok_minimum?: number; expired_at?: string; sisa_hari?: number; foto_url?: string }
interface Notifikasi { stokMenipis: Produk[]; stokHabis: Produk[]; mauKadaluarsa: Produk[]; sudahKadaluarsa: Produk[]; total: number }

export default function NotifikasiPanel() {
  const [data, setData] = useState<Notifikasi | null>(null)
  const [open, setOpen] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/notifikasi').then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d) }).catch(() => {})
    const interval = setInterval(() => {
      fetch('/api/notifikasi').then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d) }).catch(() => {})
    }, 5 * 60 * 1000) // refresh tiap 5 menit
    return () => clearInterval(interval)
  }, [])

  if (!data || data.total === 0) return null

  const toggle = (s: string) => setExpandedSection(prev => prev === s ? null : s)

  return (
    <>
      {/* Tombol Bell */}
      <button onClick={() => setOpen(true)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition">
        <Bell size={18} className="text-gray-600" />
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
          {data.total > 99 ? '99+' : data.total}
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="w-full max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-orange-500" />
                <span className="text-sm font-semibold text-gray-800">Notifikasi</span>
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{data.total}</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-gray-100">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3 space-y-2">

              {/* Sudah Kadaluarsa */}
              {data.sudahKadaluarsa.length > 0 && (
                <Section
                  icon={<Calendar size={14} className="text-red-500" />}
                  title="Sudah Kadaluarsa"
                  count={data.sudahKadaluarsa.length}
                  color="red"
                  expanded={expandedSection === 'expired'}
                  onToggle={() => toggle('expired')}>
                  {data.sudahKadaluarsa.map(p => (
                    <ProdukRow key={p.id} produk={p}
                      badge={<span className="text-[10px] text-red-600 font-medium">Kadaluarsa {fmt(p.expired_at!)}</span>} />
                  ))}
                </Section>
              )}

              {/* Mau Kadaluarsa */}
              {data.mauKadaluarsa.length > 0 && (
                <Section
                  icon={<Calendar size={14} className="text-orange-500" />}
                  title="Hampir Kadaluarsa"
                  count={data.mauKadaluarsa.length}
                  color="orange"
                  expanded={expandedSection === 'nearexpired'}
                  onToggle={() => toggle('nearexpired')}>
                  {data.mauKadaluarsa.map(p => (
                    <ProdukRow key={p.id} produk={p}
                      badge={<span className="text-[10px] text-orange-600 font-medium">{p.sisa_hari} hari lagi · {fmt(p.expired_at!)}</span>} />
                  ))}
                </Section>
              )}

              {/* Stok Habis */}
              {data.stokHabis.length > 0 && (
                <Section
                  icon={<Package size={14} className="text-red-500" />}
                  title="Stok Habis"
                  count={data.stokHabis.length}
                  color="red"
                  expanded={expandedSection === 'habis'}
                  onToggle={() => toggle('habis')}>
                  {data.stokHabis.map(p => (
                    <ProdukRow key={p.id} produk={p}
                      badge={<span className="text-[10px] text-red-600 font-bold">HABIS</span>} />
                  ))}
                </Section>
              )}

              {/* Stok Menipis */}
              {data.stokMenipis.length > 0 && (
                <Section
                  icon={<AlertTriangle size={14} className="text-yellow-500" />}
                  title="Stok Menipis"
                  count={data.stokMenipis.length}
                  color="yellow"
                  expanded={expandedSection === 'menipis'}
                  onToggle={() => toggle('menipis')}>
                  {data.stokMenipis.map(p => (
                    <ProdukRow key={p.id} produk={p}
                      badge={<span className="text-[10px] text-yellow-600 font-medium">Sisa {p.stok} pcs</span>} />
                  ))}
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ icon, title, count, color, expanded, onToggle, children }: any) {
  const colors: any = {
    red: 'bg-red-50 border-red-100',
    orange: 'bg-orange-50 border-orange-100',
    yellow: 'bg-yellow-50 border-yellow-100',
  }
  return (
    <div className={`rounded-xl border ${colors[color]} overflow-hidden`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-gray-700">{title}</span>
          <span className="bg-white rounded-full px-1.5 py-0.5 text-[10px] font-bold text-gray-600 border">{count}</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {expanded && <div className="px-3 pb-2.5 space-y-1.5">{children}</div>}
    </div>
  )
}

function ProdukRow({ produk, badge }: { produk: Produk; badge: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-100">
      {produk.foto_url
        ? <img src={produk.foto_url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
        : <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm">📦</div>
      }
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-800 truncate">{produk.nama}</div>
        {badge}
      </div>
    </div>
  )
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
