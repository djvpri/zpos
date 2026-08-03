// Tidak ada fallback hardcode — repo publik, nilai default = bocor.
// Samakan CROSS_APP_SECRET dengan Z One & spoke lain di seluruh ekosistem.
export function getCrossAppSecret(): string {
  const s = process.env.CROSS_APP_SECRET
  if (!s) throw new Error('CROSS_APP_SECRET belum di-set (samakan dengan Z One).')
  return s
}

// Base URL hub akun (Z One). Dipakai utk membangun URL QR login desktop:
// kasir scan QR → buka Z One /sso/zpos?device=... → login → redirect balik ke
// ZPos /sso?token=...&device=... Pairing selesai. WAJIB di-set.
export function getZoneBaseUrl(): string {
  const s = process.env.ZONE_BASE_URL
  if (!s) throw new Error('ZONE_BASE_URL belum di-set (contoh https://zone.zomet.my.id).')
  return s.replace(/\/+$/, '')
}

// Secret khusus utk endpoint reset harian demo — TERPISAH dari
// CROSS_APP_SECRET (bukan dipakai app lain di ekosistem, cukup dikenal
// oleh cron job Railway sendiri dan endpoint ini).
export function getDemoResetSecret(): string {
  const s = process.env.DEMO_RESET_SECRET
  if (!s) throw new Error('DEMO_RESET_SECRET belum di-set.')
  return s
}
