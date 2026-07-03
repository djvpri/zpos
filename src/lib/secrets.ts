// Tidak ada fallback hardcode — repo publik, nilai default = bocor.
// Samakan CROSS_APP_SECRET dengan Z One & spoke lain di seluruh ekosistem.
export function getCrossAppSecret(): string {
  const s = process.env.CROSS_APP_SECRET
  if (!s) throw new Error('CROSS_APP_SECRET belum di-set (samakan dengan Z One).')
  return s
}
