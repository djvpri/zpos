// Definisi desain nota — template terpusat dipakai web (zpos) dan kasir (Z1 Kasir).
//
// SETIAP desain = pasangan dua renderer (HTML & ESC/POS) yang harus seragam
// field-order dan gayanya. Web render sbg HTML, kasir render sbg ESC/POS teks.
// Catatan: ESC/POS thermal 32-kolom tak bisa render HTML/CSS — jadi bukan satu
// string template, melainkan SELF-DESKRIpsi layout netral (urutan & gaya) yang
// MUST diikuti konsisten oleh tiap renderer, supaya nota web & kasir identik.
//
// Ketentuan migrasi renderer baru: ikuti `itemsOrder` + flag gaya persis.
// Perbedaan antar desain: posisi blok info (No/Tgl/Ksr/Pay), posisi TOTAL,
// footer, dan divider style. Padding antar-baris thermal pakai konstanta 32 kolom.

export interface DesainNota {
  id: string
  label: string
  footerPowered: boolean            // tampilkan "Powered by Z1 Pos" di bawah
  infoSebelumItems: boolean         // blok No/Tgl/Ksr/Pay sebelum daftar item
  totalPertama: boolean             // TOTAL di baris pertama summary (sbrn ringkasan)
  dividerStyle: 'dashed' | 'solid'  // 'dashed' → garis putus-putus, 'solid' → garis penuh
  showKsr: boolean                  // tampilkan baris Kasir
}

export const DESAIN_NOTA: DesainNota[] = [
  {
    id: 'klasik',
    label: 'Klasik',
    footerPowered: false,
    infoSebelumItems: true,
    totalPertama: false, // urutan: Subtotal, Diskon, TOTAL, Bayar, Kembalian
    dividerStyle: 'dashed',
    showKsr: true,
  },
  {
    id: 'modern',
    label: 'Modern',
    footerPowered: true,
    infoSebelumItems: false,
    totalPertama: true, // urutan: TOTAL (besar), lalu Bayar, Kembalian, Subtotal, Diskon
    dividerStyle: 'solid',
    showKsr: false,
  },
]

export type IdDesainNota = DesainNota['id']

export function getDesainNota(id?: string | null): DesainNota {
  return DESAIN_NOTA.find(d => d.id === id) ?? DESAIN_NOTA[0]
}

export const desainNotaIds = DESAIN_NOTA.map(d => d.id)
