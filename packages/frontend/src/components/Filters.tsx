'use client'

interface Props {
  sort?: string
  minDiscount?: number
}

export default function Filters({ sort, minDiscount }: Props) {
  function navigate(key: string, value: string) {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
    url.searchParams.delete('pagina')
    window.location.href = url.toString()
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <select
        value={sort || 'recent'}
        onChange={e => navigate('ordenar', e.target.value)}
        style={selectStyle}
      >
        <option value="recent">Mais recentes</option>
        <option value="discount">Maior desconto</option>
        <option value="score">Melhor avaliado (IA)</option>
      </select>

      <select
        value={String(minDiscount || '')}
        onChange={e => navigate('desconto', e.target.value)}
        style={selectStyle}
      >
        <option value="">Qualquer desconto</option>
        <option value="20">20%+ OFF</option>
        <option value="30">30%+ OFF</option>
        <option value="40">40%+ OFF</option>
        <option value="50">50%+ OFF</option>
      </select>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid #ddd',
  background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
