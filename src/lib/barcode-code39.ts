// Generator barcode CODE39 → SVG. Murni, tanpa dependency, bisa diuji di Node.
//
// CODE39: setiap karakter diwakili 9 elemen (5 bar + 4 gap), 3 di antaranya
// tebal. Selalu diapit karakter '*'. Karakter yang didukung: A-Z, 0-9,
// spasi, dan -.$/+%.
//
// Kalau teks tidak didukung (mis. huruf kecil, simbol aneh), fallback ke
// angka saja supaya tetap bisa discan.

// Pola per karakter: '1' = tebal, '0' = tipis. Tiap char 9 bit (bar,gap,...)
const CODE39_PATTERNS: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
}

const QUIET_BARS = 10 // ruang tenang di kanan-kiri (dalam unit)

// Bangun angka barcode internal unik untuk produk minimarket tanpa barcode.
// Format: prefix '2' + id di-pad jadi 11 digit + checksum Luhn (untuk
// validasi & mencegah typo). Total 13 digit (seperti EAN-13).
export function generateProductBarcode(id: number): string {
  const base = `2${String(Math.abs(id)).padStart(11, '0').slice(0, 11)}`
  const check = luhn(base)
  return base + String(check)
}

// true kalau barcode ini DIBUAT internal ZPos (prefix '2' + 11 digit + Luhn),
// bukan barcode asli kemasan. Dipakai UI utk kasih tahu admin kalau produk
// perlu discan barcode aslinya. Sedikit bisa false-positive kalau barcode
// real kebetulan mulai '2', 13 digit, & Luhn valid — jarang, dan efeknya
// cuma hint UI, tak memblokir apa pun.
export function isInternalBarcode(bc?: string | null): boolean {
  if (!bc) return false
  return /^2\d{12}$/.test(bc) && Number(luhn(bc.slice(0, 12))) === Number(bc[12])
}

// Checksum Luhn (mod 10) — yang dipakai kartu, juga valid utk barcode numerik.
// Kembalikan digit cek (0-9) supaya num + digit cek habis dibagi 10.
// Untuk KALKULASI checksum: digit paling kanan dari `num` di-double dulu
// (karena setelah checksum ditambah, dia jadi posisi kedua dari kanan).
export function luhn(num: string): number {
  let sum = 0
  let double = true
  for (let i = num.length - 1; i >= 0; i--) {
    let d = parseInt(num[i], 10)
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

// Render barcode CODE39 sebagai inline SVG. Lebar otomatis mengikuti panjang.
export function barcodeToSvg(text: string, height = 40): string {
  const cleaned = normalize(text)
  const full = `*${cleaned}*`
  let bits = ''
  for (const ch of full) {
    // bar per char, judul narrow=1 unit, wide=2 unit; gap antar char=1 unit
    for (let i = 0; i < 9; i++) {
      bits += CODE39_PATTERNS[ch]?.[i] === '1' ? '2' : '1'
    }
    bits += '1' // gap antar karakter
  }
  const w = (QUIET_BARS * 2 + bits.length) * 1 // 1 unit = 1px
  let rects = ''
  let x = QUIET_BARS
  let drawing = true
  for (const b of bits) {
    const width = Number(b)
    if (drawing) rects += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000"/>`
    x += width
    drawing = !drawing
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}">${rects}</svg>`
}

// Pastikan teks bisa di-encode CODE39: huruf besar, digit, dan -.$/+% & spasi.
// Yang lain dibuang; kalau habis → pakai angka hash sederhana.
function normalize(text: string): string {
  const up = text.toUpperCase()
  const allowed = new Set(Object.keys(CODE39_PATTERNS).filter(k => k !== '*'))
  let out = ''
  for (const ch of up) if (allowed.has(ch)) out += ch
  if (!out) {
    // Fallback: representasi numerik stabil dari teks (hash 12 digit)
    let h = 0
    for (const ch of up) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    out = String(h).slice(0, 12) || '1'
  }
  return out.slice(0, 25) // batasi panjang label
}
