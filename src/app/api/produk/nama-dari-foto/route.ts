import { NextResponse } from 'next/server'
import { getTokoFromRequest } from '@/lib/auth'
import { deteksiNamaDariFoto } from '@/lib/gemini-nama-produk'

// Proxy server-side untuk "foto → nama produk" via Gemini. Client mengirim
// foto ke endpoint ZPOS sendiri (session cookie), bukan langsung ke Gemini —
// GEMINI_API_KEY tidak pernah terkirim/terlihat di browser. TIdak memakai DB.
export async function POST(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { foto?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'body JSON invalid' }, { status: 400 })
  }

  const foto = body.foto
  if (!foto || typeof foto !== 'string' || !foto.startsWith('data:image')) {
    return NextResponse.json({ error: 'foto (data URI base64) wajib diisi' }, { status: 400 })
  }

  const hasil = await deteksiNamaDariFoto(foto)
  if (hasil.error) {
    // Key belum di-set → kode khusus agar client tahu ini "belum dikonfigurasi",
    // bukan kegagalan foto. Kalau gagal jaringan → 502 semi-informatif.
    return NextResponse.json({ error: hasil.error, nama: null }, { status: hasil.error.includes('GEMINI_API_KEY') ? 503 : 502 })
  }
  return NextResponse.json({ nama: hasil.nama, kategori: hasil.kategori ?? null, adaTeks: hasil.adaTeks ?? null })
}
