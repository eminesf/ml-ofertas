'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export default function SearchBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const ordenar = searchParams.get('ordenar')

  const [value, setValue] = useState(q)
  const [recent, setRecent] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setRecent(loadRecent())
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
    window.location.href = `${pathname}?${params.toString()}`
  }

  return (
    <div className="search-bar-wrap" ref={wrapRef}>
      <form
        action={pathname}
        method="GET"
        role="search"
        className="search-bar"
        autoComplete="off"
        onSubmit={() => remember(value)}
      >
        {ordenar && <input type="hidden" name="ordenar" value={ordenar} />}
        <button type="submit" className="search-bar-icon" aria-label="Buscar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Buscar ofertas..."
          aria-label="Buscar ofertas"
          className="search-bar-input"
        />
      </form>

      {open && recent.length > 0 && (
        <div className="search-bar-dropdown">
          <div className="search-bar-dropdown-label">Recentes</div>
          {recent.map((term) => (
            <div key={term} className="search-bar-dropdown-item" onClick={() => pickItem(term)}>
              <span>↺ {term}</span>
              <button
                type="button"
                aria-label={`Remover "${term}"`}
                className="search-bar-dropdown-remove"
                onClick={(e) => removeItem(term, e)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
