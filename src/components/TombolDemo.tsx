'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function TombolDemo({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function mulai() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/demo/start', { method: 'POST' })
      if (res.ok) {
        router.push('/app')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Gagal memulai demo, coba lagi.')
      }
    } catch {
      setError('Tidak ada koneksi ke server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button onClick={mulai} disabled={loading} className={className}>
        {loading ? 'Menyiapkan demo...' : 'Coba Demo Sekarang'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
