'use client'

import { useSearchParams } from 'next/navigation'

export default function SearchBar() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''

  return (
    <div className="search-bar-wrap">
      <form action="/" method="GET" role="search" className="search-bar">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar ofertas..."
          aria-label="Buscar ofertas"
          className="search-bar-input"
        />
        <button type="submit" className="search-bar-btn" aria-label="Buscar">
          🔍
        </button>
      </form>
    </div>
  )
}
