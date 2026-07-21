'use client'

import { usePathname, useSearchParams } from 'next/navigation'

export default function SearchBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const ordenar = searchParams.get('ordenar')

  return (
    <div className="search-bar-wrap">
      <form action={pathname} method="GET" role="search" className="search-bar">
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
          defaultValue={q}
          placeholder="Buscar ofertas..."
          aria-label="Buscar ofertas"
          className="search-bar-input"
        />
      </form>
    </div>
  )
}
