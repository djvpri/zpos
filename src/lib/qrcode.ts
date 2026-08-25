import QRCode from 'qrcode'

// QR Code → SVG string inline, murni (bisa dipakai di HTML string label cetak &
// di Node utk test). Data pendek (barcode 13 digit) → QR version ~1, error
// correction default (M). `size` = lebar/tinggi SVG dlm px (bukan mm); browser
// menskalakan ke label via CSS. `scale` utk kualitas baris (kecil = label sempit).
//
// Dipakai berdampingan dgn barcode 1D di label: QR jadi backup yg lebih mudah
// discan ketika 1D terlalu rapat di sticker 25×15mm.
export async function qrToSvg(text: string, size = 220, scale = 4): Promise<string> {
  if (!text) return ''
  return QRCode.toString(text, {
    type: 'svg',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    scale,
  })
}
