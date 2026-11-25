import { ImageResponse } from 'next/og'
import { getOffer } from '@/lib/api'
import { brl, storeName } from '@/lib/utils'
import { loadFonts, loadImage, shortTitle } from '@/lib/og-art'

// Arte de post do feed do Instagram (1080x1350, 4:5) para uma oferta: /post/<id>
// ?d=1 baixa o PNG. Post do feed não tem link clicável → chamada "link na bio".

const W = 1080
const H = 1350

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const offer = await getOffer(id)
  if (!offer) return new Response('Oferta não encontrada', { status: 404 })

  const [img, fonts] = await Promise.all([loadImage(offer.imageUrl), loadFonts()])
  const hasDiscount = offer.discountPct > 0 && offer.originalPrice > offer.salePrice
  const title = shortTitle(offer.title, 80)
  const coupon = offer.couponCode?.replace(/^#/, '')

  const image = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: 'flex', flexDirection: 'column', background: '#18181b', fontFamily: fonts.length ? 'Nunito' : 'sans-serif', color: 'white' }}>
        {/* topo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '44px 56px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 900 }}>
            <div style={{ width: 16, height: 52, borderRadius: 6, background: '#ffe600', marginRight: 18 }} />
            Fox Promoções
          </div>
          <div style={{ display: 'flex', background: '#ffe600', color: '#18181b', fontSize: 30, fontWeight: 900, padding: '12px 24px', borderRadius: 999 }}>
            OFERTA DO DIA
          </div>
        </div>

        {/* card do produto: foto à esquerda, preço à direita */}
        <div style={{ margin: '0 48px', flex: 1, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 40, overflow: 'hidden', color: '#18181b' }}>
          <div style={{ position: 'relative', height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
            {img ? (
              <img src={img} style={{ maxWidth: 860, maxHeight: 560, objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', fontSize: 56, fontWeight: 900, color: '#a1a1aa' }}>{storeName(offer.provider)}</div>
            )}
            {hasDiscount && (
              <div style={{ position: 'absolute', top: 30, left: 30, display: 'flex', background: '#dc2626', color: 'white', fontSize: 58, fontWeight: 900, padding: '12px 26px', borderRadius: 22 }}>
                -{offer.discountPct}%
              </div>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '28px 44px 34px', background: '#fafafa' }}>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: '#71717a' }}>{storeName(offer.provider)}</div>
            <div style={{ display: 'flex', fontSize: 38, fontWeight: 700, lineHeight: 1.2, marginTop: 8 }}>{title}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 18 }}>
              <div style={{ display: 'flex', fontSize: 96, fontWeight: 900, lineHeight: 1, color: '#16a34a' }}>{brl(offer.salePrice)}</div>
              {hasDiscount && (
                <div style={{ display: 'flex', fontSize: 36, color: '#71717a', textDecoration: 'line-through', marginLeft: 22, marginBottom: 8 }}>{brl(offer.originalPrice)}</div>
              )}
            </div>
            {coupon && (
              <div style={{ display: 'flex', marginTop: 18, fontSize: 34, fontWeight: 900, border: '4px dashed #f59e0b', color: '#b45309', padding: '8px 22px', borderRadius: 16, alignSelf: 'flex-start' }}>
                CUPOM: {coupon}
              </div>
            )}
          </div>
        </div>

        {/* rodapé: post do feed não tem link clicável */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '28px 48px 40px', background: '#ffe600', color: '#18181b', borderRadius: 24, padding: '20px 0' }}>
          <div style={{ display: 'flex', fontSize: 40, fontWeight: 900 }}>Link na bio</div>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, marginLeft: 20, opacity: 0.75 }}>foxpromocoes.com.br</div>
        </div>
      </div>
    ),
    { width: W, height: H, ...(fonts.length ? { fonts } : {}) }
  )

  if (new URL(req.url).searchParams.get('d')) {
    image.headers.set('Content-Disposition', `attachment; filename="post-fox-${id}.png"`)
  }
  image.headers.set('Cache-Control', 'no-store')
  return image
}
