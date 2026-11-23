import { ImageResponse } from 'next/og'
import { getOffer } from '@/lib/api'
import { brl, storeName } from '@/lib/utils'

// Arte de story do Instagram (1080x1920) para uma oferta: /story/<id>
// ?d=1 baixa o PNG. Gerada na hora a partir dos dados da oferta.

const W = 1080
const H = 1920

// O gerador (satori) só lê PNG/JPEG: troca webp do ML por jpg e embute como data URL
async function loadImage(url?: string): Promise<string | null> {
  if (!url) return null
  const candidates = /mlstatic\.com/.test(url) ? [url.replace(/\.webp(\?.*)?$/i, '.jpg'), url] : [url]
  for (const u of candidates) {
    try {
      const res = await fetch(u, { signal: AbortSignal.timeout(8000) })
      const type = res.headers.get('content-type') || ''
      if (!res.ok || !/image\/(png|jpe?g)/i.test(type)) continue
      const buf = Buffer.from(await res.arrayBuffer())
      return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`
    } catch {
      // tenta a próxima
    }
  }
  return null
}

// Nunito (fonte do site) em TTF — o gerador não lê woff2. Cache em memória.
let fontsCache: Promise<{ name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[]> | null = null
function loadFonts() {
  fontsCache ??= (async () => {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900')).text()
    const out: { name: string; data: ArrayBuffer; weight: 700 | 900; style: 'normal' }[] = []
    for (const m of css.matchAll(/font-weight: (\d+);[\s\S]*?url\(([^)]+\.ttf)\)/g)) {
      out.push({ name: 'Nunito', weight: Number(m[1]) as 700 | 900, style: 'normal', data: await (await fetch(m[2])).arrayBuffer() })
    }
    return out
  })().catch(() => { fontsCache = null; return [] })
  return fontsCache
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const offer = await getOffer(id)
  if (!offer) return new Response('Oferta não encontrada', { status: 404 })

  const [img, fonts] = await Promise.all([loadImage(offer.imageUrl), loadFonts()])
  const hasDiscount = offer.discountPct > 0 && offer.originalPrice > offer.salePrice
  const title = offer.title.length > 90 ? offer.title.slice(0, 87).trimEnd() + '…' : offer.title
  const coupon = offer.couponCode?.replace(/^#/, '')

  const image = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: '#18181b', fontFamily: fonts.length ? 'Nunito' : 'sans-serif', color: 'white' }}>
        {/* topo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '150px 70px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 46, fontWeight: 900 }}>
            <div style={{ width: 18, height: 60, borderRadius: 6, background: '#ffe600', marginRight: 20 }} />
            Fox Promoções
          </div>
          <div style={{ display: 'flex', background: '#ffe600', color: '#18181b', fontSize: 36, fontWeight: 900, padding: '14px 28px', borderRadius: 999 }}>
            OFERTA DO DIA
          </div>
        </div>

        {/* card do produto */}
        <div style={{ margin: '20px 60px 0', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 48, overflow: 'hidden', color: '#18181b' }}>
          <div style={{ position: 'relative', height: 760, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
            {img ? (
              <img src={img} style={{ maxWidth: 820, maxHeight: 700, objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', fontSize: 60, fontWeight: 900, color: '#a1a1aa' }}>{storeName(offer.provider)}</div>
            )}
            {hasDiscount && (
              <div style={{ position: 'absolute', top: 36, left: 36, display: 'flex', background: '#dc2626', color: 'white', fontSize: 64, fontWeight: 900, padding: '14px 30px', borderRadius: 24 }}>
                -{offer.discountPct}%
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '36px 50px 50px', background: '#fafafa' }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#71717a' }}>{storeName(offer.provider)}</div>
            <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, lineHeight: 1.2, marginTop: 10 }}>{title}</div>
            {hasDiscount && (
              <div style={{ display: 'flex', fontSize: 40, color: '#71717a', textDecoration: 'line-through', marginTop: 24 }}>{brl(offer.originalPrice)}</div>
            )}
            <div style={{ display: 'flex', fontSize: 110, fontWeight: 900, lineHeight: 1, marginTop: 6, color: '#16a34a' }}>{brl(offer.salePrice)}</div>
            {coupon && (
              <div style={{ display: 'flex', marginTop: 24, fontSize: 38, fontWeight: 900, border: '4px dashed #f59e0b', color: '#b45309', padding: '10px 24px', borderRadius: 18, alignSelf: 'flex-start' }}>
                CUPOM: {coupon}
              </div>
            )}
          </div>
        </div>

        {/* chamada — espaço livre embaixo para a figurinha de link do Instagram */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 50 }}>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 900, color: '#ffe600' }}>Corre que acaba!</div>
          <div style={{ display: 'flex', fontSize: 34, color: 'rgba(255,255,255,.75)', marginTop: 14 }}>Toque no link e garanta o seu</div>
        </div>
      </div>
    ),
    { width: W, height: H, ...(fonts.length ? { fonts } : {}) }
  )

  if (new URL(req.url).searchParams.get('d')) {
    image.headers.set('Content-Disposition', `attachment; filename="story-fox-${id}.png"`)
  }
  image.headers.set('Cache-Control', 'no-store')
  return image
}
