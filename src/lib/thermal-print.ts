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
  cmd += '* Terima kasih *' + LF
  cmd += 'Powered by ZPOS' + LF
  cmd += LF + LF + LF

  cmd += CUT

  return cmd
}

/**
 * Print langsung via Web Bluetooth API — tidak butuh app tambahan.
 * RPP02N support BLE, jadi bisa connect langsung dari Chrome Android.
 * 
 * UUID service printer thermal BLE umumnya pakai Nordic UART Service (NUS):
 * Service:  6E400001-B5A3-F393-E0A9-E50E24DCCA9E
 * TX Char:  6E400002-B5A3-F393-E0A9-E50E24DCCA9E (write)
 * RX Char:  6E400003-B5A3-F393-E0A9-E50E24DCCA9E (notify)
 */

const BLE_SERVICE     = '6e400001-b5a3-f393-e0a9-e50e24dcca9e' // Nordic UART
const BLE_TX_CHAR     = '6e400002-b5a3-f393-e0a9-e50e24dcca9e' // Write to printer

// Chunk size — BLE max MTU biasanya 20 bytes, kirim per chunk
const CHUNK_SIZE = 20

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export type PrintStatus = 'idle' | 'connecting' | 'printing' | 'done' | 'error'

export async function printViaBluetooth(
  escPosData: string,
  onStatus?: (s: PrintStatus, msg?: string) => void
): Promise<boolean> {
  const set = (s: PrintStatus, msg?: string) => onStatus?.(s, msg)

  if (!navigator.bluetooth) {
    set('error', 'Web Bluetooth tidak didukung browser ini. Gunakan Chrome.')
    return false
  }

  try {
    let device: BluetoothDevice | null = null

    // Coba pakai printer yang sudah pernah dipilih sebelumnya (tanpa popup)
    try {
      const permitted = await navigator.bluetooth.getDevices()
      const saved = permitted.find(d =>
        d.name?.startsWith('RPP') || d.name?.startsWith('MTP') ||
        d.name?.startsWith('Thermal') || d.name?.startsWith('Printer')
      )
      if (saved) {
        set('connecting', `Menghubungkan ke ${saved.name}...`)
        device = saved
      }
    } catch {
      // getDevices() tidak didukung semua versi Chrome — fallback ke requestDevice
    }

    // Kalau belum ada printer tersimpan, tampilkan popup pilih printer
    if (!device) {
      set('connecting', 'Pilih printer Bluetooth...')
      device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: 'RPP02N' },
          { namePrefix: 'RPP' },
          { namePrefix: 'MTP' },
          { namePrefix: 'Thermal' },
          { namePrefix: 'Printer' },
        ],
        optionalServices: [
          BLE_SERVICE,
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        ],
      })
    }

    set('connecting', `Menghubungkan ke ${device.name}...`)
    const server = await device.gatt!.connect()

    // Coba Nordic UART dulu
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null
    try {
      const service = await server.getPrimaryService(BLE_SERVICE)
      characteristic = await service.getCharacteristic(BLE_TX_CHAR)
    } catch {
      try {
        const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb')
        const chars = await service.getCharacteristics()
        characteristic = chars.find((c: BluetoothRemoteGATTCharacteristic) => c.properties.write || c.properties.writeWithoutResponse) || null
      } catch {
        set('error', 'Printer tidak mendukung BLE print.')
        server.disconnect()
        return false
      }
    }

    if (!characteristic) {
      set('error', 'Characteristic write tidak ditemukan di printer.')
      server.disconnect()
      return false
    }

    set('printing', 'Mengirim data ke printer...')

    const encoder = new TextEncoder()
    const data = encoder.encode(escPosData)

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE)
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk)
      } else {
        await characteristic.writeValue(chunk)
      }
      await sleep(20)
    }

    set('done', 'Struk berhasil dicetak!')
    await sleep(500)
    server.disconnect()
    return true
  } catch (err: any) {
    if (err.name === 'NotFoundError' || err.message?.includes('cancelled')) {
      set('idle')
    } else {
      set('error', `Gagal print: ${err.message || err}`)
    }
    return false
  }
}

/**
 * Tampilkan popup pilih printer — untuk ganti printer atau pertama kali setup.
 * Setelah dipilih, browser akan ingat printer itu untuk sesi berikutnya.
 */
export async function selectPrinter(): Promise<string | null> {
  if (!navigator.bluetooth) return null
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { name: 'RPP02N' },
        { namePrefix: 'RPP' },
        { namePrefix: 'MTP' },
        { namePrefix: 'Thermal' },
        { namePrefix: 'Printer' },
      ],
      optionalServices: [BLE_SERVICE, '000018f0-0000-1000-8000-00805f9b34fb'],
    })
    return device.name || 'Printer'
  } catch {
    return null
  }
}

/**
 * Cek apakah sudah ada printer yang disimpan sebelumnya
 */
export async function getSavedPrinterName(): Promise<string | null> {
  if (!navigator.bluetooth) return null
  try {
    const devices = await navigator.bluetooth.getDevices()
    const saved = devices.find(d =>
      d.name?.startsWith('RPP') || d.name?.startsWith('MTP') ||
      d.name?.startsWith('Thermal') || d.name?.startsWith('Printer')
    )
    return saved?.name || null
  } catch {
    return null
  }
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}
