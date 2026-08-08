import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { apiHandler } from '@/lib/api-handler'
import { catatAktivitas } from '@/lib/aktivitas'

export const KATEGORI = ['belanja_stok', 'operasional', 'gaji', 'transport', 'lainnya'] as const

// GET: daftar pengeluaran kas toko. Filter opsional: shift_id, kategori, dari, sampai.
// Kasir hanya lihat milik/shift-nya; admin lihat semua.
export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const shiftId = url.searchParams.get('shift_id')
  const kategori = url.searchParams.get('kategori')
  const dari = url.searchParams.get('dari')
  const sampai = url.searchParams.get('sampai')

  const cond: string[] = ['k.toko_id = ' + toko.tokoId]
  const params: unknown[] = []

  if (shiftId) { params.push(Number(shiftId)); cond.push(`k.shift_id = $${params.length}`) }
  if (kategori) { params.push(kategori); cond.push(`k.kategori = $${params.length}`) }
  if (dari) { params.push(dari); cond.push(`k.dibuat_at >= $${params.length}::timestamptz`) }
  if (sampai) { params.push(sampai); cond.push(`k.dibuat_at <= $${params.length}::timestamptz`) }
  // Kasir (bukan admin) hanya lihat entri miliknya.
  if (toko.role !== 'admin') { params.push(toko.userId); cond.push(`k.user_id = $${params.length}`) }

  const rows = await sql`
    SELECT k.id, k.shift_id, k.user_id, us.nama AS kasir_nama, k.kategori, k.nominal,
           k.catatan, k.void, k.dibuat_at
    FROM kas_keluar k
    LEFT JOIN "user" us ON us.id = k.user_id
    WHERE ${sql.unsafe(cond.join(' AND '))}
    ORDER BY k.dibuat_at DESC, k.id DESC
    LIMIT 500
  `
  return NextResponse.json(rows)
}

// POST: catat pengeluaran kas. Kasir/admin boleh, tanpa limit nominal.
// Kasir (token kasir biasa) harus terikat shift aktif dirinya; admin bebas (shift_id opsional).
export const POST = apiHandler(async (req: Request, body: {
  shift_id?: number | null
  kategori?: string
  nominal?: number
  catatan?: string
  user_id?: number
}) => {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nominal = Math.round(Number(body.nominal ?? 0))
  if (!Number.isFinite(nominal) || nominal <= 0) {
    return NextResponse.json({ error: 'Nominal harus > 0' }, { status: 400 })
  }
  const kategori = (body.kategori || 'lainnya').toLowerCase()
  if (!KATEGORI.includes(kategori as typeof KATEGORI[number])) {
    return NextResponse.json({ error: 'Kategori tidak valid' }, { status: 400 })
  }
  const catatan = String(body.catatan || '').trim().slice(0, 200) || null

  // Tentukan shift & pelapor. Kasir Tauri (token admin) bisa assign user_id utk kasir lokal.
  let userId = toko.userId
  let shiftId: number | null = body.shift_id ?? null

  if (body.user_id) {
    if (toko.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const [u] = await sql`SELECT id FROM "user" WHERE id = ${Number(body.user_id)} AND toko_id = ${toko.tokoId}`
    if (!u) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 400 })
    userId = u.id
  }

  // Kasir token biasa (bukan admin) wajib terikat shift aktif miliknya.
  if (toko.role !== 'admin') {
    if (shiftId) {
      const [s] = await sql`SELECT id FROM shift WHERE id = ${shiftId} AND toko_id = ${toko.tokoId} AND user_id = ${toko.userId}`
      if (!s) return NextResponse.json({ error: 'Shift bukan milik kasir ini' }, { status: 403 })
    } else {
      const [s] = await sql`
        SELECT id FROM shift WHERE toko_id = ${toko.tokoId} AND user_id = ${userId} AND aktif = true LIMIT 1
      `
      if (!s) return NextResponse.json({ error: 'Tidak ada shift aktif — buka shift dulu' }, { status: 400 })
      shiftId = s.id
    }
  }

  const [row] = await sql`
    INSERT INTO kas_keluar (toko_id, shift_id, user_id, kategori, nominal, catatan)
    VALUES (${toko.tokoId}, ${shiftId}, ${userId}, ${kategori}, ${nominal}, ${catatan})
    RETURNING id, shift_id, user_id, kategori, nominal, catatan, dibuat_at
  `

  // Audit: pengeluaran tercatat di log (terlihat utk deteksi kecurangan).
  void catatAktivitas(toko, 'kas_keluar',
    `${toko.userName} mencatat pengeluaran ${kategori} Rp ${nominal.toLocaleString('id-ID')}${catatan ? ' · ' + catatan : ''}${shiftId ? ' · shift #' + shiftId : ''}`)

  return NextResponse.json(row)
})
