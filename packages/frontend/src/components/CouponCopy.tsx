'use client'
import { useState } from 'react'

interface Props {
  code: string
  variant: 'badge' | 'box'
  amount?: string
}

export default function CouponCopy({ code, variant, amount }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      // fallback para browsers sem clipboard API
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (variant === 'badge') {
    return (
      <button
        onClick={copy}
        title={`Copiar cupom ${code}`}
        style={{
          background: copied ? '#d1fae5' : '#fef3c7',
          color: copied ? '#065f46' : '#92400e',
          fontSize: 11, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20,
          border: 'none', cursor: 'pointer',
          transition: 'background 0.2s, color 0.2s',
          lineHeight: 'inherit',
        }}
      >
        {copied ? '✓ Copiado!' : '🎟️ Cupom'}
      </button>
    )
  }

  // variant === 'box' — bloco de cupom na página de detalhe
  return (
    <div style={{
      background: '#fffbe6', border: '2px dashed #e6c800',
      borderRadius: 10, padding: '0.875rem', marginBottom: '1rem',
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14 }}>🎟️ Cupom de desconto</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={copy}
          title="Clique para copiar"
          style={{
            background: copied ? '#d1fae5' : '#fff3b0',
            color: copied ? '#065f46' : '#92400e',
            padding: '6px 14px', borderRadius: 6,
            fontWeight: 700, fontSize: 16,
            border: `1px solid ${copied ? '#6ee7b7' : '#e6c800'}`,
            cursor: 'pointer', fontFamily: 'monospace',
            transition: 'background 0.2s, color 0.2s, border-color 0.2s',
            minWidth: 120,
          }}
        >
          {copied ? '✓ Copiado!' : code}
        </button>
        {amount && (
          <span style={{ color: '#856404', fontWeight: 600 }}>{amount}</span>
        )}
      </div>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#856404' }}>
        {copied ? 'Código copiado! Cole no checkout do Mercado Livre.' : 'Clique no código para copiar e aplique no checkout'}
      </p>
    </div>
  )
}
