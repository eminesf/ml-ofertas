import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FuchsOfertas — Melhores Ofertas do Mercado Livre',
  description: 'Ofertas selecionadas com desconto real do Mercado Livre, avaliadas por IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f0f0f0', color: '#333' }}>
        <header style={{ background: '#FFE600', borderBottom: '2px solid #e6c800', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '1rem', height: 56 }}>
            <a href="/" style={{ textDecoration: 'none', color: '#333', fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
              ⚡ FuchsOfertas
            </a>
            <nav style={{ display: 'flex', gap: '0.75rem', flex: 1 }}>
              <a href="/categoria/eletrônicos" style={navLink}>Eletrônicos</a>
              <a href="/categoria/esporte" style={navLink}>Esporte</a>
              <a href="/categoria/moda" style={navLink}>Moda</a>
            </nav>
            <a
              href="https://t.me/fuchsofertas"
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: '#333', color: '#FFE600', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
            >
              📣 Canal Telegram
            </a>
          </div>
        </header>
        {children}
        <footer style={{ background: '#333', color: '#aaa', textAlign: 'center', padding: '2rem 1rem', marginTop: '3rem', fontSize: 13 }}>
          <p style={{ margin: 0 }}>FuchsOfertas © 2026 — Participante do Programa de Afiliados do Mercado Livre</p>
          <p style={{ margin: '0.5rem 0 0' }}>
            Os preços podem mudar a qualquer momento. Verifique sempre no site do vendedor.
          </p>
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
