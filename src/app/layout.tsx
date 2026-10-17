import type { Metadata } from 'next'
import './globals.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

const SITE_URL = 'https://z1pos.zomet.my.id'
const OG_IMAGE = `${SITE_URL}/og.png`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Z1 Pos — Aplikasi Kasir Digital untuk UMKM Indonesia',
    template: '%s · Z1 Pos',
  },
  description: 'Aplikasi kasir digital untuk warung, kafe, toko kelontong, dan UMKM. Proses transaksi cepat, manajemen produk, laporan penjualan. Gratis 30 hari.',
  keywords: [
    'aplikasi kasir', 'kasir digital', 'POS', 'point of sale', 'UMKM',
    'kasir android', 'kasir online', 'aplikasi toko', 'software kasir',
    'manajemen produk', 'laporan penjualan', 'kasir warung', 'kasir kafe',
  ],
  authors: [{ name: 'Zomet' }],
  creator: 'Zomet',
  publisher: 'Zomet',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: SITE_URL,
    siteName: 'Z1 Pos',
    title: 'Z1 Pos — Aplikasi Kasir Digital untuk UMKM Indonesia',
    description: 'Aplikasi kasir digital untuk warung, kafe, toko kelontong, dan UMKM. Proses transaksi cepat, manajemen produk, laporan penjualan. Gratis 30 hari.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Z1 Pos — Aplikasi Kasir Digital' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Z1 Pos — Aplikasi Kasir Digital untuk UMKM Indonesia',
    description: 'Aplikasi kasir digital untuk warung, kafe, toko kelontong, dan UMKM. Gratis 30 hari.',
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  manifest: '/manifest.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-gray-50 antialiased">
        {/* JSON-LD: WebSite + Organization — sitelinks + knowledge panel */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Z1 Pos',
              url: SITE_URL,
              description: 'Aplikasi kasir digital untuk UMKM Indonesia.',
              inLanguage: 'id-ID',
              potentialAction: {
                '@type': 'SearchAction',
                target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/artikel?q={search_term_string}` },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Zomet',
              url: 'https://zomet.my.id',
              description: 'Pengembang aplikasi untuk UMKM Indonesia: Z1 Pos, ZX Parenting, ZGym, ZXRoom.',
              logo: `${SITE_URL}/icon-192.png`,
            }),
          }}
        />
        {children}
      </body>
    </html>
  )
}
