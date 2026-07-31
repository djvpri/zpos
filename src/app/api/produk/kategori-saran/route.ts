import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { saranKategoriDariNama } from '@/lib/gemini-nama-produk'

// Proxy server-side "nama produk → rekomendasi kategori" via Gemini. Client
// kirim nama ke endpoint ZPOS sendiri (session cookie), bukan langsung ke
// Gemini — GEMINI_API_KEY tak pernah terkirim/terlihat di browser. Tanpa DB.
export async function POST(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { nama?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'body JSON invalid' }, { status: 400 })
  }

  const nama = body.nama
  if (!nama || typeof nama !== 'string' || !nama.trim()) {
    return NextResponse.json({ error: 'nama produk wajib diisi' }, { status: 400 })
  }

  const hasil = await saranKategoriDariNama(nama)
  if (hasil.error) {
    return NextResponse.json({ error: hasil.error, kategori: null }, { status: hasil.error.includes('GEMINI_API_KEY') ? 503 : 502 })
  }
  return NextResponse.json({ kategori: hasil.kategori })
}
