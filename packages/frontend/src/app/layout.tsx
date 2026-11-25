import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import WelcomeModal from '@/components/WelcomeModal'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import TelegramFab from '@/components/TelegramFab'
import { getChannels } from '@/lib/api'
import WhatsAppGroupsDialog from '@/components/WhatsAppGroups'
import FacebookPixel from '@/components/FacebookPixel'
import CookieConsent from '@/components/CookieConsent'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'pt_BR', siteName: SITE_NAME, url: '/', title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
  twitter: { card: 'summary_large_image', title: `${SITE_NAME} — ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
}

// Dados estruturados do site: nome, logo, canais e caixa de busca no Google
const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/logo_png.png`, sameAs: ['https://t.me/e_foxofertas', 'https://www.instagram.com/fox_promocoes_/'] },
    {
      '@type': 'WebSite', '@id': `${SITE_URL}/#site`, name: SITE_NAME, url: SITE_URL, inLanguage: 'pt-BR', publisher: { '@id': `${SITE_URL}/#org` },
      potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
    },
  ],
}

export const viewport: Viewport = {
  themeColor: '#ffe600',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { whatsapp, whatsappGroups } = await getChannels()
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh font-sans flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <SiteHeader whatsappUrl={whatsapp} />
        <WelcomeModal whatsappUrl={whatsapp} />
        <div className="flex-1">{children}</div>
        <SiteFooter whatsappUrl={whatsapp} />
        <TelegramFab whatsappUrl={whatsapp} />
        <WhatsAppGroupsDialog groups={whatsappGroups} />
        <FacebookPixel />
        <CookieConsent />
      </body>
    </html>
  )
}
