import sql from './db'

export interface StatusToko {
  plan: string
  aktif: boolean
  langganan_sampai: string | null
  expired: boolean
}

// Ambil status langganan toko langsung dari DB (real-time, agar perubahan
// admin langsung berlaku tanpa user harus login ulang).
export async function statusToko(tokoId: number): Promise<StatusToko> {
  const [t] = await sql`SELECT plan, aktif, langganan_sampai FROM toko WHERE id = ${tokoId}`
  const langganan_sampai = t?.langganan_sampai ?? null
  const expired = !!langganan_sampai && new Date(langganan_sampai) < new Date()
  return {
    plan: t?.plan ?? 'trial',
    aktif: t?.aktif ?? false,
    langganan_sampai,
    expired,
  }
}
