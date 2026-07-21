'use client'

import { useSearchParams } from 'next/navigation'

export default function SearchBar() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''

  return (
    <form action="/" method="GET" role="search" className="header-search">
      <input
        type="text"
        name="q"
        defaultValue={q}
        placeholder="Buscar ofertas..."
        aria-label="Buscar ofertas"
        className="header-search-input"
      />
      <button type="submit" className="header-search-btn" aria-label="Buscar">
        🔍
      </button>
    </form>
  )
}
