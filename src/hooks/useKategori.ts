'use client'

import { useState, useEffect } from 'react'
import { Kategori } from '@/types'

export function useKategori() {
  const [kategori, setKategori] = useState<Kategori[]>([])

  useEffect(() => {
    fetch('/api/kategori')
      .then(r => r.ok ? r.json() : [])
      .then(setKategori)
      .catch(() => {})
  }, [])

  return { kategori }
}
