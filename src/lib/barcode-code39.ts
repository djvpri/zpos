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
// Bangun barcode internal unik utk produk tanpa barcode kemasan.
// Format BARU (v2, 8 digit): prefix '2' + id di-pad jadi 6 digit + 1 check digit
// EAN-8. Total 8 digit numerik -> dicetak Code 128-C (bar tebal, muat label
// kecil 25mm dengan X-dimension >=0.25mm -> terbaca scanner 1D).
// Mengganti format LAMA (13 digit prefix '2' + 11 digit id + check) yang
// TIDAK muat label kecil (13 digit butuh ~33mm utk X-dim 0.25mm).
export function generateProductBarcode(id: number): string {
  const base = `2${String(Math.abs(id)).padStart(6, '0').slice(0, 6)}`
  const check = eanCheckDigit(base)
  return base + String(check)
}

// Check digit EAN utk panjang data bebas (bobot 1-3 bergantian dari kanan,
// digit paling kanan data × 3). Valid utk data >=2 digit.
export function eanCheckDigit(digits: string): number {
  let sum = 0
  const n = digits.length
  for (let i = 0; i < n; i++) {
    const d = parseInt(digits[i], 10) || 0
    // bobot: kanan-kiri bergantian mulai 3
    const w = ((n - 1 - i) % 2) === 0 ? 3 : 1
    sum += d * w
  }
  return (10 - (sum % 10)) % 10
}

// Check digit EAN-13 (12 digit, bobot 1-3 bobot kiri-kanan) — utk format LAMA.
export function ean13CheckDigit(digits12: string): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10) || 0
    sum += (i % 2 === 0) ? d : d * 3
  }
  return (10 - (sum % 10)) % 10
}

// true kalau barcode ini DIBUAT internal ZPos (bukan barcode kemasan asli).
// Mengenal DUA format:
//  - v2: '2' + 6 digit id + 1 check EAN (8 digit, Code 128-C)
//  - v1: '2' + 11 digit id + 1 check EAN (13 digit) utk produk lama yg uda tercetak
// Dipakai UI utk hint & agar barcode lama (13 digit) tetap dikenali & di-render
// 128-B, tanpa perlu cetak ulang otomatis.
export function isInternalBarcode(bc?: string | null): boolean {
  if (!bc) return false
  // v2 (8 digit)
  if (/^2\d{7}$/.test(bc)) return Number(eanCheckDigit(bc.slice(0, 7))) === Number(bc[7])
  // v1 (13 digit)
  if (/^2\d{12}$/.test(bc)) return Number(ean13CheckDigit(bc.slice(0, 12))) === Number(bc[12])
  return false
}

