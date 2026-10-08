import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getTokoFromRequest } from '@/lib/auth'
import { statusToko } from '@/lib/guard'
import { catatAktivitas } from '@/lib/aktivitas'
import { topup, bayarPasca, type DigiflazzRow } from '@/lib/digiflazz'
import { hitungHargaDebet } from '@/lib/saldo'
import type { Transaksi, DetailTransaksi } from '@/types'

export async function POST(req: Request) {
  try {
    const toko = await getTokoFromRequest(req)
    if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const status = await statusToko(toko.tokoId)
    if (!status.aktif) return NextResponse.json({ error: 'Toko dinonaktifkan. Hubungi admin.' }, { status: 403 })
    if (status.expired) return NextResponse.json({ error: 'Langganan sudah habis. Hubungi admin untuk memperpanjang.' }, { status: 403 })

    // Kebijakan stok toko: apakah jualan mengurangi stok, dan apakah barang
    // habis masih boleh dijual. Kolom dibuat auto-migrasi di /api/pengaturan;
    // di sini `?? true / ?? false` menjaga toko yang kolomnya belum terisi.
    const [aturanStok] = await sql`
      SELECT kurangi_stok, jual_stok_habis FROM toko WHERE id = ${toko.tokoId}
    `.catch(() => [null])
    const kurangiStok = aturanStok?.kurangi_stok ?? true
    const bolehJualHabis = aturanStok?.jual_stok_habis ?? false

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
    const shiftRaw = Number(trx.shift_id)
    // kasir Tauri bisa kirim shift_id sebagai string kosong/"NaN" → Number() jadi
    // NaN dan postgres menolak SELECT ini dgn `invalid input syntax for type
    // integer: "NaN"` (500 SEBELUM INSERT sempat jalan). Validasi dulu.
    if (trx.shift_id && Number.isFinite(shiftRaw)) {
      const [s] = await sql`
        SELECT id FROM shift
        WHERE id = ${shiftRaw} AND toko_id = ${toko.tokoId}
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

    // Sanitasi angka: kasir Tauri kadang kirim string kosong/null utk field numerik
    // (trx.pajak, trx.kembali, dll) → postgres menolak `invalid input syntax for
    // type integer: "NaN"` → seluruh transaksi 500 & kasir offline menggantung.
    // Angka tak-valid dianggap 0. Satu titik ini melindungi INSERT transaksi +
    // detail_transaksi + UPDATE stok.
    const num = (v: unknown): number => {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }
    const trx2 = {
      ...trx,
      subtotal: num(trx.subtotal),
      diskon: num(trx.diskon),
      pajak: num(trx.pajak),
      total: num(trx.total),
      bayar: num(trx.bayar),
      kembali: num(trx.kembali),
    }
    // produk_id: null = item virtual "Lainnya" (tak punya baris produk) —
    // WAJIB tetap null. num() sebelumnya ubah null→0 → FK
    // detail_transaksi_produk_id_fkey reject (produk_id=0 tak ada) → 167
    // transaksi kasir nyangkut. Kolom DB memang nullable.
    const pidNum = (v: unknown): number | null => {
      if (v === null || v === undefined || v === '') return null
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : null
    }
    const items2 = items.map(i => ({
      ...i,
      produk_id: pidNum(i.produk_id),
      harga: num(i.harga),
      qty: num(i.qty),
      subtotal: num(i.subtotal),
    }))

    // Simpan transaksi + kurangi stok produk ATOMIC (satu transaksi DB). Stok
    // cuma produk asli (produk_id > 0); item virtual harga-bebas dilewati.
    const saved = await sql.begin(async t => {
      const [tr] = await t`
        INSERT INTO transaksi (no_transaksi, subtotal, diskon, pajak, total, bayar, kembali, metode_bayar, kasir, toko_id, shift_id, created_at, sumber, member_nama)
        VALUES (${trx2.no_transaksi}, ${trx2.subtotal}, ${trx2.diskon}, ${trx2.pajak}, ${trx2.total},
                ${trx2.bayar}, ${trx2.kembali}, ${trx2.metode_bayar}, ${toko.userName}, ${toko.tokoId}, ${shiftId}, ${waktuJual},
                ${trx2.sumber ?? 'web'}, ${trx2.member_nama?.trim() ? trx2.member_nama.trim() : null})
        RETURNING *
      `
      if (items2.length > 0) {
        const rows = items2.map(i => ({
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
        // KECUALI transaksi TEBUS bon gantung (`trx2.bon_tebus_id`): stok bon sudah
        // di-hold (barang diambil pembeli) saat bon dibuat di POST /api/bon, jadi
        // tebus TIDAK boleh kurangi lagi (double). Akuntansi/shift tetap dicatat.
        const real = items2.filter(i => Number(i.produk_id) > 0 && !i._digital)
        // Cek stok dulu kalau pengurangan stok aktif & toko tak izinkan jual habis.
        // Kalau kurangi_stok=OFF, pengecekan tak dilakukan (stok dikelola manual).
        if (kurangiStok && !bolehJualHabis && !trx2.bon_tebus_id && real.length > 0) {
          // Filter NaN — `id = ANY(ARRAY[NaN])` juga melempar
          // 'invalid input syntax for type integer: "NaN"' dari postgres.
          const idProduk = real.map(i => Number(i.produk_id)).filter(n => Number.isFinite(n) && n > 0)
          if (idProduk.length > 0) {
            const stokSekarang = (await t`
              SELECT id, stok FROM produk WHERE id = ANY(${idProduk}) AND toko_id = ${toko.tokoId}
            `) as { id: number; stok: number }[]
            const petaStok = new Map<number, number>(stokSekarang.map(s => [Number(s.id), Number(s.stok)]))
            for (const i of real) {
              const sisa = petaStok.get(Number(i.produk_id)) ?? 0
              if (sisa < Number(i.qty)) {
                throw Object.assign(new Error(`Stok "${i.nama_produk}" tidak cukup (sisa ${sisa})`), { statusStok: 400 })
              }
            }
          }
        }
        if (kurangiStok && !trx2.bon_tebus_id) {
          for (const i of real) {
            const pid = Number(i.produk_id)
            const qty = Number(i.qty)
            if (!pid || qty <= 0) continue
            await t`
              UPDATE produk SET stok = GREATEST(0, stok - ${qty}), updated_at = now()
              WHERE id = ${pid} AND toko_id = ${toko.tokoId}
            `
          }
        } else {
          // TEBUS bon gantung: barang sudah di-hold saat gantung, jadi tebus tak
          // kurangi stok ulang. TANDAI bon selesai otomatis di sini (atomik dgn
          // transaksi) — kalau tidak, bon tetap aktif & ditarik balik oleh kasir
          // (mergeBonSync) walau sudah dibayar. `tandai_bon` kasir hanya menyentuh
          // transaksi online langsung, bukan yg lewat antrian (push_antrian_only).
          const bonId = Number(trx.bon_tebus_id)
          if (Number.isFinite(bonId) && bonId > 0) {
            await t`
              UPDATE bon SET selesai = true, dibayar_at = now()
              WHERE id = ${bonId} AND toko_id = ${toko.tokoId} AND selesai = false
            `
          }
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
    // --- Saldo tenant utk item digital ---
    // Tenant beli pulsa dgn DEPOSIT (top-up ke owner). Server DEBIT saldo_toko
    // sebesar harga_debet (modal Digiflazz + margin owner) utk tiap item digital.
    // Margin owner diambil dari tabel produk (authoritative owner), BUKAN dari
    // body kasir (kasir/tanpa modal). Saldo dicek DI MUKA sebelum simpan trx,
    // supaya tolak bersih kalau tak cukup.
    const skuSet = [...new Set(digitalItems.map(d => d._digital!.buyer_sku_code))] as string[]
    const marginBySku = new Map<string, { margin_type: string | null; margin_persen: number | null; margin_nominal: number | null }>()
    if (skuSet.length > 0) {
      const rows = await sql`
        SELECT buyer_sku_code, margin_type, margin_persen, margin_nominal
        FROM produk WHERE toko_id = ${toko.tokoId} AND buyer_sku_code = ANY(${skuSet})
      `
      for (const r of rows) marginBySku.set(r.buyer_sku_code, { margin_type: r.margin_type, margin_persen: r.margin_persen, margin_nominal: r.margin_nominal })
    }
    const hargaDebetMap = new Map<number, number>() // index item -> harga_debet
    let totalDebit = 0
    digitalItems.forEach((it, i) => {
      const d = it._digital!
      const spec = marginBySku.get(d.buyer_sku_code) ?? null
      const debet = hitungHargaDebet(Number(d.modal) || 0, spec ?? { margin_type: 'persen', margin_persen: 0, margin_nominal: 0 })
      hargaDebetMap.set(i, debet)
      totalDebit += debet
    })
    if (totalDebit > 0) {
      const [t] = await sql`SELECT saldo FROM toko WHERE id = ${toko.tokoId}`
      const saldo = Number(t?.saldo ?? 0)
      if (saldo < totalDebit) {
        return NextResponse.json(
          { error: `Saldo pulsa tidak cukup. Dibutuhkan Rp ${totalDebit.toLocaleString('id-ID')}, saldo Rp ${saldo.toLocaleString('id-ID')}. Hubungi owner utk top-up.` },
          { status: 402 }
        )
      }
    }
    const digitalRows: {
      transaksi_id: number, produk_id: number | null, buyer_sku_code: string,
      customer_no: string, ref_id: string, commands: string, modal: number | null,
      harga_debet: number | null, harga_jual: number, status: string, sn: string | null, message: string | null
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
          commands, modal: d.modal ?? null, harga_debet: hargaDebetMap.get(i) ?? null, harga_jual: Number(it.subtotal) || 0,
          status, sn, message: msg,
        })
        if (status === 'Pending' && trxStatus === 'Sukses') trxStatus = 'Pending'
        if (status === 'Gagal') trxStatus = 'Gagal'
      }
    }
    if (digitalRows.length > 0) {
      await sql`INSERT INTO transaksi_digital ${sql(digitalRows)}`
      await sql`UPDATE transaksi SET status = ${trxStatus} WHERE id = ${saved.id as number}`

      // Selisih saldo: DEBIT utk item yg jalan (Sukses/Pending), jangan debit
      // item Gagal (pulsa tak jalan → tak bayar). Atomic dgn catat toko_deposit.
      const netDebit = digitalRows
        .filter(r => r.status !== 'Gagal')
        .reduce((a, r) => a + (r.harga_debet ?? 0), 0)
      if (netDebit > 0) {
        await sql.begin(async t => {
          await t`UPDATE toko SET saldo = saldo - ${netDebit} WHERE id = ${toko.tokoId}`
          await t`INSERT INTO toko_deposit (toko_id, nominal, tipe, keterangan)
                  VALUES (${toko.tokoId}, ${netDebit}, 'debit', ${`jual pulsa ${saved.no_transaksi}`})`
        })
      }
    }

    // Audit: catat transaksi baru (metode bayar + total, utk cek kecurangan).
    void catatAktivitas(toko, 'transaksi_buat',
      `${saved.no_transaksi} · ${trx.metode_bayar ?? '-'} · Rp ${Number(saved.total).toLocaleString('id-ID')} · ${items.length} item`)

    return NextResponse.json({ ...saved, digital: digitalRows })
  } catch (e: unknown) {
    // Stok tak cukup dilempar dari dalam sql.begin — postgres.js melempar ulang
    // sebagai error biasa, jadi tangkap di luar supaya kasir dapat 400 + pesan
    // jelas (bukan 500 yang membuat transaksi offline tertahan).
    const pesan = e instanceof Error ? e.message : String(e)
    if (pesan.includes('tidak cukup')) {
      return NextResponse.json({ error: pesan }, { status: 400 })
    }
    throw e
  }
}

export async function GET(req: Request) {
  const toko = await getTokoFromRequest(req)
  if (!toko) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)

  // Mode detail: /api/transaksi?id=123 — respon tunggal utk cetak ulang nota.
  const detailId = searchParams.get('id')
  if (detailId) {
    const [trx] = await sql`
      SELECT t.*, COALESCE(
        json_agg(
          json_build_object(
            'id', dt.id, 'produk_id', dt.produk_id, 'nama_produk', dt.nama_produk,
            'harga', dt.harga, 'qty', dt.qty, 'subtotal', dt.subtotal
          )
        ) FILTER (WHERE dt.id IS NOT NULL), '[]'
      ) AS items
      FROM transaksi t
      LEFT JOIN detail_transaksi dt ON dt.transaksi_id = t.id
      WHERE t.id = ${Number(detailId)} AND t.toko_id = ${toko.tokoId}
      GROUP BY t.id
    `
    if (!trx) return NextResponse.json({ error: 'Tidak ditemukan' }, { status: 404 })
    return NextResponse.json(trx)
  }

  // Mode riwayat: paginasi + filter. Default limit=50.
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 50)))
  const offset = (page - 1) * limit
  const dari = searchParams.get('dari')
  const sampai = searchParams.get('sampai')
  const metode = searchParams.get('metode')
  const q = searchParams.get('q')?.trim()
  const status = searchParams.get('status') // 'aktif' | 'batal' | null=semua

  // Build WHERE clause dinamis.
  const conds: string[] = [`toko_id = ${toko.tokoId}`]
  const params: (string | number)[] = []
  let pi = 1
  if (dari && /^\d{4}-\d{2}-\d{2}$/.test(dari)) {
    params.push(dari + 'T00:00:00'); conds.push(`created_at >= $${pi++}`)
  }
  if (sampai && /^\d{4}-\d{2}-\d{2}$/.test(sampai)) {
    const [y, m, d] = sampai.split('-').map(Number)
    const end = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
    params.push(end + 'T00:00:00'); conds.push(`created_at < $${pi++}`)
  }
  if (metode && ['Tunai', 'QRIS', 'Transfer'].includes(metode)) {
    params.push(metode); conds.push(`metode_bayar = $${pi++}`)
  }
  if (q) {
    params.push(`%${q}%`); conds.push(`no_transaksi ILIKE $${pi++}`)
  }
  if (status === 'aktif') conds.push(`dibatalkan = false`)
  else if (status === 'batal') conds.push(`dibatalkan = true`)

  const where = conds.join(' AND ')

  // Query data + total count + grand total dalam satu round-trip.
  params.push(limit, offset)
  const limitPos = pi++
  const offsetPos = pi++

  const rows = await sql.unsafe(`
    SELECT * FROM transaksi WHERE ${where} ORDER BY created_at DESC LIMIT $${limitPos} OFFSET $${offsetPos}
  `, params as unknown as (string | number)[])

  // Count + grand total (hanya transaksi tidak dibatalkan utk grand_total).
  const countParams = params.slice(0, -2) // strip limit+offset
  const [meta] = await sql.unsafe(`
    SELECT count(*)::int AS total,
           COALESCE(sum(total) FILTER (WHERE dibatalkan = false), 0)::bigint AS grand_total
    FROM transaksi WHERE ${where}
  `, countParams as unknown as (string | number)[])

  return NextResponse.json({
    data: rows,
    total: meta?.total ?? 0,
    grand_total: meta?.grand_total ?? 0,
    page,
    limit,
    total_pages: Math.ceil((meta?.total ?? 0) / limit),
  })
}
