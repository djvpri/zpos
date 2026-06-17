import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Syarat & Ketentuan · ZPos' }

export default function SyaratPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-600 transition-colors mb-8">
          <ArrowLeft size={15} /> Kembali
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Syarat &amp; Ketentuan</h1>
        <p className="text-sm text-gray-400 mb-8">Terakhir diperbarui: 17 Juni 2026</p>

        <div className="prose prose-sm max-w-none text-gray-600 space-y-5 leading-relaxed">
          <section>
            <h2 className="font-semibold text-gray-900">1. Penerimaan</h2>
            <p>Dengan mendaftar dan menggunakan ZPos ("Layanan"), Anda menyetujui Syarat &amp; Ketentuan ini. Jika tidak setuju, mohon tidak menggunakan Layanan.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">2. Akun</h2>
            <p>Anda bertanggung jawab menjaga kerahasiaan kredensial akun dan seluruh aktivitas yang terjadi di dalamnya. Satu akun owner mewakili satu toko; owner dapat membuat akun kasir untuk stafnya.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">3. Langganan &amp; Pembayaran</h2>
            <p>Layanan tersedia dalam paket Trial (gratis, 30 hari) dan Pro (berbayar). Masa langganan Pro berlaku sesuai durasi yang dibayarkan. Setelah masa berlaku habis, akses dapat dibatasi sampai langganan diperpanjang. Biaya yang sudah dibayarkan tidak dapat dikembalikan kecuali ditentukan lain.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">4. Penggunaan yang Dilarang</h2>
            <p>Anda dilarang menyalahgunakan Layanan, termasuk upaya akses tidak sah, mengganggu sistem, atau menggunakannya untuk aktivitas melanggar hukum.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">5. Data Anda</h2>
            <p>Data toko, produk, dan transaksi yang Anda masukkan adalah milik Anda. Kami memproses data tersebut sesuai <Link href="/privasi" className="text-indigo-600 hover:underline">Kebijakan Privasi</Link>.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">6. Ketersediaan &amp; Tanggung Jawab</h2>
            <p>Layanan disediakan "sebagaimana adanya". Kami berupaya menjaga ketersediaan, namun tidak menjamin Layanan bebas gangguan. Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung akibat penggunaan Layanan.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">7. Perubahan</h2>
            <p>Kami dapat memperbarui Syarat ini sewaktu-waktu. Perubahan berlaku sejak dipublikasikan di halaman ini.</p>
          </section>

          <section>
            <h2 className="font-semibold text-gray-900">8. Kontak</h2>
            <p>Pertanyaan terkait Syarat ini dapat dikirim ke <a href="mailto:support@zpos.app" className="text-indigo-600 hover:underline">support@zpos.app</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
