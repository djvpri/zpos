'use client'

import { useEffect, useState } from 'react'
import { CardChecklist, Calendar3, Clock, CashCoin, Bank, PersonBadge, Whatsapp, ShieldCheck, ExclamationTriangle } from 'react-bootstrap-icons'
import { fmtDate, fmt } from '@/lib/utils'

interface Lisensi {
  plan: string
  expires_at: string | null
  cost: string | null
  cost_yearly: string | null
  rek_bank: string | null
  rek_nama: string | null
  rek_no: string | null
  whatsapp: string | null
}

export default function LisensiPage() {
  const [data, setData] = useState<Lisensi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sisaHari, setSisaHari] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/license')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setData(d)
        // Date.now di sini (effect) boleh — impure, tapi render beresin.
        setSisaHari(d.expires_at
          ? Math.ceil((new Date(d.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null)
      })
      .catch(() => setError('Gagal memuat data lisensi'))
      .finally(() => setLoading(false))
  }, [])

  const nearEnd = data?.expires_at && sisaHari !== null && sisaHari <= 14

  return (
    <div className="p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-5">
        <CardChecklist size={20} className="text-indigo-600" />
        <h1 className="text-xl font-bold text-gray-900">Lisensi &amp; Perpanjangan</h1>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm py-10 text-center">Memuat...</div>
      ) : error ? (
        <div className="text-red-500 text-sm py-10 text-center">{error}</div>
      ) : data && (
        <>
          {/* Status langganan */}
          <div className={`rounded-2xl border p-5 mb-5 ${nearEnd ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${nearEnd ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800 capitalize">{data.plan} Plan</div>
                <div className="text-xs text-gray-400">Status langganan toko Anda</div>
              </div>
            </div>

            {data.expires_at ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar3 size={15} className="text-gray-400" />
                  Berlaku hingga <span className="font-semibold">{fmtDate(data.expires_at)}</span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${nearEnd ? 'text-amber-600 font-medium' : sisaHari !== null && sisaHari < 0 ? 'text-red-500 font-medium' : 'text-green-600 font-medium'}`}>
                  <Clock size={15} />
                  {sisaHari !== null && sisaHari < 0
                    ? `Langganan sudah berakhir ${Math.abs(sisaHari)} hari lalu`
                    : nearEnd
                      ? `Sisa ${sisaHari} hari — segera perpanjang`
                      : `Aktif — sisa ${sisaHari} hari`}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ExclamationTriangle size={15} className="text-amber-500" />
                Tanggal berakhir belum diatur.
              </div>
            )}
          </div>

          {/* Cara perpanjang — dua pilihan: bulanan & tahunan (hemat) */}
          {data.cost && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-5">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CashCoin size={16} className="text-indigo-600" /> Pilihan Perpanjangan
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {/* Bulanan */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 font-medium mb-2">Per Bulan</div>
                  <div className="text-2xl font-bold text-gray-900 mb-1">{fmt(Number(data.cost))}</div>
                  <div className="text-xs text-gray-400">Cocok utk cicil bulanan</div>
                </div>

                {/* Tahunan — kartu hemat */}
                {(() => {
                  const bulanan = Number(data.cost)
                  const tahunan = data.cost_yearly ? Number(data.cost_yearly) : NaN
                  const valid = !Number.isNaN(bulanan) && bulanan > 0 && !Number.isNaN(tahunan) && tahunan > 0
                  const hemat = valid ? bulanan * 12 - tahunan : NaN
                  return (
                    <div className="relative border-2 border-green-500 rounded-xl p-4 bg-green-50/50">
                      {valid && hemat > 0 && (
                        <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-full">
                          HEMAT {fmt(hemat)}
                        </span>
                      )}
                      <div className="text-xs text-green-700 font-medium mb-2">Per Tahun</div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">{valid ? fmt(tahunan) : '—'}</div>
                      {valid && (
                        <div className="text-[11px] text-gray-400">
                          {hemat > 0
                            ? <>Setara {fmt(Math.round(tahunan / 12))}/bulan — <span className="text-green-600 font-medium">hemat {fmt(hemat)}/tahun</span></>
                            : <>Setara {fmt(Math.round(tahunan / 12))}/bulan</>}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {(data.rek_bank || data.rek_no || data.rek_nama) && (
                <>
                  <p className="text-xs text-gray-400 mb-2">Transfer ke rekening berikut:</p>
                  <div className="space-y-2">
                    {data.rek_bank && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Bank size={15} className="text-gray-400" /> Bank {data.rek_bank}
                      </div>
                    )}
                    {data.rek_no && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <CardChecklist size={15} className="text-gray-400" />
                        No. Rekening <span className="font-mono font-semibold">{data.rek_no}</span>
                      </div>
                    )}
                    {data.rek_nama && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <PersonBadge size={15} className="text-gray-400" /> a.n. {data.rek_nama}
                      </div>
                    )}
                  </div>
                </>
              )}

              {data.whatsapp && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                  <Whatsapp size={15} className="text-green-500" />
                  Setelah transfer, konfirmasi ke WhatsApp{' '}
                  <a
                    href={`https://wa.me/${data.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    {data.whatsapp}
                  </a>
                </div>
              )}
            </div>
          )}

          {!data.cost && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 text-sm text-gray-500">
              Biaya &amp; rekening perpanjangan belum diatur. Hubungi admin untuk info perpanjangan.
            </div>
          )}
        </>
      )}
    </div>
  )
}
