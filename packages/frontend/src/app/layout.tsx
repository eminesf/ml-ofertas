import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'
import WelcomeModal from '@/components/WelcomeModal'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Fox Ofertas — Promoções e Cupons do Mercado Livre',
  description: 'As melhores promoções e cupons do Mercado Livre, selecionadas por IA. Economize nas suas compras.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={nunito.className} style={{ margin: 0, background: '#f0f0f0', color: '#333' }}>
        <header style={{ background: '#FFE600', borderBottom: '2px solid #e6c800', position: 'sticky', top: 0, zIndex: 100 }}>
          <div className="header-inner">
            <a href="/" className="header-logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <img src="/logo_png.png" alt="Fox Ofertas" style={{ height: 48, width: 'auto', display: 'block' }} />
              <span style={{ color: '#1a1a1a', fontWeight: 900, fontSize: 17, letterSpacing: -0.5, lineHeight: 1.1 }}>
                Fox Ofertas
                <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: 0 }}>
                  Promoções
                </span>
              </span>
            </a>

            <nav className="header-nav">
              <a href="/categoria/eletronicos" style={navLink}>Eletrônicos</a>
              <a href="/categoria/esporte" style={navLink}>Esporte</a>
              <a href="/categoria/moda" style={navLink}>Moda</a>
              <a href="/categoria/casa" style={navLink}>Casa</a>
              <a href="/categoria/beleza" style={navLink}>Beleza</a>
            </nav>
          </div>
        </header>

        <WelcomeModal />

        {children}

        {/* Botão flutuante Telegram */}
        <a
          href="https://t.me/e_foxofertas"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Canal no Telegram"
          className="telegram-fab"
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 200,
            width: 56, height: 56, borderRadius: '50%',
            background: '#229ED9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </a>

        <footer style={{ background: '#1a1a1a', color: '#888', textAlign: 'center', padding: '2rem 1rem', marginTop: '3rem', fontSize: 13 }}>
          <img src="/logo_png.png" alt="Fox Ofertas" style={{ height: 48, marginBottom: '0.75rem', opacity: 0.85 }} />
          <p style={{ margin: 0, fontWeight: 600, color: '#ccc' }}>Fox Ofertas © 2026</p>
          <p style={{ margin: '0.25rem 0 0' }}>Os preços podem mudar a qualquer momento. Verifique sempre no site do vendedor.</p>
        </footer>
      </body>
    </html>
  )
}

const navLink: React.CSSProperties = {
  textDecoration: 'none',
  color: '#333',
  fontWeight: 600,
  fontSize: 14,
  padding: '4px 10px',
  borderRadius: 20,
  background: 'rgba(0,0,0,0.08)',
}
