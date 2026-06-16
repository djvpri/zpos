import Link from 'next/link'
import { ShoppingCart, BarChart3, Package, Smartphone, Users, Zap, Check } from 'lucide-react'

const features = [
  { icon: ShoppingCart, title: 'Kasir Digital', desc: 'Proses transaksi cepat dengan tampilan yang intuitif. Support tunai, QRIS, dan transfer.' },
  { icon: Package, title: 'Manajemen Produk', desc: 'Tambah, edit, dan kelola produk dengan mudah. Stok otomatis berkurang saat transaksi.' },
  { icon: BarChart3, title: 'Laporan Penjualan', desc: 'Pantau performa toko dengan laporan harian, produk terlaris, dan riwayat transaksi.' },
  { icon: Smartphone, title: 'Mobile Friendly', desc: 'Akses dari HP atau tablet kapan saja. Tampilan responsif untuk semua ukuran layar.' },
  { icon: Users, title: 'Multi Toko', desc: 'Daftarkan beberapa toko dengan akun berbeda. Data setiap toko terisolasi dan aman.' },
  { icon: Zap, title: 'Cepat & Ringan', desc: 'Dibangun dengan teknologi modern. Tidak perlu install aplikasi, cukup buka browser.' },
]

const plans = [
  {
    name: 'Trial',
    price: 'Gratis',
    period: '30 hari',
    border: 'border-gray-200',
    badge: null,
    pro: false,
    items: ['Semua fitur kasir', 'Manajemen produk', 'Laporan penjualan', 'Akses mobile', 'Maksimal 100 produk'],
  },
  {
    name: 'Pro',
    price: 'Rp 99.000',
    period: '/bulan',
    border: 'border-indigo-500',
    badge: 'Populer',
    pro: true,
    items: ['Semua fitur Trial', 'Produk tidak terbatas', 'Laporan lengkap', 'Prioritas support', 'Update fitur terbaru'],
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">Z</span>
            </div>
            <span className="font-bold text-gray-900">ZPos</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors px-2 py-1">
              Masuk
            </Link>
            <Link href="/register" className="text-sm bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap">
              Daftar Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-14 sm:pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 sm:mb-6">
          <Zap size={12} />
          Aplikasi POS untuk UMKM Indonesia
        </div>

        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-4 sm:mb-6">
          Kelola Toko Lebih<br />
          <span className="text-indigo-600">Mudah & Cepat</span>
        </h1>

        <p className="text-base sm:text-lg text-gray-500 max-w-xl mx-auto mb-8 sm:mb-10 px-2">
          Aplikasi kasir digital yang simpel, mobile-friendly, dan terjangkau.
          Cocok untuk warung, kafe, toko kelontong, dan UMKM lainnya.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center px-6 sm:px-0">
          <Link href="/register" className="px-7 py-3.5 bg-indigo-600 text-white rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-center">
            Mulai Gratis 30 Hari
          </Link>
          <Link href="/login" className="px-7 py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold text-sm hover:bg-gray-200 transition-colors text-center">
            Sudah punya akun? Masuk
          </Link>
        </div>

        {/* Desktop app preview */}
        <div className="hidden sm:block mt-16 bg-gray-50 rounded-3xl border border-gray-100 p-4 max-w-4xl mx-auto shadow-xl shadow-gray-100">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="w-3 h-3 rounded-full bg-red-300" />
              <div className="w-3 h-3 rounded-full bg-yellow-300" />
              <div className="w-3 h-3 rounded-full bg-green-300" />
              <div className="flex-1 bg-white rounded-lg text-xs text-gray-400 text-center py-1 mx-4 truncate">
                zpos.up.railway.app/app
              </div>
            </div>
            <div className="grid grid-cols-[56px_1fr_200px] h-56">
              <div className="bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">Z</span>
                </div>
                {[ShoppingCart, Package, BarChart3].map((Icon, i) => (
                  <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? 'bg-indigo-50 text-indigo-600' : 'text-gray-300'}`}>
                    <Icon size={16} />
                  </div>
                ))}
              </div>
              <div className="p-3 bg-gray-50">
                <div className="grid grid-cols-3 gap-2">
                  {['🍳','🍜','🧊','🍊','☕','🍗'].map((e, i) => (
                    <div key={i} className="bg-white rounded-xl p-2 flex flex-col items-center gap-1.5">
                      <span className="text-xl">{e}</span>
                      <div className="w-full h-1.5 bg-gray-100 rounded" />
                      <div className="w-2/3 h-1.5 bg-indigo-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-l border-gray-100 p-3 flex flex-col gap-2">
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="flex-1 space-y-2.5 pt-1">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="w-5 h-5 bg-gray-100 rounded shrink-0" />
                      <div className="flex-1 h-2 bg-gray-100 rounded" />
                      <div className="w-8 h-2 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
                <div className="h-8 bg-indigo-600 rounded-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile phone mockup */}
        <div className="sm:hidden mt-10 flex justify-center">
          <div className="w-52 bg-gray-900 rounded-[2rem] p-2 shadow-2xl shadow-gray-300">
            <div className="bg-white rounded-[1.6rem] overflow-hidden">
              {/* Phone status bar */}
              <div className="bg-indigo-600 px-4 pt-3 pb-2 flex items-center justify-between">
                <span className="text-white text-[10px] font-semibold">ZPos</span>
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">Z</span>
                </div>
              </div>
              {/* Product grid */}
              <div className="p-2 bg-gray-50 grid grid-cols-2 gap-1.5">
                {['🍳','🍜','🧊','🍊','☕','🍗'].map((e, i) => (
                  <div key={i} className="bg-white rounded-xl p-2 flex flex-col items-center gap-1">
                    <span className="text-2xl">{e}</span>
                    <div className="w-full h-1 bg-gray-100 rounded" />
                    <div className="w-2/3 h-1 bg-indigo-100 rounded" />
                  </div>
                ))}
              </div>
              {/* Bottom bar */}
              <div className="bg-white border-t border-gray-100 flex justify-around py-2.5">
                {[ShoppingCart, Package, BarChart3].map((Icon, i) => (
                  <div key={i} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                    <Icon size={14} />
                    <div className={`w-1 h-1 rounded-full ${i === 0 ? 'bg-indigo-600' : 'bg-transparent'}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-12 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">Semua yang Anda butuhkan</h2>
            <p className="text-sm sm:text-base text-gray-500">Fitur lengkap untuk mengelola toko dari mana saja</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-3 sm:mb-4">
                  <f.icon size={20} className="text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5 sm:mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-12 sm:py-20">
        <div className="max-w-2xl sm:max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">Harga yang terjangkau</h2>
            <p className="text-sm sm:text-base text-gray-500">Mulai gratis, upgrade kapan saja</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {plans.map((plan, i) => (
              <div key={i} className={`rounded-2xl border-2 p-6 sm:p-7 relative ${plan.border} ${plan.pro ? 'shadow-lg shadow-indigo-100' : ''}`}>
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <div className="mb-5">
                  <div className="text-sm font-semibold text-gray-500 mb-1">{plan.name}</div>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                    <span className="text-gray-400 text-sm mb-1">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-7">
                  {plan.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Check size={15} className="text-indigo-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/register"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.pro
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  {plan.pro ? 'Pilih Pro' : 'Mulai Trial Gratis'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-12 sm:py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">Siap memulai?</h2>
          <p className="text-sm sm:text-base text-indigo-200 mb-6 sm:mb-8">
            Daftar sekarang dan coba gratis 30 hari. Tidak perlu kartu kredit.
          </p>
          <Link href="/register" className="inline-block px-7 py-3.5 bg-white text-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-colors">
            Daftar Gratis Sekarang
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">Z</span>
            </div>
            <span className="text-sm font-semibold text-gray-700">ZPos</span>
          </div>
          <p className="text-xs text-gray-400 text-center">© 2026 ZPos. Dibuat dengan cinta untuk UMKM Indonesia.</p>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link href="/login" className="hover:text-gray-600 transition-colors">Masuk</Link>
            <Link href="/register" className="hover:text-gray-600 transition-colors">Daftar</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
