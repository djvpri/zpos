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

// Bangun barcode internal unik untuk produk minimarket tanpa barcode.
// Format 8 digit (Code 128-C): prefix '2' + 6 digit id (last-6) + 1 check EAN.
// Total 8 digit numerik GENAP -> dicetak Code 128-C (2 digit/simbol = 4 pasang
// data) = bar paling sedikit & lebar modul 0.25mm (2-3 dot solid) agar TERBACA
// scanner di label kecil 25mm.
// - id 1..999.999 -> 6 digit unik -> bar 8 digit barcode_internal PASTI unik
//   (id global tabel produk berurutan & <1jt di semua toko). Collision hanya bila
//   id berbeda 1.000.000 (jarang; ponytail: naik ke 10 digit bila id >= 1jt).
// - v3 lama (6 digit, '2'+4 digit id) TIDAK unik utk id>=10000 -> DIGANTI skema ini.
//   (v2 8-digit & v1 13-digit masih dikenali isInternalBarcode utk produk lama.)
export function generateProductBarcode(id: number): string {
  const base = `2${String(Math.abs(id)).padStart(6, '0').slice(-6)}`
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
// Mengenal TIGA format:
//  - v4 (8 digit): '2' + 6 digit id + 1 check EAN (Code 128-C) — format TERBARU
//  - v3 (6 digit, '2'+4 digit id lama): masih dikenali utk produk lama (cacat unik)
//  - v2 (8 digit, '2'+6 digit id lama): produk yg dibuat antara v2..v3
//  - v1 (13 digit): '2'+11 digit id, produk lama
// Dipakai UI utk hint dan agar barcode lama tetap dikenali/di-render.
export function isInternalBarcode(bc?: string | null): boolean {
  if (!bc) return false
  // v3 (6 digit)
  if (/^2\d{5}$/.test(bc)) return Number(eanCheckDigit(bc.slice(0, 5))) === Number(bc[5])
  // v2 (8 digit)
  if (/^2\d{7}$/.test(bc)) return Number(eanCheckDigit(bc.slice(0, 7))) === Number(bc[7])
  // v1 (13 digit)
  if (/^2\d{12}$/.test(bc)) return Number(ean13CheckDigit(bc.slice(0, 12))) === Number(bc[12])
  return false
}

// Render barcode sebagai inline SVG, dimensi FISIK mm (konsisten preview & print).
// Kebijakan simbologi (agar terbaca label kecil & scanner 1D):
//  - 13 digit numerik REAL kemasan (bukan internal) -> EAN-13 (wajib retail).
//  - Barcode INTERNAL v3 (6 digit, prefix '2' + 4 id + check) -> Code 128-C
//    (2 digit/simbol = 7 bar, modulMu utk label kecil 25mm).
//  - Barcode INTERNAL v2/v1 lama (8/13 digit prefix '2') -> 128-C/128-B.
//  - Numerik genap selain di atas (mis. 12 digit) -> Code 128-C.
//  - Lainnya (alfanumerik / ganjil non-13) -> Code 128-B.
// modulMm = lebar modul terkecil dlm mm (default 0.25). heightMm dlm mm.
export function barcodeToSvg(text: string, heightMm = 12, modulMm = 0.25): string {
  const digits = text.replace(/\D/g, '')
  // 13 digit & bukan internal -> EAN-13 retail
  if (digits.length === 13 && !isInternalBarcode(text)) return ean13Svg(digits, heightMm, modulMm)
  // Internal v1 (13 digit) & lainnya (alfanumerik/ganjil) -> Code 128-B
  if (digits.length > 0 && digits.length % 2 === 0 && digits.length !== 13) return code128CSvg(digits, heightMm, modulMm)
  return code128BSvg(text, heightMm, modulMm)
}

// --- Bitmap resolusi-tinggi utk PRINT (*DPI-agnostik*, ≥ opsional) -------------
// App komersial tak boleh hardcode DPI printer (203/300/600). SVG mm murni bisa
// jatuh di frakcional dot -> buram saat print thermal (bar/gap 1-dot nyatu).
// Solusi: render barcode ke <canvas> hitam-putih dgn RESOLUSI TINGGI tetap
// (modulPx besar), lalu pasang sbg <img> dgn ukuran fisik mm + image-rendering:
// pixelated. Browser print men-downsample dari resolusi tinggi -> tiap bar jatuh
// pas di dot grid printer apa pun -> solid & tajam. Hanya tersedia di browser
// (document); SSR/prerender fallback ke SVG vektor (barcodeToSvg).
export function barcodeToPngDataUrl(text: string, heightMm = 8, modulMm = 0.2): string {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return ''
  const digits = text.replace(/\D/g, '')
  const MOD = 8 // px per modul pada bitmap (resolusi tinggi; downsample utk print)
  const runs: Array<[number, number]> = [] // [xModul, widthModul] bar hitam
  let totalModul: number
  let quiet: number
  if (digits.length === 13 && !isInternalBarcode(text)) {
    const first = digits[0]
    const parity = EAN_PARITY[first] || 'LLLLLL'
    const left = digits.slice(1, 7).split('').map((d, i) => (parity[i] === 'L' ? EAN_L[d] : EAN_G[d])).join('')
    const right = digits.slice(7, 13).split('').map(d => EAN_R[d]).join('')
    const stream = `101${left}01010${right}101`
    quiet = 9
    totalModul = stream.length + quiet * 2
    let x = 0
    let i = 0
    while (i < stream.length) {
      if (stream[i] === '1') {
        let w = 0
        while (i < stream.length && stream[i] === '1') { i++; w++ }
        runs.push([x, w]); x += w
      } else { i++; x++ }
    }
  } else if (digits.length > 0 && digits.length % 2 === 0 && digits.length !== 13) {
    const vals: number[] = []
    for (let i = 0; i < digits.length; i += 2) vals.push(parseInt(digits.slice(i, i + 2), 10))
    const { bits, totalModul: tm } = code128Encoded(vals, 105)
    totalModul = tm; quiet = C128_QUIET
    let x = 0
    let drawing = true
    for (const ch of bits) {
      const w = Number(ch)
      if (drawing) runs.push([x, w])
      x += w; drawing = !drawing
    }
  } else {
    const vals: number[] = []
    for (const ch of text) { const c = ch.codePointAt(0) || 32; vals.push(c >= 32 && c <= 127 ? c - 32 : 63) }
    const { bits, totalModul: tm } = code128Encoded(vals, 104)
    totalModul = tm; quiet = C128_QUIET
    let x = 0
    let drawing = true
    for (const ch of bits) { const w = Number(ch); if (drawing) runs.push([x, w]); x += w; drawing = !drawing }
  }

  const W = (quiet * 2 + totalModul) * MOD
  const H = Math.max(8, Math.round(heightMm / 0.125)) // tinggi dlm dot@203 utk rasio (sbtr)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.max(24, H) // cukup tinggi utk bar solid
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  for (const [x, w] of runs) ctx.fillRect(quiet * MOD + x * MOD, 0, w * MOD, canvas.height)
  const url = canvas.toDataURL('image/png')
  // <img> lebar fisik mm (agar tampil pas di label), pixelated biar downsample tegas
  const wMm = ((quiet * 2 + totalModul) * modulMm).toFixed(2)
  return `<img src="${url}" alt="" style="width:${wMm}mm;height:${heightMm}mm;image-rendering:pixelated;vertical-align:top"/>`
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
// Output dalam satuan FISIK mm (modulMm). Dipakai biar print 1:1 — browser print
// tak meng-squash (px-vs-mm mismatch yg bikin bar buram); preview layar & print
// pakai ukuran mm yang sama -> KONSISTEN. height dlm mm.
function code128SvgFromValues(vals: number[], start: number, heightMm: number, modulMm = 0.25): string {
  const { bits, totalModul } = code128Encoded(vals, start)
  const wMm = (C128_QUIET * 2 + totalModul) * modulMm
  let rects = ''
  let xMm = C128_QUIET * modulMm
  let drawing = true
  for (const ch of bits) {
    const wdtMm = Number(ch) * modulMm
    if (drawing) rects += `<rect x="${xMm}" y="0" width="${wdtMm}" height="${heightMm}" fill="#000"/>`
    xMm += wdtMm
    drawing = !drawing
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${wMm}mm" height="${heightMm}mm" viewBox="0 0 ${wMm} ${heightMm}">${rects}</svg>`
}

// Code 128 -> koncatenasi bar/gap (bits, masuk mulai bar) + total modul (tanpa quiet).
// Dipakai sbg sumber pola tunggal utk : (1) SVG vektor, (2) bitmap PNG print.
function code128Encoded(vals: number[], start: number): { bits: string; totalModul: number } {
  let sum = start
  for (let i = 0; i < vals.length; i++) sum += vals[i] * (i + 1)
  const all = [start, ...vals, sum % 103, 106]
  let bits = ''
  let totalModul = 0
  for (const v of all) {
    const p = C128[v]
    bits += p
    totalModul += Array.from(p).reduce((a, d) => a + Number(d), 0)
  }
  return { bits, totalModul }
}

function code128CSvg(digits: string, heightMm: number, modulMm = 0.25): string {
  const vals: number[] = []
  for (let i = 0; i < digits.length; i += 2) vals.push(parseInt(digits.slice(i, i + 2), 10))
  return code128SvgFromValues(vals, 105, heightMm, modulMm) // Start Code C
}

// Code 128-B: tiap char -> nilai (ASCII - 32), range 0..95. Luar range -> '?' (63).
function code128BSvg(text: string, heightMm: number, modulMm = 0.25): string {
  const vals: number[] = []
  for (const ch of text) {
    const c = ch.codePointAt(0) || 32
    vals.push(c >= 32 && c <= 127 ? c - 32 : 63)
  }
  return code128SvgFromValues(vals, 104, heightMm, modulMm) // Start Code B
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

function ean13Svg(digits: string, heightMm: number, modulMm = 0.25): string {
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
  const totalModul = stream.length + QUIET * 2
  const wMm = totalModul * modulMm
  let rects = ''
  let xMm = QUIET * modulMm
  let run = 0
  for (let i = 0; i <= stream.length; i++) {
    if (i < stream.length && stream[i] === '1') { run++; continue }
    if (run > 0) {
      rects += `<rect x="${xMm}" y="0" width="${run * modulMm}" height="${heightMm}" fill="#000"/>`
      xMm += run * modulMm
      run = 0
    }
    if (i < stream.length) xMm += modulMm // gap '0'
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${wMm}mm" height="${heightMm}mm" viewBox="0 0 ${totalModul} ${stream.length}">${rects}</svg>`
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
