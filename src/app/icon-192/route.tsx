import { ImageResponse } from 'next/og'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: '#4f46e5',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: 'white', fontSize: 112, fontWeight: 900, fontFamily: 'sans-serif' }}>
          Z
        </span>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
