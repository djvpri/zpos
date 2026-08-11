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
  const check = ean13CheckDigit(base)
  return base + String(check)
}

// Check digit EAN-13 (bobot 1-3 bergantian, posisi kanan-tanpa-check). Sangat
// beda dari Luhn — dipakai EAN/UPC retail, agar barcode internal yang dicetak
// ke label terbaca & divalidasi oleh scanner EAN-13.
function ean13CheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10) || 0
    sum += (i % 2 === 0) ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

// true kalau barcode ini DIBUAT internal ZPos (prefix '2' + 11 digit + Luhn),
// bukan barcode asli kemasan. Dipakai UI utk kasih tahu admin kalau produk
// perlu discan barcode aslinya. Sedikit bisa false-positive kalau barcode
// real kebetulan mulai '2', 13 digit, & Luhn valid — jarang, dan efeknya
// cuma hint UI, tak memblokir apa pun.
export function isInternalBarcode(bc?: string | null): boolean {
  if (!bc) return false
  return /^2\d{12}$/.test(bc) && Number(ean13CheckDigit(bc.slice(0, 12))) === Number(bc[12])
}

// Render barcode sebagai inline SVG.
// Nilai 13-digit numerik → EAN-13 (standar retail, padat & narrow bar lebih
// tebal di label sempit → mudah terbaca scanner). Selain itu (barcode
// non-13) → fallback CODE39 (bar lebih renggang utk data pendek/alfanumerik).
export function barcodeToSvg(text: string, height = 40): string {
  const digits = text.replace(/\D/g, '')
  if (digits.length === 13) return ean13Svg(digits, height)
  return code39Svg(text, height)
}

// --- CODE39 (fallback utk barcode selain 13-digit numerik) ---
function code39Svg(text: string, height: number): string {
  const cleaned = normalize(text)
  const full = `*${cleaned}*`
  let bits = ''
  for (const ch of full) {
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

// --- EAN-13 (13 digit) ---
// 95 modul, 1 modul = 1px. Narrow bar 1 modul → di label sempit lebih tebal
// daripada Code39 utk data 13 digit.
const EAN_L: Record<string, string> = { '0':'0001101','1':'0011001','2':'0010011','3':'0111101','4':'0100011','5':'0110001','6':'0101111','7':'0111011','8':'0110111','9':'0001011' }
const EAN_G: Record<string, string> = { '0':'0100111','1':'0110011','2':'0011011','3':'0100001','4':'0011101','5':'0111001','6':'0000101','7':'0010001','8':'0001001','9':'0010111' }
const EAN_R: Record<string, string> = { '0':'1110010','1':'1100110','2':'1101100','3':'1000010','4':'1011100','5':'1001110','6':'1010000','7':'1000100','8':'1001000','9':'1110100' }
// Paritas digit pertama menentukan pola L/G 6 digit kiri.
const EAN_PARITY: Record<string, string> = {
  '0':'LLLLLL','1':'LLGLGG','2':'LLGGLG','3':'LLGGGL','4':'LGLLGG',
  '5':'LGGLLG','6':'LGGGLL','7':'LGLGLG','8':'LGLGGL','9':'LGGLGL',
}

function ean13Svg(digits: string, height: number): string {
  const first = digits[0]
  const parity = EAN_PARITY[first] || 'LLLLLL'
  // strings biarkan berupa parsial — pakai indexes
  const left = digits.slice(1, 7).split('').map((d, i) => {
    const bits = parity[i] === 'L' ? EAN_L[d] : EAN_G[d]
    return bits
  }).join('')
  const right = digits.slice(7, 13).split('').map(d => EAN_R[d]).join('')
  const stream = `101${left}01010${right}101`
  const QUIET = 9 // ruang tenang minimum EAN
  const w = stream.length + QUIET * 2
  let rects = ''
  let x = QUIET
  let run = 0
  for (let i = 0; i <= stream.length; i++) {
    if (i < stream.length && stream[i] === '1') { run++; continue }
    if (run > 0) {
      rects += `<rect x="${x}" y="0" width="${run}" height="${height}" fill="#000"/>`
      x += run
      run = 0
    }
    if (i < stream.length) x++ // gap '0'
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
