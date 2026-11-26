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
      <header style={{
        background: '#1a1a2e', color: '#fff', padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', gap: '1.5rem', height: 52,
      }}>
        <span style={{ fontWeight: 900, fontSize: 15, color: '#FFE600', marginRight: 8 }}>
          Fox Admin
        </span>
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: pathname === link.href ? '#FFE600' : '#aaa',
                fontWeight: pathname === link.href ? 700 : 400,
                fontSize: 13, textDecoration: 'none',
                padding: '4px 10px', borderRadius: 6,
                background: pathname === link.href ? 'rgba(255,230,0,0.08)' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent', border: '1px solid #444', color: '#aaa',
            borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Sair
        </button>
      </header>
      {children}
    </div>
  )
}
