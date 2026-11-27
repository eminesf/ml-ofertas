'use client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/fila', label: 'Fila' },
  { href: '/admin/ofertas', label: 'Ofertas' },
  { href: '/admin/analise', label: 'Análise' },
  { href: '/admin/import', label: 'Importar oferta' },
  { href: '/admin/stories', label: 'Stories' },
  { href: '/admin/nike', label: 'Nike' },
]

// No celular: logo + Sair em cima e o menu numa linha que rola de lado (antes o menu
// tinha ~645px e a página inteira ficava larga e miúda). Também reduz o respiro das páginas.
const CSS = `
.adm-header { background:#1a1a2e; color:#fff; padding:0 1.5rem; display:flex; align-items:center; gap:1.5rem; height:52px; }
.adm-brand { font-weight:900; font-size:15px; color:#FFE600; margin-right:8px; white-space:nowrap; }
.adm-nav { display:flex; gap:4px; flex:1; }
.adm-nav a { color:#aaa; font-size:13px; text-decoration:none; padding:4px 10px; border-radius:6px; white-space:nowrap; }
.adm-nav a.on { color:#FFE600; font-weight:700; background:rgba(255,230,0,0.08); }
.adm-logout { background:transparent; border:1px solid #444; color:#aaa; border-radius:6px; padding:4px 12px; font-size:12px; cursor:pointer; font-family:inherit; }
@media (max-width: 860px) {
  .adm-header { flex-wrap:wrap; height:auto; padding:10px 12px 0; gap:0; position:sticky; top:0; z-index:40; }
  .adm-brand { flex:1; }
  .adm-logout { padding:6px 12px; }
  .adm-nav { order:3; flex:0 0 100%; overflow-x:auto; scrollbar-width:none; margin:8px -12px 0; padding:0 8px 8px; gap:6px; }
  .adm-nav::-webkit-scrollbar { display:none; }
  .adm-nav a { padding:8px 12px; font-size:14px; background:rgba(255,255,255,0.06); }
  .offer-editor { position:static !important; }
}
@media (max-width: 640px) {
  .adm-content > div, .adm-content > main { padding-left:12px !important; padding-right:12px !important; padding-top:16px !important; margin-top:0 !important; }
  .adm-content h1 { font-size:19px !important; }
}
`

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/admin/login') return <>{children}</>

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0' }}>
      <style>{CSS}</style>
      <header className="adm-header">
        <span className="adm-brand">Fox Admin</span>
        <nav className="adm-nav">
          {NAV_LINKS.map(link => (
            <Link key={link.href} href={link.href} className={pathname === link.href ? 'on' : undefined}>
              {link.label}
            </Link>
          ))}
        </nav>
        <button onClick={handleLogout} className="adm-logout">Sair</button>
      </header>
      <div className="adm-content">{children}</div>
    </div>
  )
}
