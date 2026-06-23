/**
 * Utilitas print ke printer thermal Bluetooth via RawBT
 * 
 * RawBT adalah app Android yang menjadi perantara antara web app dan printer Bluetooth.
 * Install: https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter
 * 
 * Cara kerja:
 * 1. Web app generate ESC/POS commands
 * 2. Encode ke base64
 * 3. Buka RawBT via Android Intent URL
 * 4. RawBT forward ke printer Bluetooth yang sudah di-pair
 */

// ESC/POS Constants
const ESC = '\x1B'
const GS  = '\x1D'
const LF  = '\x0A'
const INIT         = ESC + '@'           // Initialize printer
const ALIGN_LEFT   = ESC + 'a\x00'      // Align left
const ALIGN_CENTER = ESC + 'a\x01'      // Align center
const ALIGN_RIGHT  = ESC + 'a\x02'      // Align right
const BOLD_ON      = ESC + 'E\x01'      // Bold on
const BOLD_OFF     = ESC + 'E\x00'      // Bold off
const DOUBLE_ON    = GS  + '!\x11'      // Double width + height
const DOUBLE_OFF   = GS  + '!\x00'      // Normal size
const CUT          = GS  + 'V\x41\x03' // Partial cut

const COL = 32 // 58mm printer = 32 chars per line

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length)
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str.slice(-len) : ' '.repeat(len - str.length) + str
}

function twoCol(left: string, right: string, width = COL): string {
  const rLen = right.length
  const lLen = width - rLen
  return padRight(left, lLen) + right + LF
}

function line(): string {
  return '-'.repeat(COL) + LF
}

export interface StrukData {
  namaToko: string
  alamat?: string
  telepon?: string
  waktu: string
  noTransaksi: string
  kasir?: string
  items: { nama: string; qty: number; harga: number }[]
  subtotal: number
  diskon?: number
  pajak?: number
  pajakPersen?: number
  total: number
  bayar: number
  kembali: number
  metodeBayar: string
  catatan?: string
}

export function buildEscPos(s: StrukData): string {
  let cmd = ''

  cmd += INIT
  cmd += ALIGN_CENTER

  // Header toko
  cmd += BOLD_ON + DOUBLE_ON
  cmd += s.namaToko + LF
  cmd += DOUBLE_OFF + BOLD_OFF
  if (s.alamat) cmd += s.alamat + LF
  if (s.telepon) cmd += `Tel: ${s.telepon}` + LF
  cmd += line()

  // Info transaksi
  cmd += ALIGN_LEFT
  cmd += s.waktu + LF
  cmd += `No: ${s.noTransaksi}` + LF
  if (s.kasir) cmd += `Kasir: ${s.kasir}` + LF
  cmd += line()

  // Items
  for (const it of s.items) {
    const total = it.harga * it.qty
    const namaLine = `${it.nama} x${it.qty}`
    cmd += namaLine + LF
    cmd += twoCol('', `Rp${total.toLocaleString('id-ID')}`)
  }
  cmd += line()

  // Ringkasan
  cmd += twoCol('Subtotal', `Rp${s.subtotal.toLocaleString('id-ID')}`)
  if (s.diskon && s.diskon > 0) {
    cmd += twoCol('Diskon', `-Rp${s.diskon.toLocaleString('id-ID')}`)
  }
  if (s.pajak && s.pajak > 0) {
    const labelPajak = s.pajakPersen ? `Pajak ${s.pajakPersen}%` : 'Pajak'
    cmd += twoCol(labelPajak, `Rp${s.pajak.toLocaleString('id-ID')}`)
  }
  cmd += line()

  // Total (besar)
  cmd += ALIGN_CENTER + BOLD_ON + DOUBLE_ON
  cmd += `TOTAL: Rp${s.total.toLocaleString('id-ID')}` + LF
  cmd += DOUBLE_OFF + BOLD_OFF

  cmd += line()
  cmd += ALIGN_LEFT
  cmd += twoCol(`Bayar (${s.metodeBayar})`, `Rp${s.bayar.toLocaleString('id-ID')}`)
  cmd += BOLD_ON + twoCol('Kembali', `Rp${s.kembali.toLocaleString('id-ID')}`) + BOLD_OFF

  // Footer
  cmd += line()
  cmd += ALIGN_CENTER
  if (s.catatan) cmd += s.catatan + LF
  cmd += '★ Terima kasih ★' + LF
  cmd += 'Powered by ZPOS' + LF
  cmd += LF + LF + LF

  cmd += CUT

  return cmd
}

/**
 * Print via RawBT menggunakan Android Intent URL.
 * RawBT harus sudah terinstall dan printer sudah di-pair via Bluetooth.
 * 
 * Cara setup:
 * 1. Install RawBT dari Play Store
 * 2. Buka RawBT → Settings → pilih printer RPP02N
 * 3. Print dari ZPOS → otomatis terbuka RawBT → print ke printer
 */
export function printViaRawBT(escPosData: string): boolean {
  try {
    // Encode ESC/POS ke base64 menggunakan cara yang aman untuk binary
    const bytes = new Uint8Array(escPosData.length)
    for (let i = 0; i < escPosData.length; i++) {
      bytes[i] = escPosData.charCodeAt(i) & 0xFF
    }
    const b64 = btoa(String.fromCharCode(...bytes))

    // RawBT Intent URL — buka RawBT dengan data print
    const intentUrl = `intent://rawbt?base64=${b64}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`
    window.location.href = intentUrl
    return true
  } catch (err) {
    console.error('RawBT print error:', err)
    return false
  }
}

/**
 * Cek apakah device kemungkinan Android (untuk tampilkan tombol RawBT)
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}
