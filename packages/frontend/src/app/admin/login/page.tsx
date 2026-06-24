'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/admin'

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro desconhecido')
        return
      }
      router.push(from)
    } catch {
      setError('Erro ao conectar com o servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f0f0f0', padding: '1rem',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '2rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)', width: '100%', maxWidth: 380,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{
            background: '#7c3aed', color: '#fff', fontSize: 11, fontWeight: 700,
            padding: '3px 12px', borderRadius: 20, display: 'inline-block', marginBottom: 12,
          }}>
            ADMIN
          </span>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>Fox Promoções</h1>
          <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>Acesso restrito</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 6, color: '#333' }}>
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${error ? '#e53e3e' : '#ddd'}`, fontSize: 14,
                fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
              }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, color: '#c53030', fontSize: 13, fontWeight: 600 }}>❌ {error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              background: loading || !password ? '#ccc' : '#FFE600',
              color: '#333', border: 'none', borderRadius: 10,
              padding: '12px', fontWeight: 800, fontSize: 15,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
