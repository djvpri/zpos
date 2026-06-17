export const fmt = (n: number): string =>
  'Rp ' + Number(n).toLocaleString('id-ID')

export const fmtDate = (d: string): string =>
  new Date(d).toLocaleDateString('id-ID', { dateStyle: 'medium' })

export const fmtDateTime = (): string =>
  new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

export const noTrx = (): string =>
  'TRX-' + Date.now().toString().slice(-8)

export const hitungPajak = (subtotal: number, diskon: number, persen: number): number =>
  Math.round((subtotal - diskon) * (persen / 100))

export const hitungTotal = (subtotal: number, diskon: number, pajak: number): number =>
  subtotal - diskon + pajak
