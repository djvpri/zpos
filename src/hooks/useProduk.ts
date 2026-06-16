'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Produk } from '@/types'

export function useProduk() {
  const [produk, setProduk] = useState<Produk[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('produk')
      .select('*, kategori(nama)')
      .eq('aktif', true)
      .order('nama')
    if (error) setError(error.message)
    else setProduk(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const tambah = async (p: Omit<Produk, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('produk').insert(p)
    if (!error) fetch()
    return error
  }

  const update = async (id: number, p: Partial<Produk>) => {
    const { error } = await supabase.from('produk').update(p).eq('id', id)
    if (!error) fetch()
    return error
  }

  const hapus = async (id: number) => {
    const { error } = await supabase.from('produk').update({ aktif: false }).eq('id', id)
    if (!error) fetch()
    return error
  }

  const kurangiStok = (id: number, qty: number) => {
    setProduk(prev => prev.map(p => p.id === id ? { ...p, stok: p.stok - qty } : p))
  }

  const tambahStok = (id: number, qty: number) => {
    setProduk(prev => prev.map(p => p.id === id ? { ...p, stok: p.stok + qty } : p))
  }

  return { produk, loading, error, fetch, tambah, update, hapus, kurangiStok, tambahStok }
}
