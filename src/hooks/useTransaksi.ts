'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Transaksi, DetailTransaksi } from '@/types'

export function useTransaksi() {
  const [loading, setLoading] = useState(false)
  const [riwayat, setRiwayat] = useState<Transaksi[]>([])

  const simpan = async (trx: Transaksi, items: DetailTransaksi[]) => {
    setLoading(true)
    try {
      const { data: trxData, error: trxErr } = await supabase
        .from('transaksi')
        .insert({
          no_transaksi: trx.no_transaksi,
          subtotal: trx.subtotal,
          diskon: trx.diskon,
          pajak: trx.pajak,
          total: trx.total,
          bayar: trx.bayar,
          kembali: trx.kembali,
          metode_bayar: trx.metode_bayar,
          kasir: trx.kasir || 'Kasir 1',
        })
        .select()
        .single()

      if (trxErr) throw trxErr

      const details = items.map(it => ({
        transaksi_id: trxData.id,
        produk_id: it.produk_id,
        nama_produk: it.nama_produk,
        harga: it.harga,
        qty: it.qty,
        subtotal: it.subtotal,
      }))

      const { error: detErr } = await supabase.from('detail_transaksi').insert(details)
      if (detErr) throw detErr

      return { data: trxData, error: null }
    } catch (e: any) {
      return { data: null, error: e.message }
    } finally {
      setLoading(false)
    }
  }

  const fetchRiwayat = useCallback(async (limit = 20) => {
    const { data } = await supabase
      .from('transaksi')
      .select('*, detail_transaksi(*)')
      .order('created_at', { ascending: false })
      .limit(limit)
    setRiwayat(data || [])
  }, [])

  return { loading, riwayat, simpan, fetchRiwayat }
}
