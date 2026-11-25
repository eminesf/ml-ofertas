'use client'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

// Pixel do Facebook/Meta para anúncios pagos. O ID é público (vai no HTML de qualquer jeito).
// Fora do /admin. O site navega sem recarregar a página, então o PageView é
// disparado a cada troca de rota (e não só no init, como no código original da Meta).
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '709088587489482'

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

export default function FacebookPixel() {
  const pathname = usePathname()
  const enabled = !!PIXEL_ID && !pathname.startsWith('/admin')

  // 1ª página: o PageView sai no próprio script do pixel; daqui em diante, um por troca de rota
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (enabled) window.fbq?.('track', 'PageView')
  }, [pathname, enabled])

  if (!enabled) return null
  return (
    <>
      <Script id="fb-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
      </Script>
      <noscript>
        <img height="1" width="1" style={{ display: 'none' }} alt="" src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  )
}
