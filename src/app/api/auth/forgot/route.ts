import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { signResetToken } from '@/lib/auth'

export async function POST(req: Request) {
  const { email } = await req.json()

  // Selalu balas ok agar tidak membocorkan email mana yang terdaftar.
  const ok = NextResponse.json({ ok: true })
  if (!email?.trim()) return ok

  const [user] = await sql`
    SELECT id, nama, email FROM "user" WHERE email = ${email.trim()} AND aktif = true
  `
  if (!user) return ok

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) {
    console.error('RESEND_API_KEY / RESEND_FROM belum diset — email reset tidak terkirim')
    return ok
  }

  const token = await signResetToken(user.id, user.email)
  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  const link = `${origin}/reset?token=${encodeURIComponent(token)}`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: user.email,
        subject: 'Reset Password ZPos',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#111">Reset Password</h2>
            <p>Halo ${user.nama}, kami menerima permintaan reset password akun ZPos Anda.</p>
            <p>Klik tombol di bawah untuk membuat password baru. Tautan berlaku 1 jam.</p>
            <p style="margin:24px 0">
              <a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600">Reset Password</a>
            </p>
            <p style="color:#888;font-size:13px">Jika Anda tidak meminta ini, abaikan email ini.</p>
          </div>
        `,
      }),
    })
    if (!res.ok) console.error('Resend gagal:', await res.text())
  } catch (e) {
    console.error('Gagal kirim email reset:', e)
  }

  return ok
}
