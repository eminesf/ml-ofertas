'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { History, Search, X } from 'lucide-react'

const STORAGE_KEY = 'fox_recent_searches'
const MAX_RECENT = 8

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {}
}

// Busca dentro da página atual (home ou categoria); o resto da home fica no "/"
export default function SearchBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const ordenar = searchParams.get('ordenar')
  const action = pathname.startsWith('/categoria/') ? pathname : '/'

  const [value, setValue] = useState(q)
  const [recent, setRecent] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => setValue(q), [q])
  useEffect(() => setRecent(loadRecent()), [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function remember(term: string) {
    const trimmed = term.trim()
    if (!trimmed) return
    const next = [trimmed, ...loadRecent().filter(t => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT)
    saveRecent(next)
    setRecent(next)
  }

  function removeItem(term: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = loadRecent().filter(t => t !== term)
    saveRecent(next)
    setRecent(next)
  }

  function pickItem(term: string) {
    remember(term)
    const params = new URLSearchParams()
    params.set('q', term)
    if (ordenar) params.set('ordenar', ordenar)
    window.location.href = `${action}?${params.toString()}`
  }

  return (
    <div className="relative" ref={wrapRef}>
      <form action={action} method="GET" role="search" autoComplete="off" onSubmit={() => remember(value)}>
        {ordenar && <input type="hidden" name="ordenar" value={ordenar} />}
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar ofertas, produtos, marcas…"
          aria-label="Buscar ofertas"
          enterKeyHint="search"
          className="h-11 w-full rounded-full border bg-muted/60 pr-10 pl-10 text-base outline-none transition-[background,box-shadow,border-color] placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:ring-[3px] focus:ring-ring/30 md:h-10 md:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => setValue('')}
            className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </form>

      {open && recent.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border bg-popover shadow-lg">
          <p className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Buscas recentes</p>
          <ul className="pb-1.5">
            {recent.map(term => (
              <li key={term}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => pickItem(term)}
                  onKeyDown={e => e.key === 'Enter' && pickItem(term)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent"
                >
                  <History className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{term}</span>
                  <button
                    type="button"
                    aria-label={`Remover "${term}"`}
                    onClick={e => removeItem(term, e)}
                    className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
