import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import WelcomeModal from '@/components/WelcomeModal'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import TelegramFab from '@/components/TelegramFab'
import { getChannels } from '@/lib/api'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Fox Ofertas — Promoções, cupons e descontos de verdade todo dia',
  description:
    'Oferta relâmpago, cupom e preço lá embaixo, atualizados o dia todo. Achou, aproveitou — antes que acabe!',
}

export const viewport: Viewport = {
  themeColor: '#ffe600',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { whatsapp } = await getChannels()
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh font-sans flex flex-col">
        <Suspense fallback={<div className="h-[120px] sm:h-[112px] border-b bg-background" />}>
          <SiteHeader whatsappUrl={whatsapp} />
        </Suspense>
        <WelcomeModal whatsappUrl={whatsapp} />
        <div className="flex-1">{children}</div>
        <SiteFooter whatsappUrl={whatsapp} />
        <TelegramFab whatsappUrl={whatsapp} />
      </body>
    </html>
  )
}
