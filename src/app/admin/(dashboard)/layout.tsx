'use client'

import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Shop, Wallet2, GraphUp, ChatSquareDots, BoxArrowRight } from 'react-bootstrap-icons'

const MENU = [
  { href: '/admin', label: 'Member', icon: Shop },
  { href: '/admin/pulsa', label: 'Kelola Pulsa', icon: Wallet2 },
  { href: '/admin/pricelist', label: 'Harga Pulsa', icon: GraphUp },
  { href: '/admin/laporan-digital', label: 'Penjualan Pulsa', icon: ChatSquareDots },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  const aktif = (href: string) => pathname === href || (href !== '/admin' && pathname.startsWith(href + '/'))

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-gray-900 text-white flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-white/10">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <span className="font-bold">Z1 Pos Admin</span>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {MENU.map((m) => {
            const Icon = m.icon
            const on = aktif(m.href)
            return (
              <a
                key={m.href}
                href={m.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  on ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={17} />
                {m.label}
              </a>
            )
          })}
        </nav>
        <div className="p-2 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <BoxArrowRight size={17} /> Keluar
          </button>
        </div>
      </aside>

      {/* Konten */}
      <div className="flex-1 ml-60">
        <main className="px-4 sm:px-6 py-6 max-w-6xl">{children}</main>
      </div>
    </div>
  )
}
