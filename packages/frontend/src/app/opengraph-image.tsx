import { ImageResponse } from 'next/og'
import { SITE_NAME } from '@/lib/site'

// Imagem padrão de compartilhamento (WhatsApp, Telegram, Facebook, Google Discover)
export const alt = `${SITE_NAME} — promoções e cupons todo dia`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#18181b', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 44, fontWeight: 800 }}>
          <div style={{ width: 22, height: 72, borderRadius: 8, background: '#ffe600', marginRight: 24 }} />
          {SITE_NAME}
        </div>
        <div style={{ marginTop: 48, fontSize: 76, fontWeight: 900, lineHeight: 1.05, display: 'flex', flexDirection: 'column' }}>
          <span>Desconto de verdade, todo dia.</span>
          <span style={{ color: '#ffe600' }}>Antes que acabe.</span>
        </div>
        <div style={{ marginTop: 36, fontSize: 32, color: 'rgba(255,255,255,.7)' }}>Oferta relâmpago, cupom e preço lá embaixo.</div>
      </div>
    ),
    size,
  )
}
