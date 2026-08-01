import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import { deteksiNamaDariFoto } from '@/lib/gemini-nama-produk'
import { generateProductBarcode } from '@/lib/barcode-code39'
import { embedProduk } from '@/lib/zface-visual'

const LIMIT_PRODUK_TRIAL = 100

// Upload foto massal: client mengirim SATU foto per request (dikonpres ≤400px),
// lalu diproses berurutan dari client (antrian 1-per-1). Server per foto:
//   1) Gemini → nama + kategori (satu panggilan, hemat biaya)
//   2) auto-buat kategori kalau belum ada
//   3) INSERT produk mode cepat (harga 1, stok 0) + auto-barcode internal
//   4) ringkas hasil {ok, nama, id} | {ok:false, alasan}
// Produk dibuat harga 1 & tanpa stok — nanti diupdate massal via Excel.
// GEMINI_API_KEY tidak pernah terlihat di browser.
export async function POST(req: Request, _ctx: { params: Promise<Record<string, string | string[]>> }) {
  const auth = await getTokoFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { foto?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'body JSON invalid' }, { status: 400 })
  }
  const foto = body.foto
  if (!foto || typeof foto !== 'string' || !foto.startsWith('data:image')) {
    return NextResponse.json({ error: 'foto (data URI base64) wajib diisi' }, { status: 400 })
  }

  // Status toko (aktif & trial limit) — sama seperti POST /api/produk
  const status = await statusToko(auth.tokoId)
  if (!status.aktif) return NextResponse.json({ error: 'Toko dinonaktifkan. Hubungi admin.' }, { status: 403 })
  if (status.expired) return NextResponse.json({ error: 'Langganan sudah habis. Hubungi admin untuk memperpanjang.' }, { status: 403 })

  if (status.plan === 'trial') {
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM produk WHERE toko_id = ${auth.tokoId} AND aktif = true`
    if (count >= LIMIT_PRODUK_TRIAL) {
      return NextResponse.json({ error: `Paket Trial dibatasi ${LIMIT_PRODUK_TRIAL} produk. Upgrade ke Pro untuk produk tak terbatas.` }, { status: 403 })
    }
  }

  // 1) Deteksi nama + kategori dari AI
  const hasil = await deteksiNamaDariFoto(foto)
  if (hasil.error) {
    return NextResponse.json(
      { error: hasil.error, ok: false, alasan: hasil.error.includes('GEMINI_API_KEY') ? 'key_belum_disimpan' : 'gagal_jaringan' },
      { status: hasil.error.includes('GEMINI_API_KEY') ? 503 : 502 }
    )
  }
  const nama = hasil.nama?.trim()
  if (!nama) {
    // Foto valid tapi AI tidak bisa menebak nama — jangan insert, beri tahu client.
    return NextResponse.json({ ok: false, alasan: 'nama_tidak_terdeteksi', error: 'Nama produk tidak dapat dideteksi dari foto ini.' })
  }

  // 2) Auto-buat / ambil kategori
  let kategoriId: number | null = null
  if (hasil.kategori?.trim()) {
    const namaKat = hasil.kategori.trim()
    const [existing] = await sql`SELECT id FROM kategori WHERE toko_id = ${auth.tokoId} AND lower(nama) = lower(${namaKat})`
    if (existing) {
      kategoriId = existing.id
    } else {
      const [baru] = await sql`INSERT INTO kategori (nama, toko_id) VALUES (${namaKat}, ${auth.tokoId}) RETURNING id`
      kategoriId = baru.id
    }
  }

  // 3) Insert produk mode cepat (harga 1, stok 0, foto tersimpan)
  let row
  try {
    ;[row] = await sql`
      INSERT INTO produk (nama, harga, stok, foto_url, kategori_id, toko_id, stok_minimum, client_ref)
      VALUES (${nama}, 1, 0, ${foto}, ${kategoriId}, ${auth.tokoId}, 5, null)
      RETURNING *
    `
    // Auto-barcode internal (sama seperti POST /api/produk)
    if (!row.barcode) {
      await sql`UPDATE produk SET barcode = ${generateProductBarcode(row.id)} WHERE id = ${row.id}`
      ;[row] = await sql`SELECT * FROM produk WHERE id = ${row.id}`
    }
  } catch (e) {
    console.error('batch-foto insert error:', e)
    return NextResponse.json({ ok: false, alasan: 'insert_gagal', error: 'Gagal menyimpan produk.' })
  }

  // 4) Embed untuk deteksi visual (non-blocking, jangan menggagalkan response)
  if (row.foto_url) {
    embedProduk({ produkId: row.id, nama: row.nama, harga: row.harga, fotoBase64: row.foto_url, tokoId: row.toko_id }).catch(() => {})
  }

  return NextResponse.json({ ok: true, id: row.id, nama: row.nama, barcode: row.barcode })
}
