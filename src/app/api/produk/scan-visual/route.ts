import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { cariProdukDariFoto } from '@/lib/zface-visual'

// Proxy server-side untuk scan produk visual dari kamera kasir. Client
// mengirim foto ke endpoint ZPOS sendiri (session cookie), bukan langsung
// ke ZFace — tokoId diambil dari sesi terverifikasi, bukan dari client,
// dan CROSS_APP_SECRET tidak pernah terkirim/terlihat di browser.
export async function POST(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'file wajib diisi' }, { status: 400 })
  }
  const topK = Number(formData.get('top_k')) || 3

  const hasil = await cariProdukDariFoto({ fotoBlob: file, tokoId: toko.tokoId, topK })
  return NextResponse.json({ hasil })
}
