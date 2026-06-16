import { ImageResponse } from 'next/og'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: '#4f46e5',
          borderRadius: 108,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: 'white', fontSize: 300, fontWeight: 900, fontFamily: 'sans-serif' }}>
          Z
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
