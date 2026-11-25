'use client'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

// Barra de carregamento no pé da tela: aparece ao clicar num link interno (produto,
// categoria, paginação…) ou enviar a busca, e completa quando a nova página aparece.
// O App Router não tem evento de "navegação começou", então escutamos cliques/submits.
// Fica acima da faixa de cookies (z-index maior) e não bloqueia nada (pointer-events: none).

// Não olha e.defaultPrevented: o <Link> do Next cancela o clique nativo para navegar
// pelo roteador. Botões dentro do card (copiar cupom, votar) param a propagação e nem chegam aqui.
function isInternalNav(a: HTMLAnchorElement, e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  if (a.target && a.target !== '_self') return false
  if (a.hasAttribute('download')) return false
  const href = a.getAttribute('href')
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false
  const url = new URL(a.href, location.href)
  if (url.origin !== location.origin) return false
  // /r/ redireciona para a loja (fora do site); mesma página só com âncora não navega
  if (url.pathname.startsWith('/r/')) return false
  return url.pathname !== location.pathname || url.search !== location.search
}

function Bar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timers = useRef<number[]>([])
  const running = useRef(false)

  const clear = () => { timers.current.forEach(t => clearTimeout(t)); timers.current = [] }

  function start() {
    if (running.current) return
    running.current = true
    clear()
    setVisible(true)
    setProgress(8)
    // Avança rápido no começo e cada vez mais devagar, sem chegar a 100% sozinho
    let p = 8
    const tick = () => {
      p += (90 - p) * 0.12
      setProgress(p)
      timers.current.push(window.setTimeout(tick, 250))
    }
    timers.current.push(window.setTimeout(tick, 150))
    // Segurança: se a navegação nunca terminar (erro, voltar), some em 15s
    timers.current.push(window.setTimeout(done, 15000))
  }

  function done() {
    if (!running.current) return
    running.current = false
    clear()
    setProgress(100)
    timers.current.push(window.setTimeout(() => setVisible(false), 250))
    timers.current.push(window.setTimeout(() => setProgress(0), 500))
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a')
      if (a && isInternalNav(a as HTMLAnchorElement, e)) start()
    }
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement
      if (!e.defaultPrevented && (form.method || 'get').toLowerCase() === 'get') start()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('submit', onSubmit)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('submit', onSubmit)
      clear()
    }
    // start/done usam refs; registrar uma vez só
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Página nova apareceu → completa a barra
  useEffect(() => {
    done()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] h-1 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full bg-[#f5b800] shadow-[0_0_8px_rgba(245,184,0,0.8)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default function NavProgress() {
  // useSearchParams exige Suspense no App Router
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  )
}
