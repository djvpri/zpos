import sql from './db'

export interface StatusToko {
  plan: string
  aktif: boolean
  langganan_sampai: string | null
  expired: boolean
  isDemo: boolean
  demoExpiresAt: string | null
}

// Ambil status langganan toko langsung dari DB (real-time, agar perubahan
// admin langsung berlaku tanpa user harus login ulang).
//
// is_demo/demo_expires_at dibaca dalam try/catch TERPISAH dari query utama
// — kalau migration_demo.sql belum dijalankan (kolom belum ada), fitur
// demo cuma "belum aktif" (isDemo selalu false), TIDAK membuat seluruh
// endpoint auth/me gagal untuk SEMUA pengguna aplikasi yang sudah ada.
export async function statusToko(tokoId: number): Promise<StatusToko> {
  const [t] = await sql`SELECT plan, aktif, langganan_sampai FROM toko WHERE id = ${tokoId}`
  const langganan_sampai = t?.langganan_sampai ?? null
  const expired = !!langganan_sampai && new Date(langganan_sampai) < new Date()

  let isDemo = false
  let demoExpiresAt: string | null = null
  try {
    const [d] = await sql`SELECT is_demo, demo_expires_at FROM toko WHERE id = ${tokoId}`
    isDemo = d?.is_demo ?? false
    demoExpiresAt = d?.demo_expires_at ?? null
  } catch {
    // Kolom belum ada (migrasi belum dijalankan) — anggap saja bukan demo.
  }

  return {
    plan: t?.plan ?? 'trial',
    aktif: t?.aktif ?? false,
    langganan_sampai,
    expired,
    isDemo,
    demoExpiresAt,
  }
}