// Render barcode sebagai inline SVG.
// Kebijakan simbologi (agar terbaca label kecil & scanner 1D):
//  - 13 digit numerik REAL kemasan (bukan internal) -> EAN-13 (wajib retail).
//  - Barcode INTERNAL v2 (8 digit, prefix '2' + 6 id + check) -> Code 128-C
//    (padat, bar tebal, muat label kecil 25mm).
//  - Barcode INTERNAL v1 lama (13 digit prefix '2') -> Code 128-B (ganjil).
//  - Numerik genap selain di atas (mis. 12 digit) -> Code 128-C.
//  - Lainnya (alfanumerik / ganjil non-13) -> Code 128-B.
export function barcodeToSvg(text: string, height = 40, modulePx = 1): string {
  const digits = text.replace(/\D/g, '')
  // 13 digit & bukan internal -> EAN-13 retail (tetap, tak boleh diubah).
  if (digits.length === 13 && !isInternalBarcode(text)) return ean13Svg(digits, height)
  // Internal (13 digit prefix '2') ataupun teks lain -> Code 128-B.
  if (digits.length > 0 && digits.length % 2 === 0 && digits.length !== 13) return code128CSvg(digits, height, modulePx)
  return code128BSvg(text, height, modulePx)
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

// --- Code 128 (fallback utk barcode numerik genap non-13 -> C; internal/alfanumerik -> B) ---
// Code 128-C: tiap 2 digit = 1 simbol (11 modul), jauh lebih padat dari
// CODE39 (9 modul per digit) → untuk 12 digit, bar ~2x lebih tebal di lebar
// label yang sama → scanner laser tetap terbaca walau kertas agak pudar.
// Code 128-B: tiap 1 karakter = 1 simbol (nilai ASCII-32), bisa alfanumerik
// & panjang ganjil → dipakai label kecil utk barcode internal 13 digit & teks,
// karena bar lebih tebal sedigit dibanding EAN-13 / CODE39.
const C128: Record<number, string> = {
  0:'212222',1:'222122',2:'222221',3:'121223',4:'121322',5:'131222',6:'122213',7:'122312',8:'132212',9:'221213',
  10:'221312',11:'231212',12:'112232',13:'122132',14:'122231',15:'113222',16:'123122',17:'123221',18:'223211',19:'221132',
  20:'221231',21:'213212',22:'223112',23:'312131',24:'311222',25:'321122',26:'321221',27:'312212',28:'322112',29:'322211',
  30:'212123',31:'212321',32:'232121',33:'111323',34:'131123',35:'131321',36:'112313',37:'132113',38:'132311',39:'211313',
  40:'231113',41:'231311',42:'112133',43:'112331',44:'132131',45:'113123',46:'113321',47:'133121',48:'313121',49:'211331',
  50:'231131',51:'213113',52:'213311',53:'213131',54:'311123',55:'311321',56:'331121',57:'312113',58:'312311',59:'332111',
  60:'314111',61:'221411',62:'431111',63:'111224',64:'111422',65:'121124',66:'121421',67:'141122',68:'141221',69:'112214',
  70:'112412',71:'122114',72:'122411',73:'142112',74:'142211',75:'241211',76:'221114',77:'413111',78:'241112',79:'134111',
  80:'111242',81:'121142',82:'121241',83:'114212',84:'124112',85:'124211',86:'411212',87:'421112',88:'421211',89:'212141',
  90:'214121',91:'412121',92:'111143',93:'111341',94:'131141',95:'114113',96:'114311',97:'411113',98:'411311',99:'113141',
  100:'114131',101:'311141',102:'411131',103:'211412',104:'211214',105:'211232',106:'2331112',
}
const C128_QUIET = 10

// Encode daftar nilai simbol -> SVG. start=104 (B) atau 105 (C). Hitung check
// digit (weighted sum dr start), append stop 106.
// modulePx = lebar 1 modul dalam px (>=1). Dipakai biar bar TIDAK diskala bebas
// oleh CSS (yg bikin printer raster-ngeblast rounding -> bar tipis tak konsisten
// & buram). Modul px bulat -> tiap bar selalu kelipatan integer -> tajam.
function code128SvgFromValues(vals: number[], start: number, height: number, modulePx = 1): string {
  let sum = start
  for (let i = 0; i < vals.length; i++) sum += vals[i] * (i + 1)
  const all = [start, ...vals, sum % 103, 106]
  let bits = ''
  let totalModul = 0
  for (const v of all) { const p = C128[v]; bits += p; totalModul += Array.from(p).reduce((a, d) => a + Number(d), 0) }
  const w = (C128_QUIET * 2 + totalModul) * modulePx
  let rects = ''
  let x = C128_QUIET * modulePx
  let drawing = true
  for (const ch of bits) {
    const wdt = Number(ch) * modulePx
    if (drawing) rects += `<rect x="${x}" y="0" width="${wdt}" height="${height}" fill="#000"/>`
    x += wdt
    drawing = !drawing
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}">${rects}</svg>`
}

function code128CSvg(digits: string, height: number, modulePx = 1): string {
  const vals: number[] = []
  for (let i = 0; i < digits.length; i += 2) vals.push(parseInt(digits.slice(i, i + 2), 10))
  return code128SvgFromValues(vals, 105, height, modulePx) // Start Code C
}

// Code 128-B: tiap char -> nilai (ASCII - 32), range 0..95. Luar range -> '?' (63).
function code128BSvg(text: string, height: number, modulePx = 1): string {
  const vals: number[] = []
  for (const ch of text) {
    const c = ch.codePointAt(0) || 32
    vals.push(c >= 32 && c <= 127 ? c - 32 : 63)
  }
  return code128SvgFromValues(vals, 104, height, modulePx) // Start Code B
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
