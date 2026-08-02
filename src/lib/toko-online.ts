// Logika murni toko online: format pesan WhatsApp, normalisasi no WA, validasi subdomain.
// Terpisah dari DB biar bisa diuji tanpa database.

export interface ItemPesanan {
  nama: string
  qty: number
  harga: number // satuan, sudah harga efektif
}

export interface InfoPemesan {
  nama: string
  alamat?: string
  catatan?: string
}

/** Sanitize subdomain: huruf kecil, angka, strip. Tanpa protocol/karakter aneh. */
export function normalisasiSubdomain(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('.')[0] // ambil hanya bagian pertama sebuah domain
    .replace(/[^a-z0-9-]/g, '-')
}

export function validSubdomain(raw: string): { ok: boolean; sub?: string; error?: string } {
  // Tolak kalau input mengandung karakter yang bukan [a-z0-9-] (spasi, simbol, dll)
  // atau protocol/domain — normalisasi mengganti tapi itu tak boleh lolos validasi.
  if (raw.includes(' ') || raw.includes('/') || raw.includes('.'))
    return { ok: false, error: 'Hanya huruf kecil, angka, dan strip (tanpa spasi, titik, atau garis miring)' }
  const sub = normalisasiSubdomain(raw)
  if (!sub) return { ok: false, error: 'Subdomain kosong' }
  if (sub.length < 3) return { ok: false, error: 'Subdomain minimal 3 karakter' }
  if (sub.length > 40) return { ok: false, error: 'Subdomain maksimal 40 karakter' }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sub))
    return { ok: false, error: 'Hanya huruf kecil, angka, dan strip' }
  return { ok: true, sub }
}

/** Format no WA ke bentuk internasional utk wa.me: lepas 08 → 62, buang spasi/+/0 ekstra. */
export function normalisasiWa(raw: string): string {
  let n = raw.replace(/[^\d]/g, '')
  if (n.startsWith('0')) n = '62' + n.slice(1)
  if (n.startsWith('8')) n = '62' + n
  return n
}

export function isValidWa(raw: string): boolean {
  const n = normalisasiWa(raw)
  return /^62\d{8,13}$/.test(n)
}

export const fmtRupiah = (n: number): string =>
  'Rp ' + Number(n).toLocaleString('id-ID')

/** Bangun teks pesanan WhatsApp terformat dari item + info pemesan. */
export function formatPesanWa(items: ItemPesanan[], pemesan: InfoPemesan): string {
  const lines: string[] = []
  lines.push('Halo, saya mau pesan:')
  lines.push('')
  let total = 0
  items.forEach((it) => {
    const subtotal = it.harga * it.qty
    total += subtotal
    lines.push(`${it.qty}× ${it.nama} — ${fmtRupiah(it.harga)} = ${fmtRupiah(subtotal)}`)
  })
  lines.push('')
  lines.push(`Total: ${fmtRupiah(total)}`)
  lines.push('')
  lines.push(`Nama: ${pemesan.nama}`)
  if (pemesan.alamat) lines.push(`Alamat: ${pemesan.alamat}`)
  if (pemesan.catatan) lines.push(`Catatan: ${pemesan.catatan}`)
  return lines.join('\n')
}

/** URL wa.me untuk mengirim pesanan ke tenant. */
export function waLink(noWa: string, pesan: string): string {
  return `https://wa.me/${normalisasiWa(noWa)}?text=${encodeURIComponent(pesan)}`
}
