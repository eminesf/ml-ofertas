'use client'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart3, Download, Globe, Instagram, LayoutDashboard, ListOrdered, LogOut, Menu, Search, Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/fila', label: 'Fila', icon: ListOrdered },
  { href: '/admin/ofertas', label: 'Ofertas', icon: Search },
  { href: '/admin/analise', label: 'Análise', icon: BarChart3 },
  { href: '/admin/import', label: 'Importar oferta', icon: Download },
  { href: '/admin/stories', label: 'Stories', icon: Instagram },
  { href: '/admin/nike', label: 'Nike', icon: Tag },
]

// Celular: só o respiro menor nas páginas e o editor de oferta sem "sticky"
// (no celular ele fica embaixo da lista e cobriria o conteúdo).
const CSS = `
@media (max-width: 860px) { .offer-editor { position: static !important; } }
@media (max-width: 640px) {
  .adm-content > div, .adm-content > main { padding-left:12px !important; padding-right:12px !important; padding-top:16px !important; margin-top:0 !important; }
  .adm-content h1 { font-size:19px !important; }
}
`

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (pathname === '/admin/login') return <>{children}</>

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const current = NAV_LINKS.find(l => l.href === pathname)

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0' }}>
      <style>{CSS}</style>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-[#1a1a2e] px-3 text-white shadow-sm lg:gap-4 lg:px-6">
        {/* Menu hambúrguer (até lg) */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Abrir menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-0 border-r-0 bg-[#1a1a2e] p-0 text-white">
            <SheetHeader className="px-5 pt-5 pb-4">
              <SheetTitle className="text-lg font-black text-[#FFE600]">Fox Admin</SheetTitle>
              <SheetDescription className="text-xs text-white/50">Painel da Fox Promoções</SheetDescription>
            </SheetHeader>
            <Separator className="bg-white/10" />
            <nav className="flex flex-col gap-1 p-3">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-semibold transition-colors',
                      active ? 'bg-[#FFE600] text-[#1a1a2e]' : 'text-white/80 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <Icon className="size-[18px]" />
                    {label}
                  </Link>
                )
              })}
            </nav>
            <SheetFooter className="border-t border-white/10">
              <Button asChild variant="outline" className="h-11 justify-start border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link href="/" onClick={() => setOpen(false)}><Globe className="size-4" /> Ir para o site</Link>
              </Button>
              <Button variant="ghost" onClick={handleLogout} className="h-11 justify-start text-white/70 hover:bg-white/10 hover:text-white">
                <LogOut className="size-4" /> Sair
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Link href="/admin" className="shrink-0 text-[15px] font-black text-[#FFE600] no-underline">Fox Admin</Link>
        {current && <span className="truncate text-sm font-semibold text-white/60 lg:hidden">· {current.label}</span>}

        {/* Menu inline (desktop) */}
        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-[13px] whitespace-nowrap no-underline transition-colors',
                pathname === href ? 'bg-[#FFE600]/10 font-bold text-[#FFE600]' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" className="bg-[#FFE600] font-bold text-[#1a1a2e] hover:bg-[#e6cf00]">
            <Link href="/" title="Ir para o site"><Globe className="size-4" /><span className="hidden sm:inline">Ver site</span><span className="sm:hidden">Site</span></Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="hidden border-white/20 bg-transparent text-white/70 hover:bg-white/10 hover:text-white lg:inline-flex"
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </header>
      <div className="adm-content">{children}</div>
    </div>
  )
}
