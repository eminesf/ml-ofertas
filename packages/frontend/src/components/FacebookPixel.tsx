'use client'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { CONSENT_EVENT, getConsent } from '@/lib/consent'

// Pixel do Facebook/Meta para anúncios pagos. O ID é público (vai no HTML de qualquer jeito).
// Só carrega depois que a pessoa aceita os cookies (CookieConsent) e fica fora do /admin.
// O site navega sem recarregar a página, então o PageView é disparado a cada troca de rota.
const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '709088587489482'

declare global {
  interface Window { fbq?: (...args: unknown[]) => void }
}

export default function FacebookPixel() {
  const pathname = usePathname()
  const [consent, setConsentState] = useState(false)

  useEffect(() => {
    setConsentState(getConsent() === 'ok')
    const onChange = (e: Event) => setConsentState((e as CustomEvent).detail === 'ok')
    window.addEventListener(CONSENT_EVENT, onChange)
    return () => window.removeEventListener(CONSENT_EVENT, onChange)
  }, [])

  const enabled = !!PIXEL_ID && consent && !pathname.startsWith('/admin')

  // 1ª página: o PageView sai no próprio script do pixel; daqui em diante, um por troca de rota
  const first = useRef(true)
  useEffect(() => {
    if (!enabled) return
    if (first.current) { first.current = false; return }
    window.fbq?.('track', 'PageView')
  }, [pathname, enabled])

  if (!enabled) return null
  return (
    <Script id="fb-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
    </Script>
  )
}
