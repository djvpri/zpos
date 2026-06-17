import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Kebijakan Privasi · ZPos' }

export default function PrivasiPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors mb-8">
          <ArrowLeft size={15} /> Kembali
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Kebijakan Privasi</h1>
        <p className="text-sm text-gray-400 mb-8">Terakhir diperbarui: 17 Juni 2026</p>

        <div className="prose prose-sm max-w-none text-gray-600 space-y-5 leading-relaxed">
          <section>
            <h2 className="font-semibold text-gray-900">1. Data yang Kami Kumpulkan</h2>
            <p>Kami mengumpulkan: (a) data akun — nama toko, nama pengguna, email, dan kata sandi (disimpan dalam bentuk hash); (b) data operasional — produk, kategori, dan transaksi yang Anda masukkan.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">2. Penggunaan Data</h2>
            <p>Data digunakan untuk menyediakan dan menjalankan Layanan: autentikasi, menampilkan kasir &amp; laporan, serta dukungan pelanggan. Kami tidak menjual data Anda.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">3. Penyimpanan &amp; Keamanan</h2>
            <p>Data disimpan pada penyedia infrastruktur kami (database PostgreSQL). Kata sandi di-hash, akses antar toko diisolasi, dan sesi diamankan dengan token. Tidak ada sistem yang 100% aman, namun kami menerapkan langkah perlindungan yang wajar.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">4. Berbagi dengan Pihak Ketiga</h2>
            <p>Kami hanya membagikan data kepada penyedia layanan yang diperlukan untuk mengoperasikan Layanan (mis. hosting database dan pengiriman email reset kata sandi), sebatas keperluan tersebut.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">5. Retensi</h2>
            <p>Data disimpan selama akun aktif. Anda dapat meminta penghapusan data toko dengan menghubungi kami; sebagian data dapat tetap disimpan bila diwajibkan hukum.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">6. Hak Anda</h2>
            <p>Anda berhak mengakses, memperbaiki, atau meminta penghapusan data pribadi Anda. Hubungi kami untuk menggunakan hak ini.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">7. Kontak</h2>
            <p>Pertanyaan terkait privasi dapat dikirim ke <a href="mailto:support@zpos.app" className="text-indigo-600 hover:underline">support@zpos.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
