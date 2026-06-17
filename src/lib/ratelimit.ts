import sql from './db'

const MAKS_PERCOBAAN = 5      // gagal maks dalam jendela waktu
const JENDELA_MENIT = 15      // jendela waktu (menit)

// true = masih boleh mencoba, false = diblokir sementara.
export async function bolehLogin(kunci: string): Promise<boolean> {
  const [row] = await sql`
    SELECT count(*)::int AS count FROM login_attempt
    WHERE kunci = ${kunci} AND created_at > now() - interval '15 minutes'
  `
  return (row?.count ?? 0) < MAKS_PERCOBAAN
}

export async function catatGagal(kunci: string, ip: string | null): Promise<void> {
  await sql`INSERT INTO login_attempt (kunci, ip) VALUES (${kunci}, ${ip})`
  // Bersihkan baris lama agar tabel tidak membengkak.
  await sql`DELETE FROM login_attempt WHERE created_at < now() - interval '1 day'`
}

export async function resetPercobaan(kunci: string): Promise<void> {
  await sql`DELETE FROM login_attempt WHERE kunci = ${kunci}`
}

export function ipDari(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

export { MAKS_PERCOBAAN, JENDELA_MENIT }
