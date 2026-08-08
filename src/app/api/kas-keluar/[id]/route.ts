import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { catatAktivitas } from '@/lib/aktivitas'

// PATCH: void (batalkan) pengeluaran kas. Kasir & admin berhak — tp kasir hanya
// entri miliknya (atau shift-nya / belum lewat hari). Setelah void, tak dihitung
// lagi di saldo/rekap. Riwayat tetap tampil (flag void), utk jejak audit.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const [row] = await sql`
    SELECT k.id, k.toko_id, k.user_id, k.shift_id, k.nominal, k.kategori, k.void
    FROM kas_keluar k WHERE k.id = ${Number(id)}
  `
  if (!row || row.toko_id !== toko.tokoId) {
    return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
  }
  if (row.void) return NextResponse.json({ error: 'Sudah dibatalkan' }, { status: 400 })

  // Kasir (non-admin) hanya boleh membatalkan entri miliknya sendiri.
  if (toko.role !== 'admin' && row.user_id !== toko.userId) {
    return NextResponse.json({ error: 'Bukan pengeluaran milik kasir ini' }, { status: 403 })
  }

  const [updated] = await sql`
    UPDATE kas_keluar SET void = true WHERE id = ${row.id} RETURNING id, nominal, kategori, catatan, shift_id
  `

  void catatAktivitas(toko, 'kas_keluar_void',
    `${toko.userName} membatalkan pengeluaran ${updated.kategori} Rp ${Number(updated.nominal).toLocaleString('id-ID')}${updated.shift_id ? ' · shift #' + updated.shift_id : ''}`)

  return NextResponse.json(updated)
}
