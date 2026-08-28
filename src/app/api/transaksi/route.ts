import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import { catatAktivitas } from '@/lib/aktivitas'
import { topup, bayarPasca, type DigiflazzRow } from '@/lib/digiflazz'
import type { Transaksi, DetailTransaksi } from '@/types'

export async function POST(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = await statusToko(toko.tokoId)
  if (!status.aktif) return NextResponse.json({ error: 'Toko dinonaktifkan. Hubungi admin.' }, { status: 403 })
  if (status.expired) return NextResponse.json({ error: 'Langganan sudah habis. Hubungi admin untuk memperpanjang.' }, { status: 403 })

  const { trx, items }: { trx: Transaksi; items: DetailTransaksi[] } = await req.json()

  // Auto-migrasi idempotent: pastikan kolom member_nama ada (riwayat nota lama
  // tanpa kolom ini tetap berfungsi). Sama pola `desain_nota` di /api/pengaturan.
  await sql.unsafe('ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS member_nama text')

  // Kalau transaksi ini sudah pernah masuk (retry dari antrian offline yang
  // sempat sukses tapi responsnya tidak sampai ke client), kembalikan baris
  // yang sudah ada — supaya sinkronisasi ulang tidak gagal atau dobel.
  const [existing] = await sql`SELECT * FROM transaksi WHERE no_transaksi = ${trx.no_transaksi}`
  if (existing) return NextResponse.json(existing, { status: 409 })

  // Shift: kalau client kirim `trx.shift_id` (kasir Tauri, shift per kasir lokal),
  // validasi dulu — harus milik toko ini (boleh shift yang sudah tutup; transaksi
  // OFFLINE yang terkirim belakangan harus tetap masuk shift aslinya, walau shift
  // itu sudah ditutup berhari-hari lalu). Hanya cek toko_id, BUKAN `aktif=true`
  // (kasus offline seminggu/sebulan: tiap shift ditutup harian, tapi transaksi
  // offline menumpuk & harus menempel ke shift tanggal transaksi itu dibuatnya).
  // Kalau shift_id invalid/tak ada → fallback ke shift aktif user token (web).
  let shiftId: number | null = null
  if (trx.shift_id) {
    const [s] = await sql`
      SELECT id FROM shift
      WHERE id = ${Number(trx.shift_id)} AND toko_id = ${toko.tokoId}
      LIMIT 1
    `
    if (s) shiftId = s.id
  }
  if (shiftId === null) {
    const [activeShift] = await sql`
      SELECT id FROM shift WHERE toko_id = ${toko.tokoId} AND user_id = ${toko.userId} AND aktif = true LIMIT 1
    `
    shiftId = activeShift?.id ?? null
  }

  // created_at: kalau client kirim (mis. transaksi offline yang baru
  // tersinkron belakangan), pakai waktu jual SESUNGGUHNYA itu — bukan
  // waktu sinkron — supaya laporan harian tidak salah tanggal.
  const waktuJual = trx.created_at ? new Date(trx.created_at) : new Date()

  // Simpan transaksi + kurangi stok produk ATOMIC (satu transaksi DB). Stok
  // cuma produk asli (produk_id > 0); item virtual harga-bebas dilewati.
  const saved = await sql.begin(async t => {
    const [tr] = await t`
      INSERT INTO transaksi (no_transaksi, subtotal, diskon, pajak, total, bayar, kembali, metode_bayar, kasir, toko_id, shift_id, created_at, sumber, member_nama)
      VALUES (${trx.no_transaksi}, ${trx.subtotal}, ${trx.diskon}, ${trx.pajak}, ${trx.total},
              ${trx.bayar}, ${trx.kembali}, ${trx.metode_bayar}, ${toko.userName}, ${toko.tokoId}, ${shiftId}, ${waktuJual},
              ${trx.sumber ?? 'web'}, ${trx.member_nama?.trim() ? trx.member_nama.trim() : null})
      RETURNING *
    `
    if (items.length > 0) {
      const rows = items.map(i => ({
        transaksi_id: tr.id as number,
        produk_id: i.produk_id,
        nama_produk: i.nama_produk,
        harga: i.harga,
        qty: i.qty,
        subtotal: i.subtotal,
        toko_id: toko.tokoId,
      }))
      await t`INSERT INTO detail_transaksi ${t(rows)}`
      // Kurangi stok produk riil. Per item real (id>0). GREATEST(0) cegah minus.
      // KECUALI transaksi TEBUS bon gantung (`trx.bon_tebus_id`): stok bon sudah
      // di-hold (barang diambil pembeli) saat bon dibuat di POST /api/bon, jadi
      // tebus TIDAK boleh kurangi lagi (double). Akuntansi/shift tetap dicatat.
      const real = items.filter(i => Number(i.produk_id) > 0 && !i._digital)
      if (!trx.bon_tebus_id) {
        for (const i of real) {
          await t`
            UPDATE produk SET stok = GREATEST(0, stok - ${Number(i.qty)}), updated_at = now()
            WHERE id = ${Number(i.produk_id)} AND toko_id = ${toko.tokoId}
          `
        }
      } else {
        // TEBUS bon gantung: barang sudah di-hold saat gantung, jadi tebus tak
        // kurangi stok ulang. TANDAI bon selesai otomatis di sini (atomik dgn
        // transaksi) — kalau tidak, bon tetap aktif & ditarik balik oleh kasir
        // (mergeBonSync) walau sudah dibayar. `tandai_bon` kasir hanya menyentuh
        // transaksi online langsung, bukan yg lewat antrian (push_antrian_only).
        await t`
          UPDATE bon SET selesai = true, dibayar_at = now()
          WHERE id = ${Number(trx.bon_tebus_id)} AND toko_id = ${toko.tokoId} AND selesai = false
        `
      }
    }
    return tr
  })

  // --- Item DIGITAL (jual pulsa/tagihan via Digiflazz) ---
  // Prabayar: request topup SEKETIKA. Pakai status per hasil Digiflazz.
  // Pasca: alur 2-step (inquiry → pay) TIDAK di transaksi ini — ditangani
  // endpoint khusus /api/digiflazz (kasir lihat tagihan dulu, lalu konfirmasi).
  const digitalItems = (items ?? []).filter(i => i._digital)
  let trxStatus = 'Sukses'
  const digitalRows: {
    transaksi_id: number, produk_id: number | null, buyer_sku_code: string,
    customer_no: string, ref_id: string, commands: string, modal: number | null,
    harga_jual: number, status: string, sn: string | null, message: string | null
  }[] = []
  if (digitalItems.length > 0) {
    for (let i = 0; i < digitalItems.length; i++) {
      const it = digitalItems[i]
      const d = it._digital!
      const refId = `ZP${saved.no_transaksi}-${i + 1}`
      // request Digiflazz; error network → trx tetap tercatat, status jadi Gagal
      // (kasir refund manual — pola A). Jangan throw, jangan rollback.
      let status = 'Gagal', sn: string | null = null, msg: string | null = null
      let commands = 'topup'
      try {
        // pasca harus lewat inquiry dulu (endpoint /pasca/inq); di sini bayar.
        const r = d.brand === 'pasca'
          ? await bayarPasca(d.buyer_sku_code, d.customer_no, refId)
          : await topup(d.buyer_sku_code, d.customer_no, refId)
        if (d.brand === 'pasca') commands = 'pay-pasca'
        const rd = (r?.data?.[0] ?? r?.data ?? {}) as DigiflazzRow
        status = rd.status || (rd.rc === '00' ? 'Sukses' : rd.rc === '03' ? 'Pending' : 'Gagal')
        sn = rd.sn ?? null
        msg = rd.message ?? rd.desc ?? null
        // status sudah "Sukses/Gagal/Pending"; normalisasi ke model kita
        if (status?.toLowerCase() === 'sukses') status = 'Sukses'
        else if (status?.toLowerCase() === 'pending') status = 'Pending'
        else status = 'Gagal'
      } catch (e: unknown) {
        msg = (e as Error)?.message ?? 'Digiflazz error'
      }
      digitalRows.push({
        transaksi_id: saved.id as number, produk_id: Number(it.produk_id) || null,
        buyer_sku_code: d.buyer_sku_code, customer_no: d.customer_no, ref_id: refId,
        commands, modal: d.modal ?? null, harga_jual: Number(it.subtotal),
        status, sn, message: msg,
      })
      if (status === 'Pending' && trxStatus === 'Sukses') trxStatus = 'Pending'
      if (status === 'Gagal') trxStatus = 'Gagal'
    }
  }
  if (digitalRows.length > 0) {
    await sql`INSERT INTO transaksi_digital ${sql(digitalRows)}`
    await sql`UPDATE transaksi SET status = ${trxStatus} WHERE id = ${saved.id as number}`
  }

  // Audit: catat transaksi baru (metode bayar + total, utk cek kecurangan).
  void catatAktivitas(toko, 'transaksi_buat',
    `${saved.no_transaksi} · ${trx.metode_bayar ?? '-'} · Rp ${Number(saved.total).toLocaleString('id-ID')} · ${items.length} item`)

  return NextResponse.json({ ...saved, digital: digitalRows })
}

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Number(searchParams.get('limit') ?? 20)
  const rows = await sql`
    SELECT * FROM transaksi WHERE toko_id = ${toko.tokoId} ORDER BY created_at DESC LIMIT ${limit}
  `
  return NextResponse.json(rows)
}
