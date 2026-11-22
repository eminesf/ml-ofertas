import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import WelcomeModal from '@/components/WelcomeModal'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import TelegramFab from '@/components/TelegramFab'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Fox Ofertas — Promoções e cupons selecionados por IA',
  description:
    'As melhores promoções e cupons da internet, selecionados por IA. Economize nas suas compras.',
}

export const viewport: Viewport = {
  themeColor: '#ffe600',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh font-sans flex flex-col">
        <Suspense fallback={<div className="h-[120px] sm:h-[112px] border-b bg-background" />}>
          <SiteHeader />
        </Suspense>
        <WelcomeModal />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <TelegramFab />
      </body>
    </html>
  )
}
