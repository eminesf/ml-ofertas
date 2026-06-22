'use client'
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'fox_welcomed'
const DURATION = 5000

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(true)

    const start = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - start
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100)
      setProgress(pct)
      if (elapsed >= DURATION) {
        clearInterval(tick)
        setVisible(false)
      }
    }, 50)

    return () => clearInterval(tick)
  }, [])

  if (!visible) return null

  return (
    <div
      onClick={() => setVisible(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20,
          padding: '2rem 2rem 1.5rem',
          maxWidth: 380, width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.25s ease',
          position: 'relative',
        }}
      >
        {/* Fechar */}
        <button
          onClick={() => setVisible(false)}
          aria-label="Fechar"
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: '#aaa', lineHeight: 1, padding: 4,
          }}
        >
          ✕
        </button>

        {/* Logo */}
        <img src="/logo_png.png" alt="Fox Ofertas" style={{ height: 80, marginBottom: '0.75rem' }} />

        {/* Texto */}
        <h2 style={{ margin: '0 0 0.5rem', fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>
          Bem-vindo ao Fox Ofertas!
        </h2>
        <p style={{ margin: '0 0 1.5rem', fontSize: 14, color: '#555', lineHeight: 1.5 }}>
          Siga nosso canal no Telegram e receba as melhores promoções direto no seu celular, antes de todo mundo.
        </p>

        {/* Botão Telegram */}
        <a
          href="https://t.me/e_foxofertas"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setVisible(false)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            background: '#229ED9', color: '#fff',
            padding: '13px 24px', borderRadius: 12,
            fontWeight: 700, fontSize: 15, textDecoration: 'none',
            marginBottom: '1.25rem',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          Seguir canal no Telegram
        </a>

        {/* Barra de progresso */}
        <div style={{ background: '#f0f0f0', borderRadius: 99, height: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: '#229ED9',
            width: `${progress}%`,
            transition: 'width 0.05s linear',
          }} />
        </div>
        <p style={{ margin: '0.5rem 0 0', fontSize: 11, color: '#bbb' }}>
          Fecha automaticamente em {Math.ceil((progress / 100) * (DURATION / 1000))}s
        </p>
      </div>
    </div>
  )
}
