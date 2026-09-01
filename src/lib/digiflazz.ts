import { createHash } from 'node:crypto'

// --- Konfigurasi Digiflazz ---
// Sumber: https://developer.digiflazz.com/api/buyer/
// endpoint transaksi (topup + inquiry/payment pasca) & cek-status pakai /v1/transaction
const BASE = 'https://api.digiflazz.com/v1'

export interface DigiflazzConfig {
  username: string
  password: string
  testing: boolean // true = sandbox (request tak kena saldo asli, test-case precoded jalan)
}

function cfg(): DigiflazzConfig {
  const u = process.env.DIGIFLAZZ_USERNAME
  const p = process.env.DIGIFLAZZ_PASSWORD
  if (!u || !p) throw new Error('DIGIFLAZZ_USERNAME/DIGIFLAZZ_PASSWORD belum di-set di env.')
  return { username: u, password: p, testing: process.env.DIGIFLAZZ_TESTING !== 'false' }
}

// sign = md5(username + buyer_sku_code + password), untuk SEMUA tipe request buyer.
// ref_id WAJIB unik per transaksi — dipakai lookup ulang di cek-status.
export function tandaRequest(username: string, sku: string, password: string): string {
  return createHash('md5').update(`${username}${sku}${password}`).digest('hex')
}

async function panggil(body: Record<string, unknown>): Promise<DigiflazzRes> {
  const { username, password, testing } = cfg()
  const res = await fetch(`${BASE}/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, username, testing, sign: tandaRequest(username, body.buyer_sku_code as string, password) }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Digiflazz HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }
  return (await res.json()) as DigiflazzRes
}

// Bentuk standar respons Digiflazz; `data` adalah array baris transaksi.
export interface DigiflazzRes {
  rc?: string
  message?: string
  data?: Record<string, unknown>[]
}

// Satu baris baris transaksi Digiflazz (akses via path → nilai string|null).
export interface DigiflazzRow {
  status?: string
  rc?: string
  sn?: string | null
  message?: string | null
  desc?: string | null
  customer_name?: string | null
  buyer_product_name?: string | null
  product_name?: string | null
  price?: string | number | null
  selling_price?: string | number | null
  admin?: string | number | null
  [k: string]: unknown
}

// Topup prabayar (pulsa/data/voucher) — response langsung Sukses/Gagal/Pending.
export async function topup(sku: string, customerNo: string, refId: string) {
  return panggil({ commands: 'topup', buyer_sku_code: sku, customer_no: customerNo, ref_id: refId })
}

// Inquiry pascabayar (PLN/PDAM/dst) — step 1, cek tagihan sebelum bayar.
export async function inquiryPasca(sku: string, customerNo: string, refId: string) {
  return panggil({ commands: 'inq-pasca', buyer_sku_code: sku, customer_no: customerNo, ref_id: refId })
}

// Payment pascabayar — step 2, bayar setelah inquiry sukses.
export async function bayarPasca(sku: string, customerNo: string, refId: string) {
  return panggil({ commands: 'pay-pasca', buyer_sku_code: sku, customer_no: customerNo, ref_id: refId })
}

// Cek status satu transaksi sdh (untuk finalisasi Pending saat webhook/cron).
// CATATAN: sign untuk commands:status = md5(username + ref_id + password),
// BUKAN md5(username + sku + password) seperti topup/pasca. Jadi dihitung
// sendiri di sini, tak lewat panggil() yg berbasis buyer_sku_code.
export async function cekStatus(sku: string, refId: string) {
  const { username, password, testing } = cfg()
  const res = await fetch(`${BASE}/transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: 'status', username, ref_id: refId, testing,
      sign: createHash('md5').update(`${username}${refId}${password}`).digest('hex'),
    }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Digiflazz cek-status HTTP ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}

// Cek saldo akun buyer.
// Doc: sign untuk cek-saldo = md5(username + apiKey + "depo"), BUKAN
// md5(username + apiKey) — ada suffix "depo" (beda dari topup/pasca/status).
// Sumber: developer.digiflazz.com/api/buyer/cek-saldo/
export async function cekSaldo() {
  const { username, password } = cfg()
  const res = await fetch(`${BASE}/cek-saldo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'deposit', username, sign: createHash('md5').update(`${username}${password}depo`).digest('hex') }),
  })
  if (!res.ok) throw new Error(`Digiflazz cek-saldo HTTP ${res.status}`)
  return res.json()
}
